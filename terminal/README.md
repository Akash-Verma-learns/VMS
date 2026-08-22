# VMS Gate Terminal — fingerprint

Fingerprint-only build. No face recognition, no ESP32-CAM, no dlib.

```
ESP32 DevKit + AS608   --HTTP-->   laptop (server.py)   --HTTP-->   VMS API :3001
   local match                     template -> roll                 dashboard
```

The AS608 decides the biometric match on-sensor. The laptop maps the template
to a candidate, answers the gate, and logs the event to the VMS afterwards.

## Layout

```
terminal/
├── firmware/main/main.ino    flash to the ESP32 DevKit V1
└── server/
    ├── server.py             FastAPI gateway + operator portal
    ├── static/admin.html     the portal page
    ├── roster.json           template_id -> roll/name  (hot-reloaded)
    ├── requirements.txt
    └── .env.example          copy to .env
```

`enroll.ino`, `fp_test.ino` and `hw_test.ino` from the handoff bundle are
unchanged and still valid — same pinout, no re-wiring between sketches.

## Run the server

```bash
cd server
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env        # then fill it in
.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` is required or the ESP32 cannot reach it. Confirm from your
phone on the same wifi: `http://<laptop-ip>:8000/ping` → `{"ok": true}`.
macOS firewall blocks this by default; allow Python when prompted.

Laptop LAN IP: `ipconfig getifaddr en0`

The startup banner reports the roster, the token role and expiry, and whether
the exam/venue UUIDs resolve. Read it — it is where every misconfiguration
shows up.

## Flash the firmware

Fill in `WIFI_SSID`, `WIFI_PASSWORD` and `SERVER_URL` at the top of
`firmware/main/main.ino`, then upload as ESP32 Dev Module on
`/dev/cu.usbserial-0001`. Close the Serial Monitor before uploading.

## The operator portal

Open **http://localhost:8000/** once the server is running. One page, polling
once a second:

- **Terminal** — whether the ESP32 is connected, its IP, MAC, firmware version
  and how many templates are on the sensor. There is nothing to pair: the
  device registers itself on boot and heartbeats every 5s. It shows as offline
  if nothing arrives for 25s.
- **VMS link** — whether logging is on, the token's role, and **how many hours
  until it expires**. Check this before the demo rather than discovering a dead
  token mid-run.
- **Add a fingerprint** — type a roll number and name, click, and the candidate
  places their finger twice at the terminal. Live prompts ("Place finger",
  "Lift your finger", "Place the SAME finger again") so you are not reading a
  serial monitor while talking to a judge.
- **Enrolled candidates** — the roster, with per-row delete and a guarded
  "wipe sensor".
- **Activity** — every scan, enrolment and VMS error, colour-coded.

### Enrolling someone

1. Portal → roll number + name → **Start enrolment**.
2. Candidate places the finger, lifts, places the same finger again.
3. The roster is written only after the sensor confirms it stored the template.

No re-flashing, no `enroll.ino`, no serial monitor. `enroll.ino` still works if
you prefer it — add the mapping to `roster.json` by hand afterwards, and the
server picks the change up without a restart.

### How the device protocol works

The ESP32 is an HTTP client on a DHCP address, so the laptop cannot push to it.
Instead the device polls for work while idle:

| Direction | Endpoint | Purpose |
|---|---|---|
| ESP32 → laptop | `POST /device/hello` | heartbeat: ip, mac, template count, firmware |
| ESP32 → laptop | `GET /device/command` | one queued command, or `NONE` |
| ESP32 → laptop | `POST /device/progress` | step text for the portal to display |
| ESP32 → laptop | `POST /device/result` | `OK`/`FAIL` + detail |

Commands are `ENROLL`, `DELETE` and `EMPTY`, one at a time — a second request
while one is running returns 409. Portal commands take priority over scans, so
a passing finger cannot open the gate mid-enrolment. A failed enrolment leaves
the roster untouched; the roster only changes when the sensor confirms.

The device endpoints are unauthenticated, which is fine on a demo LAN and
wrong for anything real. If this went further, they would need a shared secret.

## Gate behaviour

| Sensor result | Server result | LED | Buzzer | Gate | VMS |
|---|---|---|---|---|---|
| Template on roster, score ≥ 50 | `MATCH` | green | 1 × 150ms | opens 3s | `MATCH`, unflagged |
| Template on roster, score < 50 | `INCONCLUSIVE` | red | 3 × 200ms | closed | `INCONCLUSIVE`, flagged |
| Finger not enrolled on sensor | `NO_FINGERPRINT` | red | 2 × 80ms | closed | `NO_MATCH` under roll `UNKNOWN`, flagged |
| Laptop unreachable | `ERROR` | red | 3 × 200ms | closed | not logged |

Fail-closed on a server error is deliberate; flip `OPEN_GATE_IF_SERVER_DOWN`
in the firmware if you would rather the gate open when the laptop is missing.

### Confidence mapping

The AS608 reports a raw match score, not a percentage — a good match commonly
lands between 50 and 200. The VMS auto-flags any record below 70, so raw
scores are mapped onto `[70, 99]` such that our accept threshold and the VMS
flag threshold coincide exactly. Anything admitted reads as unflagged;
anything refused reads as flagged. Tune `FP_MIN_CONFIDENCE` to be stricter.

## VMS wiring

`server.py` posts to `POST /api/faceauth/ingest`, which needs:

- **an ASO bearer token** — `requireRole('ASO')`, nothing else works
- **real `examId` and `venueId` UUIDs** — both are `ON DELETE RESTRICT`
  foreign keys, so a wrong value makes every ingest fail

Getting a token: log in as `aso@upsc.gov.in` in the web portal, read the OTP
from the API terminal (`[DEV] OTP for …`), then copy `token` from the
verify-otp response. Paste it into `.env` as `VMS_JWT`.

> **The VMS allows one session per user.** `verifyOtpAndLogin` deletes every
> existing session for that user before creating a new one. If anyone logs in
> as ASO in a browser while the gateway is running, the gateway's token is
> invalidated instantly and every ingest starts returning 401. Either keep the
> browser logged in as US/DS to watch the dashboard, or create a second ASO
> user for the terminal. Tokens last 8 hours, not 24.

Logging is best-effort and runs in a background task: the gate decision is
returned to the ESP32 before the VMS is contacted, so a down backend, an
expired token, or a slow network cannot wedge the gate. Set `GATE_OFFLINE=1`
to skip VMS logging entirely.

## Two portals, on purpose

- **Terminal portal** (`localhost:8000`) — device pairing, enrolment, roster.
  Operator tooling. Lives with the gateway because it is the only thing that
  can talk to the sensor, and it must keep working when the VMS is down.
- **VMS web portal** (`localhost:5173`) — officer views:
  - **Gate Feed** (`/gate`) — every scan as it lands, polled every 2s. This is
    the demo screen.
  - **Face Auth** (`/faceauth`) — the existing review queue, flagged records
    only, US/DS can set a case status.

## Demo without a working backend

```bash
GATE_OFFLINE=1 .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000
```

Gate, LED, buzzer and servo all behave normally; nothing is logged. Worth
rehearsing at least once, because it is the fallback if the venue wifi or the
Neon database is unreachable on the day.
