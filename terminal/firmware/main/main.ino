/*
 * VMS Gate Terminal — MAIN FIRMWARE (fingerprint only)
 * ----------------------------------------------------
 * idle -> fingerprint read -> server verify -> feedback -> cooldown
 *
 * Also acts on commands from the operator portal, so fingerprints can be
 * enrolled and deleted from a browser instead of re-flashing enroll.ino.
 * The ESP32 is an HTTP client on a DHCP address, so the laptop cannot push to
 * it; instead this polls GET /device/command while idle and runs whatever is
 * waiting. Nothing to discover, nothing to pair.
 *
 * Face recognition and the ESP32-CAM are deliberately not part of this build.
 *
 * Wiring (unchanged from hw_test.ino — no re-wiring needed):
 *   Fingerprint TX  -> GPIO 16 (RX2)      Fingerprint RX  -> GPIO 17 (TX2)
 *   Fingerprint VCC -> 3V3  (NOT 5V)      Fingerprint GND -> GND
 *   RGB Red -> GPIO 18 via 220R           RGB Green -> GPIO 19 via 220R
 *   RGB Blue -> GPIO 23 via 220R          RGB cathode -> GND
 *   Buzzer + -> GPIO 25 (active buzzer)   Buzzer - -> GND
 *   Servo signal -> GPIO 13
 *   Servo VCC -> EXTERNAL 5V power bank (NOT the ESP32 5V pin)
 *   Servo GND -> common GND (bank GND and ESP GND tied together)
 *
 * Libraries: Adafruit Fingerprint Sensor Library, ESP32Servo, ArduinoJson v7
 *
 * ==> BEFORE FLASHING: fill in WIFI_SSID, WIFI_PASSWORD, SERVER_BASE below.
 *     Laptop LAN IP on macOS:  ipconfig getifaddr en0
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_Fingerprint.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

// Wifi credentials and the gateway address live here so this sketch can be
// committed without them. Copy secrets.example.h -> secrets.h before flashing.
#include "secrets.h"

// ============ USER CONFIG ============
const char* WIFI_SSID     = WIFI_SSID_VALUE;
const char* WIFI_PASSWORD = WIFI_PASSWORD_VALUE;
// Base URL of the laptop gateway — no trailing slash, no path.
const char* SERVER_BASE   = SERVER_BASE_VALUE;

#define FW_VERSION "gate-fp-1.3"

// If the laptop is unreachable, should an otherwise-good local match open the
// gate anyway?  false = fail closed (correct for a real gate, and it makes a
// network failure obvious instead of silent).
#define OPEN_GATE_IF_SERVER_DOWN false

// ============ PIN MAP ============
#define FP_RX_PIN    16
#define FP_TX_PIN    17
#define LED_R_PIN    18
#define LED_G_PIN    19
#define LED_B_PIN    23
#define BUZZER_PIN   25
#define SERVO_PIN    13

// ============ SERVO POSITIONS ============
#define SERVO_CLOSED 0
#define SERVO_OPEN   90
#define GATE_OPEN_MS 3000

// ============ IF YOUR RGB LED IS COMMON-ANODE, set this to true ============
#define LED_COMMON_ANODE false

// ============ TIMING ============
#define HTTP_TIMEOUT_MS   8000
#define COOLDOWN_MS       1500
#define HEARTBEAT_MS      5000    // how often we tell the portal we are alive
#define CMD_POLL_MS       1000    // how often we check for queued commands
#define ENROL_STEP_MS     60000   // total time allowed per enrolment step
#define LIFT_TIMEOUT_MS    8000   // how long to wait for a finger to come off

// ============ OBJECTS ============
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fpSerial);
Servo gateServo;

// ============ STATE MACHINE ============
enum State { BOOTING, IDLE, MATCH_OK, FLAGGED, UNKNOWN_FP, COOLDOWN, ENROLLING };
State state = BOOTING;
unsigned long stateEnteredAt = 0;
unsigned long lastHeartbeat  = 0;
unsigned long lastCmdPoll    = 0;
int failedReads = 0;            // consecutive unreadable scans

// ============ LED / BUZZER ============
void setLED(bool r, bool g, bool b) {
  if (LED_COMMON_ANODE) { r = !r; g = !g; b = !b; }
  digitalWrite(LED_R_PIN, r ? HIGH : LOW);
  digitalWrite(LED_G_PIN, g ? HIGH : LOW);
  digitalWrite(LED_B_PIN, b ? HIGH : LOW);
}

void beep(int ms) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(ms);
  digitalWrite(BUZZER_PIN, LOW);
}

void beepPattern(int count, int onMs, int offMs) {
  for (int i = 0; i < count; i++) {
    beep(onMs);
    if (i < count - 1) delay(offMs);
  }
}

void openGate() {
  Serial.println("  Gate OPEN");
  gateServo.write(SERVO_OPEN);
  delay(GATE_OPEN_MS);
  gateServo.write(SERVO_CLOSED);
  Serial.println("  Gate closed");
}

void enterState(State newState) {
  state = newState;
  stateEnteredAt = millis();
}

// Block until the finger is off the sensor. Without this a finger left resting
// on the AS608 re-triggers the whole cycle the moment cooldown ends.
void waitForFingerLift() {
  unsigned long start = millis();
  while (finger.getImage() != FINGERPRINT_NOFINGER) {
    if (millis() - start > 10000) {
      Serial.println("  (finger-lift wait timed out)");
      return;
    }
    delay(100);
  }
}

// ============ HTTP PLUMBING ============
bool ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.println("  WiFi dropped, reconnecting...");
  WiFi.reconnect();
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 5000) delay(100);
  return WiFi.status() == WL_CONNECTED;
}

// POSTs a form body to <SERVER_BASE><path>. Returns the response body, or ""
// on any failure. Callers decide whether a failure matters.
String postForm(const char* path, const String& body) {
  if (!ensureWiFi()) return "";

  HTTPClient http;
  String url = String(SERVER_BASE) + path;
  if (!http.begin(url)) return "";
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setConnectTimeout(HTTP_TIMEOUT_MS);

  int code = http.POST(body);
  String out = (code == 200) ? http.getString() : String("");
  if (code != 200) {
    Serial.printf("  POST %s -> %d (%s)\n", path, code,
                  http.errorToString(code).c_str());
  }
  http.end();
  return out;
}

String getPath(const char* path) {
  if (!ensureWiFi()) return "";

  HTTPClient http;
  String url = String(SERVER_BASE) + path;
  if (!http.begin(url)) return "";
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setConnectTimeout(HTTP_TIMEOUT_MS);

  int code = http.GET();
  String out = (code == 200) ? http.getString() : String("");
  http.end();
  return out;
}

// ============ DEVICE / PORTAL PROTOCOL ============
uint16_t templateCount() {
  finger.getTemplateCount();
  return finger.templateCount;
}

void sendHeartbeat() {
  String body = "mac=" + WiFi.macAddress() +
                "&ip=" + WiFi.localIP().toString() +
                "&templates=" + String(templateCount()) +
                "&version=" + String(FW_VERSION);
  postForm("/device/hello", body);
}

void reportProgress(const char* message) {
  Serial.printf("  [enrol] %s\n", message);
  postForm("/device/progress", "message=" + String(message));
}

void reportResult(const char* status, const String& detail) {
  String body = "status=" + String(status) +
                "&detail=" + detail +
                "&templates=" + String(templateCount());
  postForm("/device/result", body);
}

// Waits for a usable print and converts it into the given slot.
//
// Keeps retrying until the step times out. A single unreadable press must not
// end the enrolment: 0x07 (too little ridge detail) is common on dry or
// lightly-placed fingers, and aborting on the first one made enrolment nearly
// impossible to complete.
bool captureInto(uint8_t slot, const char* prompt) {
  reportProgress(prompt);
  unsigned long start = millis();
  int attempts = 0;

  while (millis() - start < ENROL_STEP_MS) {
    uint8_t p = finger.getImage();
    if (p != FINGERPRINT_OK) { delay(80); continue; }

    p = finger.image2Tz(slot);
    if (p == FINGERPRINT_OK) {
      Serial.printf("  captured (slot %d, %d attempt%s)\n",
                    slot, attempts + 1, attempts ? "s" : "");
      beep(60);
      return true;
    }

    attempts++;
    Serial.printf("  attempt %d unusable (0x%02X)\n", attempts, p);
    reportProgress("Not quite — press flat and firm, cover the whole sensor");

    // Brief pause only. This used to wait for the finger to lift, but on a
    // sensor that reports phantom contact the lift never arrives, so it burned
    // the whole timeout and ignored the candidate's actual presses.
    delay(500);
    reportProgress(prompt);
  }

  reportResult("FAIL", attempts ? "No clean read — try a different finger"
                                : "Timed out waiting for a finger");
  return false;
}

// Prompts for each stored position. The AS608 merges only two scans into one
// template, so several positions cannot become a single richer model the way
// they do on a phone. Instead each position becomes its own template and the
// server maps them all to the same roll -- fingerFastSearch scans every
// template, so whichever angle the candidate presents can match.
const char* POSITION_PROMPT[] = {
  "Place your finger FLAT and centred",
  "Same finger, rolled slightly LEFT",
  "Same finger, rolled slightly RIGHT",
  "Same finger, using the TIP",
  "Same finger, using the LOWER pad",
};

bool enrollOnePosition(uint8_t id, const char* prompt);

void doEnrollMulti(uint8_t startId, uint8_t passes) {
  if (passes < 1) passes = 1;
  if (passes > 5) passes = 5;
  Serial.printf("Enrolling %d position(s) from template #%d\n", passes, startId);
  setLED(true, false, true);              // magenta = enrolling
  beep(80);

  String stored = "";
  uint8_t ok = 0;

  for (uint8_t i = 0; i < passes; i++) {
    uint8_t id = startId + i;
    char prompt[96];
    snprintf(prompt, sizeof(prompt), "%s  (%d of %d)",
             POSITION_PROMPT[i], i + 1, passes);

    if (!enrollOnePosition(id, prompt)) {
      // captureInto() has already reported the failure detail.
      if (ok == 0) return;                // nothing usable at all
      break;                              // keep what we have
    }
    if (stored.length()) stored += ",";
    stored += String(id);
    ok++;
    Serial.printf("  position %d stored as #%d\n", i + 1, id);
  }

  setLED(false, true, false);
  beep(150);
  String detail = "Enrolled " + String(ok) + " of " + String(passes) + " positions";
  String body = "status=OK&detail=" + detail +
                "&templates=" + String(templateCount()) +
                "&stored=" + stored;
  postForm("/device/result", body);
  delay(600);
}

// One position: two scans merged into a single template, stored at `id`.
bool enrollOnePosition(uint8_t id, const char* prompt) {
  if (!captureInto(1, prompt)) return false;

  reportProgress("Lift your finger");
  beep(60);
  delay(1200);
  unsigned long start = millis();
  while (finger.getImage() != FINGERPRINT_NOFINGER) {
    if (millis() - start > LIFT_TIMEOUT_MS) break;   // sensor may be reporting
    delay(100);                                      // phantom contact; carry on
  }

  if (!captureInto(2, "Same position again, please")) return false;

  reportProgress("Building the template");
  if (finger.createModel() != FINGERPRINT_OK) {
    reportResult("FAIL", "The two scans did not match — start again");
    beepPattern(2, 80, 100);
    return false;
  }

  if (finger.storeModel(id) != FINGERPRINT_OK) {
    reportResult("FAIL", "Sensor refused to store the template");
    beepPattern(2, 80, 100);
    return false;
  }
  return true;
}

void doDelete(uint8_t id) {
  Serial.printf("Deleting template #%d\n", id);
  setLED(true, false, true);
  if (finger.deleteModel(id) == FINGERPRINT_OK) {
    beep(100);
    reportResult("OK", "Deleted template #" + String(id));
  } else {
    beepPattern(2, 80, 100);
    reportResult("FAIL", "Sensor could not delete template #" + String(id));
  }
}

void doEmpty() {
  Serial.println("Emptying the whole fingerprint database");
  setLED(true, false, true);
  if (finger.emptyDatabase() == FINGERPRINT_OK) {
    beepPattern(2, 100, 100);
    reportResult("OK", "Sensor wiped");
  } else {
    reportResult("FAIL", "Sensor refused to wipe");
  }
}

// Samples the sensor with (hopefully) nothing on it. A healthy AS608 answers
// NOFINGER every time on an empty platen; anything else means it is seeing
// something that is not a finger -- almost always a smudge or moisture film,
// which is also what makes real prints fail feature extraction.
void doSelfTest() {
  Serial.println("Sensor self-test — keep the sensor CLEAR");
  setLED(true, false, true);
  reportProgress("Take everything off the sensor");
  delay(1500);

  int noFinger = 0, gotImage = 0, other = 0;
  for (int i = 0; i < 20; i++) {
    uint8_t p = finger.getImage();
    if      (p == FINGERPRINT_NOFINGER) noFinger++;
    else if (p == FINGERPRINT_OK)       gotImage++;
    else                                other++;
    delay(100);
  }

  Serial.printf("  clear=%d  phantom=%d  error=%d (of 20)\n",
                noFinger, gotImage, other);

  String detail;
  if (noFinger >= 18) {
    detail = "Sensor clean — " + String(noFinger) + "/20 reads clear";
  } else if (gotImage >= 3) {
    detail = "PHANTOM CONTACT: " + String(gotImage) + "/20 reads saw a finger "
             "on an empty sensor. Clean the glass with isopropyl and retest.";
  } else {
    detail = "Unstable: clear=" + String(noFinger) + " phantom=" +
             String(gotImage) + " error=" + String(other) + " of 20";
  }
  reportResult(noFinger >= 18 ? "OK" : "FAIL", detail);
  beep(80);
}

// Checks for a queued command and runs it. Returns true if one was handled.
bool pollCommand() {
  String body = getPath("/device/command");
  if (body.length() == 0) return false;

  JsonDocument doc;
  if (deserializeJson(doc, body)) return false;

  const char* cmd = doc["cmd"] | "NONE";
  if (strcmp(cmd, "NONE") == 0) return false;

  uint8_t id     = (uint8_t) (doc["templateId"] | 0);
  uint8_t passes = (uint8_t) (doc["passes"] | 1);
  enterState(ENROLLING);                  // blocks the gate while we work

  if      (strcmp(cmd, "ENROLL") == 0) doEnrollMulti(id, passes);
  else if (strcmp(cmd, "DELETE") == 0) doDelete(id);
  else if (strcmp(cmd, "EMPTY")  == 0) doEmpty();
  else if (strcmp(cmd, "SELFTEST") == 0) doSelfTest();
  else reportResult("FAIL", "Unknown command " + String(cmd));

  waitForFingerLift();
  enterState(COOLDOWN);
  return true;
}

// ============ FINGERPRINT ============
// Returns: template ID (>0) on match, 0 if a finger is present but unmatched,
//         -1 if no finger present, -2 on capture/convert error
int scanFingerprint() {
  uint8_t p = finger.getImage();
  if (p == FINGERPRINT_NOFINGER) return -1;

  // Only report the FIRST failure of a contact episode. An empty platen can
  // still return OK from getImage() and then fail feature extraction, forever
  // -- printing every one of those buried the real output.
  if (p != FINGERPRINT_OK) {
    if (failedReads == 0) Serial.printf("  Image capture failed (0x%02X)\n", p);
    return -2;
  }

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    if (failedReads == 0) {
      Serial.printf("  Couldn't read that print (0x%02X) — press flat and firm, "
                    "cover the whole sensor\n", p);
    }
    return -2;
  }

  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_NOTFOUND) return 0;
  if (p != FINGERPRINT_OK) return -2;

  return finger.fingerID;
}

// ============ SERVER CALL ============
String verifyWithServer(int templateId, int confidence) {
  String body = "templateId=" + String(templateId) +
                "&fpConfidence=" + String(confidence);
  String response = postForm("/fingerprint/identify", body);
  if (response.length() == 0) return "ERROR";

  Serial.println("  Server: " + response);

  JsonDocument doc;
  if (deserializeJson(doc, response)) {
    Serial.println("  Malformed JSON from server");
    return "ERROR";
  }

  const char* name = doc["name"] | "";
  const char* roll = doc["roll"] | "";
  if (strlen(roll)) Serial.printf("  Candidate: %s (%s)\n", name, roll);

  const char* result = doc["result"] | "ERROR";
  return String(result);
}

// ============ SETUP ============
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== VMS Gate Terminal (fingerprint) booting ===");
  Serial.println("Firmware " FW_VERSION);

  pinMode(LED_R_PIN, OUTPUT);
  pinMode(LED_G_PIN, OUTPUT);
  pinMode(LED_B_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  setLED(false, false, false);

  gateServo.setPeriodHertz(50);
  gateServo.attach(SERVO_PIN, 500, 2400);
  gateServo.write(SERVO_CLOSED);

  fpSerial.begin(57600, SERIAL_8N1, FP_RX_PIN, FP_TX_PIN);
  finger.begin(57600);
  delay(200);
  if (!finger.verifyPassword()) {
    Serial.println("!! Fingerprint sensor NOT found. Halting.");
    while (true) {                        // fast red blink = sensor fault
      setLED(true, false, false); delay(300);
      setLED(false, false, false); delay(300);
    }
  }
  Serial.printf("Fingerprint OK — %d templates enrolled\n", templateCount());

  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);                   // keeps request latency predictable
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    setLED(false, false, true); delay(150);
    setLED(false, false, false); delay(150);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi OK. IP: "); Serial.println(WiFi.localIP());
    Serial.printf("Gateway: %s\n", SERVER_BASE);
    sendHeartbeat();                      // register with the portal at once
    beep(100);
  } else {
    Serial.println("WiFi FAILED — will retry on each scan");
  }

  Serial.println("Ready.\n");
  enterState(IDLE);
}

// ============ LOOP ============
void loop() {
  unsigned long now = millis();
  unsigned long elapsed = now - stateEnteredAt;

  // Heartbeat runs in every state so the portal never shows a false "offline".
  if (now - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = now;
    if (state == IDLE || state == COOLDOWN) sendHeartbeat();
  }

  switch (state) {

    case IDLE: {
      setLED(false, false, true);          // blue = ready

      // Portal commands take priority over scans — an operator mid-enrolment
      // does not want a passing finger opening the gate.
      if (now - lastCmdPoll >= CMD_POLL_MS) {
        lastCmdPoll = now;
        if (pollCommand()) break;
      }

      int id = scanFingerprint();

      if (id > 0) {
        int conf = finger.confidence;
        Serial.printf("Local match: template #%d, raw confidence %d\n", id, conf);
        setLED(true, true, false);         // yellow = verifying
        String result = verifyWithServer(id, conf);

        if (result == "MATCH") {
          enterState(MATCH_OK);
        } else if (result == "ERROR") {
          // Local biometrics were fine — this is a network fault, not a
          // candidate problem. Say so rather than implying malpractice.
          Serial.println("  Server unreachable");
          enterState(OPEN_GATE_IF_SERVER_DOWN ? MATCH_OK : FLAGGED);
        } else {
          enterState(FLAGGED);             // INCONCLUSIVE / anything unexpected
        }

      } else if (id == 0) {
        Serial.println("Finger present, not enrolled on this sensor");
        setLED(true, true, false);
        verifyWithServer(0, 0);            // still log the attempt
        enterState(UNKNOWN_FP);

      } else if (id == -2) {
        // Unreadable contact. Back off progressively and stay silent -- the
        // message was already printed once for this episode. Deliberately no
        // waitForFingerLift() here: if the sensor is reporting phantom
        // contact, that would block for its whole timeout on every pass.
        failedReads++;
        delay(failedReads > 4 ? 1000 : 300);

      } else {
        failedReads = 0;                   // id == -1, the sensor is clear
      }
      break;
    }

    case MATCH_OK: {
      setLED(false, true, false);          // green
      beep(150);
      openGate();
      waitForFingerLift();
      enterState(COOLDOWN);
      break;
    }

    case FLAGGED: {
      setLED(true, false, false);          // red
      beepPattern(3, 200, 150);
      delay(800);
      waitForFingerLift();
      enterState(COOLDOWN);
      break;
    }

    case UNKNOWN_FP: {
      setLED(true, false, false);          // red
      beepPattern(2, 80, 100);
      delay(800);
      waitForFingerLift();
      enterState(COOLDOWN);
      break;
    }

    case ENROLLING:                        // pollCommand() drives this state
      break;

    case COOLDOWN: {
      setLED(false, false, false);
      if (elapsed >= COOLDOWN_MS) {
        Serial.println("Ready.\n");
        enterState(IDLE);
      }
      break;
    }

    default: enterState(IDLE);
  }

  delay(50);   // 20Hz poll — plenty for a fingerprint sensor
}
