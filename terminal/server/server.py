"""
VMS Gate Terminal -- fingerprint gateway + operator portal
===========================================================
Runs on the laptop. Three jobs:

  1. Gate decisions   -- the ESP32 POSTs a template id, we map it to a
                         candidate and answer MATCH / INCONCLUSIVE /
                         NO_FINGERPRINT fast enough that the gate feels instant.
  2. Device control   -- enrol and delete fingerprints from a browser instead
                         of re-flashing enroll.ino and squinting at a serial
                         monitor.
  3. VMS logging      -- best effort, in the background, never blocking the gate.

Fingerprint only: no face recognition, no ESP32-CAM, no dlib.

Why a command queue
-------------------
The ESP32 is an HTTP client on a DHCP address; the laptop cannot reliably push
to it. So the device polls GET /device/command while idle and executes whatever
is waiting. That works through NAT, survives the ESP32 changing IP, and needs
no discovery protocol.

Install:  pip install -r requirements.txt
Run:      uvicorn server:app --host 0.0.0.0 --port 8000
Portal:   http://localhost:8000/
"""

from __future__ import annotations

import base64
import json
import os
import sys
import threading
import time
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import requests
from fastapi import BackgroundTasks, FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent

# Face verification is optional: the gate must keep working on fingerprint
# alone if the models are absent or OpenCV will not import.
try:
    import face as face_engine
    FACE_AVAILABLE = face_engine.models_available()
    FACE_IMPORT_ERROR = ""
except Exception as _exc:            # noqa: BLE001 - report, never crash the gate
    face_engine = None
    FACE_AVAILABLE = False
    FACE_IMPORT_ERROR = str(_exc)

# Line-buffer stdout so the scan log stays readable when piped to a file or
# to tee -- Python block-buffers by default whenever stdout is not a TTY.
sys.stdout.reconfigure(line_buffering=True)

# ---------------------------------------------------------------- config ----

def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv(BASE_DIR / ".env")

VMS_BASE_URL = os.environ.get("VMS_BASE_URL", "http://localhost:3001").rstrip("/")
VMS_JWT      = os.environ.get("VMS_JWT", "").strip()
EXAM_ID      = os.environ.get("VMS_EXAM_ID", "").strip()
VENUE_ID     = os.environ.get("VMS_VENUE_ID", "").strip()
OFFLINE      = os.environ.get("GATE_OFFLINE", "0") == "1"
ROSTER_PATH  = Path(os.environ.get("ROSTER_PATH", str(BASE_DIR / "roster.json")))
CONTEXT_PATH = Path(os.environ.get("CONTEXT_PATH", str(BASE_DIR / "context.json")))

# Pi Zero 2 capture endpoint. Empty disables the face factor entirely.
CAM_URL      = os.environ.get("CAM_URL", "").strip()

# --- Confidence mapping ------------------------------------------------------
# The AS608 reports a raw match score, NOT a percentage -- a perfectly good
# match commonly lands in the 50-200 range. The VMS ingest controller auto-flags
# any record below 70, so passing the raw score straight through would flag
# legitimate entries as suspected malpractice.
#
# We map [FP_MIN_CONFIDENCE, FP_FULL_CONFIDENCE] onto [VMS_FLAG_THRESHOLD, 99]
# so our accept threshold and the VMS flag threshold coincide exactly.
FP_MIN_CONFIDENCE  = 50
FP_FULL_CONFIDENCE = 150
VMS_FLAG_THRESHOLD = 70

# Sensor capacity. AS608 modules are commonly 127 or 162; enroll.ino uses 1-127.
MAX_TEMPLATE_ID = 127

# Device is considered offline if we have not heard from it in this long.
DEVICE_TIMEOUT_S = 25

# Results the ESP32 firmware understands.
R_MATCH          = "MATCH"           # green, gate opens
R_INCONCLUSIVE   = "INCONCLUSIVE"    # red, 3 beeps, gate stays shut
R_NO_FINGERPRINT = "NO_FINGERPRINT"  # red, 2 beeps -- finger seen, not enrolled

# Values accepted by the VMS AuthResult enum. NO_FINGERPRINT is NOT one of them;
# sending it makes Prisma reject the whole ingest transaction.
VMS_RESULTS = {"MATCH", "NO_MATCH", "INCONCLUSIVE", "NOT_CAPTURED"}

# ------------------------------------------------------------ shared state ---

_lock = threading.RLock()

_roster: dict[int, dict[str, str]] = {}
_roster_mtime: float = 0.0

# Last thing the ESP32 told us about itself.
_device: dict[str, Any] = {
    "mac": None, "ip": None, "templates": None,
    "version": None, "last_seen": None,
}

# Single-slot command queue. The device polls this while idle.
#   state: IDLE -> QUEUED -> RUNNING -> DONE | FAILED
_command: dict[str, Any] = {
    "cmd": None, "templateId": None, "roll": None, "name": None, "passes": 1,
    "seat": "", "venueId": "", "venue": "", "city": "",
    "state": "IDLE", "message": "", "updated": None,
}

# Recent activity, newest first, for the portal.
_scans: deque = deque(maxlen=60)

# Which exam and venue this terminal is standing at. Chosen once from the PWA
# and persisted, so a restart mid-exam does not lose it.
_context: dict[str, Any] = {
    "examId": EXAM_ID, "examName": "", "examCode": "",
    "venueId": VENUE_ID, "venueName": "", "cityName": "",
}


def load_context() -> dict[str, Any]:
    global _context
    with _lock:
        if CONTEXT_PATH.exists():
            try:
                saved = json.loads(CONTEXT_PATH.read_text())
                if isinstance(saved, dict):
                    _context.update({k: str(v or "") for k, v in saved.items()
                                     if k in _context})
            except json.JSONDecodeError:
                print("WARN: context.json is not valid JSON — ignoring it")
        return dict(_context)


def save_context(ctx: dict[str, Any]) -> dict[str, Any]:
    global _context
    with _lock:
        for key in _context:
            if key in ctx:
                _context[key] = str(ctx[key] or "")
        CONTEXT_PATH.write_text(json.dumps(_context, indent=2) + "\n")
        return dict(_context)


def active_exam_id() -> str:
    return _context.get("examId") or EXAM_ID


def active_venue_id() -> str:
    return _context.get("venueId") or VENUE_ID


def _now() -> float:
    return time.time()


def _stamp() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _log_event(kind: str, text: str) -> None:
    with _lock:
        _scans.appendleft({"at": _stamp(), "kind": kind, "text": text})


# ---------------------------------------------------------------- roster ----

def load_roster(force: bool = False) -> dict[int, dict[str, str]]:
    """Read roster.json, reloading only when the file changed on disk."""
    global _roster, _roster_mtime
    with _lock:
        try:
            mtime = ROSTER_PATH.stat().st_mtime
        except FileNotFoundError:
            if force or not _roster:
                print(f"WARN: no roster at {ROSTER_PATH} -- every scan reads as unenrolled")
            return _roster

        if not force and mtime == _roster_mtime:
            return _roster

        try:
            raw = json.loads(ROSTER_PATH.read_text())
        except json.JSONDecodeError as exc:
            print(f"WARN: roster.json is not valid JSON ({exc}) -- keeping previous roster")
            return _roster

        parsed: dict[int, dict[str, str]] = {}
        for key, value in raw.items():
            if key.startswith("_"):
                continue
            try:
                template_id = int(key)
            except ValueError:
                print(f"WARN: roster key {key!r} is not a template id, skipping")
                continue
            if not isinstance(value, dict) or "roll" not in value:
                print(f"WARN: roster entry {key!r} has no 'roll', skipping")
                continue
            parsed[template_id] = {
                "roll":    str(value["roll"]),
                "name":    str(value.get("name", "")),
                "seat":    str(value.get("seat", "")),
                "venue":   str(value.get("venue", "")),
                "city":    str(value.get("city", "")),
                # Per-candidate venue wins over the terminal default, so one
                # gateway can serve two gates at different venues if needed.
                "venueId": str(value.get("venueId", "")),
            }

        _roster, _roster_mtime = parsed, mtime
        return _roster


def save_roster(roster: dict[int, dict[str, str]]) -> None:
    """Write roster.json, preserving the leading comment key."""
    global _roster, _roster_mtime
    with _lock:
        out: dict[str, Any] = {
            "_comment": "Managed by the terminal portal at http://localhost:8000/ "
                        "-- hand edits are fine, the server reloads on change.",
        }
        for template_id in sorted(roster):
            out[str(template_id)] = roster[template_id]
        ROSTER_PATH.write_text(json.dumps(out, indent=2) + "\n")
        _roster = dict(roster)
        _roster_mtime = ROSTER_PATH.stat().st_mtime


def next_free_template_ids(roster: dict[int, dict[str, str]], count: int) -> list[int]:
    """Lowest `count` unused ids, so deleting and re-adding reuses the gaps."""
    free = [i for i in range(1, MAX_TEMPLATE_ID + 1) if i not in roster]
    if len(free) < count:
        raise HTTPException(400, f"Only {len(free)} of {MAX_TEMPLATE_ID} template "
                                 f"slots are free; {count} needed")
    return free[:count]


# ------------------------------------------------------------ confidence ----

def normalise_confidence(raw: int) -> float:
    """Map a raw AS608 score onto the 0-100 scale the VMS stores."""
    if raw >= FP_FULL_CONFIDENCE:
        return 99.0
    if raw < FP_MIN_CONFIDENCE:
        # Rejected scores land one point below the flag threshold, so the VMS
        # flags them. Note the strict `<`: it has to agree exactly with the
        # accept test in identify(), or a score of precisely FP_MIN_CONFIDENCE
        # opens the gate while being logged as flagged.
        return float(VMS_FLAG_THRESHOLD - 1)
    span = FP_FULL_CONFIDENCE - FP_MIN_CONFIDENCE
    frac = (raw - FP_MIN_CONFIDENCE) / span
    return round(VMS_FLAG_THRESHOLD + frac * (99 - VMS_FLAG_THRESHOLD), 1)


# ------------------------------------------------------------------- VMS ----

def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {VMS_JWT}", "Content-Type": "application/json"}


def jwt_payload(token: str) -> Optional[dict]:
    """Decode a JWT payload without verifying -- we only need role and exp."""
    try:
        part = token.split(".")[1]
        part += "=" * (-len(part) % 4)
        return json.loads(base64.urlsafe_b64decode(part))
    except Exception:
        return None


def vms_ready() -> bool:
    return not OFFLINE and bool(VMS_JWT and active_exam_id() and active_venue_id())


def forward_to_vms(roll: str, vms_result: str, confidence: float,
                   venue_id: str = "") -> None:
    """Best-effort log. Never raises -- the gate has already acted."""
    if not vms_ready():
        if not OFFLINE:
            print("[VMS] skipped -- VMS_JWT / VMS_EXAM_ID / VMS_VENUE_ID not all set")
        return
    if vms_result not in VMS_RESULTS:
        print(f"[VMS] refusing to send invalid matchResult {vms_result!r}")
        return

    record = {
        "examId": active_exam_id(),
        "venueId": venue_id or active_venue_id(),
        "candidateRollNo": roll,
        "matchConfidence": confidence,
        "matchResult": vms_result,
    }
    try:
        resp = requests.post(f"{VMS_BASE_URL}/api/faceauth/ingest",
                             json=[record], headers=_auth_headers(), timeout=5)
    except requests.RequestException as exc:
        print(f"[VMS] unreachable ({exc}) -- gate decision already sent, event not logged")
        _log_event("vms", "VMS unreachable, entry not logged")
        return

    if resp.status_code == 201:
        body = resp.json()
        print(f"[VMS] logged roll={roll} {vms_result} flagged={body.get('flagged')}")
    elif resp.status_code == 401:
        print("[VMS] 401 -- token expired or superseded by a browser login. See README.")
        _log_event("vms", "VMS rejected the token (401)")
    elif resp.status_code == 403:
        print("[VMS] 403 -- ingest requires an ASO token; this one is a different role.")
        _log_event("vms", "VMS rejected the token (403, not ASO)")
    else:
        print(f"[VMS] ingest failed {resp.status_code}: {resp.text[:200]}")
        _log_event("vms", f"VMS ingest failed ({resp.status_code})")


# -------------------------------------------------------------- preflight ----

def preflight() -> None:
    print("\n=== VMS Gate Terminal -- fingerprint gateway ===")

    roster = load_roster(force=True)
    if roster:
        print(f"Roster ({len(roster)} enrolled) from {ROSTER_PATH.name}:")
        for template_id, person in sorted(roster.items()):
            print(f"  template #{template_id:<3} -> {person['roll']}  {person['name'] or '(unnamed)'}")
    else:
        print(f"Roster EMPTY -- enrol someone from the portal")

    print(f"Accept threshold: raw AS608 score >= {FP_MIN_CONFIDENCE} "
          f"(maps to {VMS_FLAG_THRESHOLD}% and up)")
    print("Portal: http://localhost:8000/")

    if OFFLINE:
        print("VMS logging: DISABLED (GATE_OFFLINE=1) -- local decisions only")
        print("=" * 47 + "\n")
        return

    missing = [n for n, v in (("VMS_JWT", VMS_JWT), ("VMS_EXAM_ID", EXAM_ID),
                              ("VMS_VENUE_ID", VENUE_ID)) if not v]
    if missing:
        print(f"VMS logging: DISABLED -- not set: {', '.join(missing)}")
        print("The gate still works; nothing will reach the dashboard.")
        print("=" * 47 + "\n")
        return

    payload = jwt_payload(VMS_JWT)
    if payload:
        role = payload.get("role")
        if role != "ASO":
            print(f"WARN: token role is {role!r}; ingest requires ASO -> every log will 403")
        exp = payload.get("exp")
        if exp:
            hours = (datetime.fromtimestamp(exp, timezone.utc)
                     - datetime.now(timezone.utc)).total_seconds() / 3600
            print("WARN: token has ALREADY EXPIRED -- log in again" if hours <= 0
                  else f"Token: role={role}, expires in {hours:.1f}h")
    else:
        print("WARN: VMS_JWT is not a decodable JWT")

    # examId and venueId are ON DELETE RESTRICT foreign keys -- a stale UUID
    # means every ingest 500s at the DB layer.
    try:
        resp = requests.get(f"{VMS_BASE_URL}/api/exams", headers=_auth_headers(), timeout=5)
    except requests.RequestException as exc:
        print(f"WARN: VMS unreachable at {VMS_BASE_URL} ({exc})")
        print("=" * 47 + "\n")
        return

    if resp.status_code == 401:
        print("WARN: VMS rejected the token (401) -- expired, or a browser login replaced it")
    elif resp.status_code != 200:
        print(f"WARN: GET /api/exams returned {resp.status_code}")
    else:
        match = next((e for e in resp.json() if e.get("id") == EXAM_ID), None)
        if match:
            print(f"Exam:  {match.get('name')} ({match.get('examCode')})")
        else:
            print(f"WARN: VMS_EXAM_ID {EXAM_ID} is not in the exam list -- ingest will fail")
        try:
            av = requests.get(f"{VMS_BASE_URL}/api/exams/{EXAM_ID}/assignments",
                              headers=_auth_headers(), timeout=5)
            if av.status_code == 200:
                venue_ids = {a.get("venueId") for a in av.json()}
                if VENUE_ID in venue_ids:
                    print(f"Venue: {VENUE_ID} confirmed on this exam")
                elif venue_ids:
                    print(f"WARN: VMS_VENUE_ID {VENUE_ID} is not assigned to this exam.")
                    print(f"      Assigned: {', '.join(sorted(v for v in venue_ids if v))}")
        except requests.RequestException:
            pass

    print("=" * 47 + "\n")


@asynccontextmanager
async def lifespan(_: FastAPI):
    preflight()
    yield


app = FastAPI(title="VMS Gate Terminal", lifespan=lifespan)

# The VMS PWA is served from :5174 and calls this gateway on :8000, so every
# request from it is cross-origin. Wide open is acceptable here and only here:
# this service is unauthenticated by design and lives on a demo LAN. If it ever
# left that LAN, the origins and the device endpoints both need locking down.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # no cookies, so "*" stays legal
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


# ==================================================================== gate ===

@app.get("/ping")
def ping() -> dict[str, bool]:
    """Reachability check -- open this from your phone to prove the LAN path."""
    return {"ok": True}


@app.post("/fingerprint/identify")
async def identify(
    background: BackgroundTasks,
    templateId: int = Form(...),
    fpConfidence: int = Form(0),
) -> dict[str, Any]:
    """Called by the ESP32 on every scan. Answers fast, logs afterwards."""
    roster = load_roster()
    person = roster.get(templateId) if templateId > 0 else None

    # --- Finger seen, but not enrolled --------------------------------------
    if person is None:
        print(f"[{_stamp()}] UNENROLLED  template={templateId} -> gate stays closed")
        _log_event("deny", f"Unenrolled finger (template {templateId}) refused")
        # candidateRollNo is NOT NULL, so unknown scans log under a sentinel
        # roll. NO_MATCH auto-flags, which is what we want for someone who is
        # not on the roster at all.
        background.add_task(forward_to_vms, "UNKNOWN", "NO_MATCH", 0.0)
        return {"result": R_NO_FINGERPRINT, "roll": None, "name": None,
                "seat": None, "venue": None, "city": None, "confidence": 0}

    roll, name = person["roll"], person["name"]
    seat, venue, city = person.get("seat", ""), person.get("venue", ""), person.get("city", "")
    venue_id = person.get("venueId", "")
    confidence = normalise_confidence(fpConfidence)
    where = f" seat {seat}" if seat else ""

    # --- Match too weak to trust ---------------------------------------------
    if fpConfidence < FP_MIN_CONFIDENCE:
        print(f"[{_stamp()}] WEAK        template={templateId} roll={roll} "
              f"raw={fpConfidence} < {FP_MIN_CONFIDENCE} -> INCONCLUSIVE")
        _log_event("flag", f"{roll} {name}{where} weak match ({fpConfidence}) -- flagged")
        background.add_task(forward_to_vms, roll, "INCONCLUSIVE", confidence, venue_id)
        return {"result": R_INCONCLUSIVE, "roll": roll, "name": name, "seat": seat,
                "venue": venue, "city": city, "confidence": confidence}

    # --- Second factor: face --------------------------------------------------
    # Fingerprint says who they claim to be; the camera checks it is actually
    # them. Skipped entirely when no camera is configured, so the gate keeps
    # its single-factor behaviour rather than failing closed on a missing Pi.
    face_info: dict[str, Any] = {}
    if CAM_URL and FACE_AVAILABLE:
        face_info = verify_face(roll)
        fr = face_info.get("result")

        if fr == "INCONCLUSIVE":
            # The impersonation catch: enrolled finger, different face.
            print(f"[{_stamp()}] FACE FAIL   template={templateId} roll={roll} "
                  f"{name} face={face_info.get('confidence')}% -> INCONCLUSIVE")
            _log_event("flag", f"{roll} {name}{where} FINGERPRINT OK but face did not "
                               f"match ({face_info.get('confidence')}%) -- flagged")
            background.add_task(forward_to_vms, roll, "INCONCLUSIVE",
                                float(face_info.get("confidence", 0.0)), venue_id)
            return {"result": R_INCONCLUSIVE, "roll": roll, "name": name, "seat": seat,
                    "venue": venue, "city": city,
                    "confidence": face_info.get("confidence", 0.0), "face": face_info}

        if fr == "NOT_CAPTURED":
            print(f"[{_stamp()}] NO FACE     roll={roll} {face_info.get('detail')}")
            _log_event("flag", f"{roll} {name}{where} no usable face captured -- flagged")
            background.add_task(forward_to_vms, roll, "NOT_CAPTURED", 0.0, venue_id)
            return {"result": R_INCONCLUSIVE, "roll": roll, "name": name, "seat": seat,
                    "venue": venue, "city": city, "confidence": 0.0, "face": face_info}

        if fr == "NO_REFERENCE":
            # No photo on file is an administrative gap, not the candidate's
            # fault, so admit on fingerprint alone and say so loudly. The data
            # check reports these before exam day precisely to avoid it.
            print(f"[{_stamp()}] NO PHOTO    roll={roll} -- admitted on fingerprint alone")
            _log_event("vms", f"{roll} {name}: no reference photo, single-factor entry")

    # --- Admitted -------------------------------------------------------------
    print(f"[{_stamp()}] MATCH       template={templateId} roll={roll} "
          f"{name} raw={fpConfidence} -> {confidence}%"
          + (f" face={face_info.get('confidence')}%" if face_info.get("result") == "MATCH" else ""))
    factors = "2 factors" if face_info.get("result") == "MATCH" else "fingerprint"
    _log_event("allow", f"{roll} {name}{where} admitted ({confidence}%, {factors})")
    background.add_task(forward_to_vms, roll, "MATCH", confidence, venue_id)
    return {"result": R_MATCH, "roll": roll, "name": name, "seat": seat,
            "venue": venue, "city": city, "confidence": confidence, "face": face_info}


def verify_face(roll: str) -> dict[str, Any]:
    """Pull one frame from the Pi and compare it to the reference photo."""
    try:
        resp = requests.get(CAM_URL, timeout=6)
        resp.raise_for_status()
    except requests.RequestException as exc:
        # A camera fault must not read as an impersonation. Say what happened.
        return {"result": "NOT_CAPTURED", "confidence": 0.0,
                "detail": f"camera unreachable: {exc.__class__.__name__}"}

    try:
        return face_engine.verify(resp.content, roll)
    except Exception as exc:            # noqa: BLE001 - never break the gate
        print(f"[{_stamp()}] FACE ERROR  {exc}")
        return {"result": "NOT_CAPTURED", "confidence": 0.0, "detail": str(exc)}


# ================================================================== device ===

@app.post("/device/hello")
def device_hello(
    mac: str = Form(""),
    ip: str = Form(""),
    templates: int = Form(-1),
    version: str = Form(""),
) -> dict[str, Any]:
    """Heartbeat. The ESP32 calls this on boot and every few seconds."""
    with _lock:
        first_time = _device["mac"] is None
        _device.update({"mac": mac, "ip": ip, "templates": templates,
                        "version": version, "last_seen": _now()})
        pending = _command["state"] == "QUEUED"
    if first_time:
        print(f"[{_stamp()}] DEVICE      connected: {ip} ({mac}), {templates} templates")
        _log_event("device", f"Terminal connected from {ip}")
    return {"ok": True, "hasCommand": pending}


@app.get("/device/command")
def device_command() -> dict[str, Any]:
    """Polled by the ESP32 while idle. Hands out at most one command."""
    with _lock:
        if _command["state"] != "QUEUED":
            return {"cmd": "NONE"}
        _command["state"] = "RUNNING"
        _command["message"] = "Sent to terminal"
        _command["updated"] = _now()
        return {"cmd": _command["cmd"],
                "templateId": _command["templateId"] or 0,
                "passes": _command["passes"] or 1}


@app.post("/device/progress")
def device_progress(message: str = Form("")) -> dict[str, bool]:
    """Step updates during enrolment, so the portal can prompt the candidate."""
    with _lock:
        if _command["state"] == "RUNNING":
            _command["message"] = message
            _command["updated"] = _now()
    return {"ok": True}


@app.post("/device/result")
def device_result(
    status: str = Form(...),          # OK | FAIL
    detail: str = Form(""),
    templates: int = Form(-1),
    stored: str = Form(""),           # comma-separated ids actually written
) -> dict[str, bool]:
    """Terminal reports the outcome of a command."""
    with _lock:
        cmd = _command["cmd"]
        template_id = _command["templateId"]
        roll = _command["roll"]
        name = _command["name"]
        if templates >= 0:
            _device["templates"] = templates

        if status == "OK":
            _command["state"] = "DONE"
            _command["message"] = detail or "Done"
        else:
            _command["state"] = "FAILED"
            _command["message"] = detail or "Failed"
        _command["updated"] = _now()

    # Only touch the roster once the sensor has actually confirmed the change.
    if status == "OK":
        roster = dict(load_roster())
        if cmd == "ENROLL" and template_id:
            # Map every position the sensor managed to store. A partial success
            # (2 of 3 positions) is still a usable enrolment, so we take what
            # we got rather than discarding the lot.
            ids = []
            for chunk in stored.split(","):
                chunk = chunk.strip()
                if chunk.isdigit():
                    ids.append(int(chunk))
            if not ids:
                ids = [template_id]
            for tid in ids:
                roster[tid] = {
                    "roll": roll or "", "name": name or "",
                    "seat": _command.get("seat", ""),
                    "venue": _command.get("venue", ""),
                    "city": _command.get("city", ""),
                    "venueId": _command.get("venueId", ""),
                }
            save_roster(roster)
            plural = "s" if len(ids) > 1 else ""
            listed = ", ".join(f"#{i}" for i in ids)
            print(f"[{_stamp()}] ENROLLED    template{plural} {listed} -> {roll} {name}")
            _log_event("enrol", f"Enrolled {roll} {name} — {len(ids)} print{plural} ({listed})")
        elif cmd == "DELETE" and template_id:
            roster.pop(template_id, None)
            save_roster(roster)
            print(f"[{_stamp()}] DELETED     template #{template_id}")
            _log_event("enrol", f"Deleted template #{template_id}")
        elif cmd == "EMPTY":
            save_roster({})
            print(f"[{_stamp()}] EMPTIED     all templates cleared")
            _log_event("enrol", "Cleared every template on the sensor")
    else:
        print(f"[{_stamp()}] CMD FAILED  {cmd}: {detail}")
        _log_event("error", f"{cmd} failed: {detail}")

    return {"ok": True}


# =================================================================== admin ===

class EnrolRequest(BaseModel):
    roll: str
    name: str = ""
    seat: str = ""
    venueId: str = ""
    venue: str = ""
    city: str = ""
    templateId: Optional[int] = None
    # The AS608 merges exactly two scans into one template -- there is no way
    # to fold several finger positions into a single model the way a phone
    # does. Instead we store each position as its own template and map them all
    # to the same roll: fingerFastSearch scans every template, so any one of
    # them matching admits the candidate.
    passes: int = 3


class TemplateRequest(BaseModel):
    templateId: int


class RosterEntry(BaseModel):
    templateId: int
    roll: str
    name: str = ""


def _device_online() -> bool:
    seen = _device["last_seen"]
    return bool(seen and (_now() - seen) < DEVICE_TIMEOUT_S)


def _require_idle() -> None:
    with _lock:
        if _command["state"] in ("QUEUED", "RUNNING"):
            raise HTTPException(409, f"Terminal is busy: {_command['cmd']} "
                                     f"({_command['message'] or _command['state']})")


def _queue(cmd: str, template_id: Optional[int] = None,
           roll: str = "", name: str = "", passes: int = 1, seat: str = "",
           venue_id: str = "", venue: str = "", city: str = "") -> dict[str, Any]:
    with _lock:
        _command.update({"cmd": cmd, "templateId": template_id, "roll": roll,
                         "name": name, "passes": passes, "seat": seat,
                         "venueId": venue_id, "venue": venue, "city": city,
                         "state": "QUEUED",
                         "message": "Waiting for the terminal to pick this up",
                         "updated": _now()})
        return dict(_command)


@app.get("/admin/state")
def admin_state() -> dict[str, Any]:
    """Everything the portal renders, in one poll."""
    roster = load_roster()
    payload = jwt_payload(VMS_JWT) if VMS_JWT else None
    expires_in_h = None
    if payload and payload.get("exp"):
        expires_in_h = round((datetime.fromtimestamp(payload["exp"], timezone.utc)
                              - datetime.now(timezone.utc)).total_seconds() / 3600, 1)
    with _lock:
        device = dict(_device)
        command = dict(_command)
        scans = list(_scans)
    device["online"] = _device_online()
    device["last_seen_ago"] = (round(_now() - device["last_seen"], 1)
                               if device["last_seen"] else None)
    return {
        "device": device,
        "command": command,
        "roster": [{"templateId": t, **p} for t, p in sorted(roster.items())],
        "context": load_context(),
        "activity": scans,
        "vms": {
            "base_url": VMS_BASE_URL,
            "logging_enabled": vms_ready(),
            "offline_mode": OFFLINE,
            "token_role": (payload or {}).get("role"),
            "token_expires_in_hours": expires_in_h,
            "exam_id": EXAM_ID or None,
            "venue_id": VENUE_ID or None,
        },
        "thresholds": {"fp_min_raw": FP_MIN_CONFIDENCE,
                       "fp_full_raw": FP_FULL_CONFIDENCE,
                       "vms_flag_below": VMS_FLAG_THRESHOLD},
    }


@app.post("/admin/enroll")
def admin_enroll(body: EnrolRequest) -> dict[str, Any]:
    """Queue an enrolment. The candidate places a finger twice at the terminal."""
    if not _device_online():
        raise HTTPException(503, "Terminal is offline -- check it is powered and on this wifi")
    _require_idle()

    roll = body.roll.strip()
    if not roll:
        raise HTTPException(400, "Roll number is required")

    passes = max(1, min(body.passes, 5))
    roster = load_roster()

    if body.templateId:
        if not 1 <= body.templateId <= MAX_TEMPLATE_ID:
            raise HTTPException(400, f"Template id must be between 1 and {MAX_TEMPLATE_ID}")
        if body.templateId in roster:
            raise HTTPException(409, f"Template #{body.templateId} is already used by "
                                     f"{roster[body.templateId]['roll']}")
        ids = [body.templateId]
        passes = 1
    else:
        ids = next_free_template_ids(roster, passes)

    # Duplicate rolls are allowed on purpose now: several templates per person
    # is exactly how accuracy is improved on this sensor.
    existing = sorted(t for t, p in roster.items() if p["roll"] == roll)
    if existing:
        print(f"[{_stamp()}] ENROL REQ   {roll} already has template(s) "
              f"{existing}; adding more")

    print(f"[{_stamp()}] ENROL REQ   templates {ids} for {roll} {body.name} "
          f"({passes} position{'s' if passes > 1 else ''})")
    ctx = load_context()
    return _queue("ENROLL", ids[0], roll, body.name.strip(), passes=passes,
                  seat=body.seat.strip(),
                  venue_id=body.venueId or ctx.get("venueId", ""),
                  venue=body.venue or ctx.get("venueName", ""),
                  city=body.city or ctx.get("cityName", ""))


@app.post("/admin/delete")
def admin_delete(body: TemplateRequest) -> dict[str, Any]:
    """Delete one template from the sensor, then from the roster."""
    if not _device_online():
        raise HTTPException(503, "Terminal is offline")
    _require_idle()
    # Deliberately NOT requiring the id to be on the roster: templates enrolled
    # by enroll.ino exist on the sensor with no roster entry, and those orphans
    # are exactly the ones you need to clear.
    if not 1 <= body.templateId <= MAX_TEMPLATE_ID:
        raise HTTPException(400, f"Template id must be between 1 and {MAX_TEMPLATE_ID}")
    return _queue("DELETE", body.templateId)


@app.post("/admin/empty")
def admin_empty() -> dict[str, Any]:
    """Wipe every template on the sensor. Destructive; the portal confirms first."""
    if not _device_online():
        raise HTTPException(503, "Terminal is offline")
    _require_idle()
    return _queue("EMPTY")


@app.post("/admin/selftest")
def admin_selftest() -> dict[str, Any]:
    """Ask the terminal to sample an empty sensor and report what it sees."""
    if not _device_online():
        raise HTTPException(503, "Terminal is offline")
    _require_idle()
    return _queue("SELFTEST")


@app.post("/admin/cancel")
def admin_cancel() -> dict[str, Any]:
    """Abandon a stuck command so the portal is usable again."""
    with _lock:
        _command.update({"state": "IDLE", "cmd": None, "templateId": None,
                         "roll": None, "name": None, "message": "Cancelled",
                         "updated": _now()})
        return dict(_command)


@app.post("/admin/roster")
def admin_roster_edit(body: RosterEntry) -> dict[str, Any]:
    """Attach a roll number to a template id. Upsert -- the sensor is untouched.

    This is how you adopt a template that already lives on the AS608 but has no
    roster entry, which is every finger enrolled through enroll.ino before the
    portal existed. Those scan fine and then get refused as NO_FINGERPRINT,
    because the gate can only admit a template it can name.
    """
    if not 1 <= body.templateId <= MAX_TEMPLATE_ID:
        raise HTTPException(400, f"Template id must be between 1 and {MAX_TEMPLATE_ID}")
    roll = body.roll.strip()
    if not roll:
        raise HTTPException(400, "Roll number is required")

    roster = dict(load_roster())
    # Several templates per roll is intentional -- that is how multi-position
    # enrolment works here -- so a repeated roll is not an error.
    existed = body.templateId in roster
    roster[body.templateId] = {"roll": roll, "name": body.name.strip()}
    save_roster(roster)
    verb = "Remapped" if existed else "Mapped"
    _log_event("enrol", f"{verb} template #{body.templateId} -> {roll}")
    return {"ok": True, "mapped": body.templateId}


# ============================================= VMS read-through proxies ====
# The PWA is used by VS / CS / IO, but the VMS restricts the candidate and
# venue lists to officer roles. Rather than loosening that RBAC, the gateway
# reads them with its own ASO token and passes the result to the phone. If no
# token is configured these degrade to empty lists and the UI falls back to
# typing a roll number by hand.

def _vms_get(path: str, params: Optional[dict] = None) -> Any:
    if not VMS_JWT:
        raise HTTPException(503, "No VMS token configured — set VMS_JWT in .env")
    try:
        r = requests.get(f"{VMS_BASE_URL}{path}", headers=_auth_headers(),
                         params=params or {}, timeout=6)
    except requests.RequestException as exc:
        raise HTTPException(502, f"VMS unreachable: {exc}")
    if r.status_code == 401:
        raise HTTPException(502, "VMS rejected the token — it expired, or a browser login replaced it")
    if r.status_code == 403:
        raise HTTPException(502, "VMS token lacks permission for this list")
    if r.status_code != 200:
        raise HTTPException(502, f"VMS returned {r.status_code}")
    return r.json()


@app.get("/vms/exams")
def vms_exams() -> list[dict[str, Any]]:
    return [{"id": e.get("id"), "name": e.get("name"), "examCode": e.get("examCode"),
             "status": e.get("status")} for e in _vms_get("/api/exams")]


@app.get("/vms/venues")
def vms_venues(examId: str) -> list[dict[str, Any]]:
    """Venues assigned to an exam, flattened for a phone-sized picker."""
    out, seen = [], set()
    for a in _vms_get(f"/api/exams/{examId}/assignments"):
        venue = a.get("venue") or {}
        vid = a.get("venueId") or venue.get("id")
        if not vid or vid in seen:
            continue
        seen.add(vid)
        out.append({
            "venueId": vid,
            "name": venue.get("name") or "(unnamed venue)",
            "city": venue.get("cityName") or "",
            "seats": a.get("seatsAllocated"),
        })
    return sorted(out, key=lambda v: (v["city"], v["name"]))


@app.get("/vms/candidates")
def vms_candidates(examId: str, venueId: str = "", q: str = "") -> list[dict[str, Any]]:
    """Candidates expected at this gate, from released admit cards.

    Scoped to the terminal's venue: an operator at Delhi should not be able to
    enrol someone allotted to Noida. Seat numbers come from the allotment, so
    they no longer have to be typed.

    Falls back to the raw preference list when nothing has been released yet --
    otherwise the picker would be empty before the admit cards are published
    and there would be no way to enrol anybody.
    """
    params: dict[str, Any] = {"status": "RELEASED"}
    if venueId:
        params["venueId"] = venueId
    if q.strip():
        params["q"] = q.strip()

    released_total = 0
    try:
        payload = _vms_get(f"/api/admit-cards/{examId}", params)
        if isinstance(payload, dict):
            records = payload.get("records", [])
            # Exam-wide count, unaffected by the venue/query filters above.
            released_total = (payload.get("summary") or {}).get("released", 0)
        else:
            records = []
    except HTTPException:
        records = []

    # Fall back ONLY when the exam has nothing released at all. Falling back
    # whenever the *filtered* result was empty leaked candidates from other
    # venues into this gate's picker, since the preference list has no venue.
    if released_total > 0:
        return [{
            "roll": str(r.get("rollNo", "")),
            "name": r.get("candidateName") or "",
            "seat": r.get("seatNo") or "",
            "venue": (r.get("venue") or {}).get("name") or "",
            "city": r.get("allottedCity") or "",
            "released": True,
        } for r in records][:50]

    if records:
        return [{
            "roll": str(r.get("rollNo", "")),
            "name": r.get("candidateName") or "",
            "seat": r.get("seatNo") or "",
            "venue": (r.get("venue") or {}).get("name") or "",
            "city": r.get("allottedCity") or "",
            "released": True,
        } for r in records][:50]

    needle = q.strip().lower()
    out = []
    for c in _vms_get("/api/candidates/preferences", {"examId": examId}):
        roll = str(c.get("rollNo", ""))
        name = c.get("candidateName") or ""
        if needle and needle not in roll.lower() and needle not in name.lower():
            continue
        out.append({"roll": roll, "name": name, "seat": "", "venue": "",
                    "city": "", "released": False})
    return out[:50]


@app.get("/admin/datacheck")
def admin_datacheck() -> dict[str, Any]:
    """Gate-side completeness check.

    The VMS cannot see any of this: fingerprint templates live on the sensor
    and the roll mapping lives in roster.json. These are the inconsistencies
    that only bite on exam morning, when a candidate is standing at the gate.
    """
    roster = load_roster()
    ctx = load_context()
    findings: list[dict[str, Any]] = []

    def add(fid, severity, title, detail, consequence, fix, samples):
        findings.append({"id": fid, "severity": severity, "title": title,
                         "detail": detail, "consequence": consequence,
                         "fix": fix, "count": len(samples), "samples": samples[:8]})

    # --- expected candidates, from released admit cards for this venue ------
    expected: dict[str, dict[str, str]] = {}
    vms_reachable = True
    if ctx.get("examId"):
        try:
            payload = _vms_get(f"/api/admit-cards/{ctx['examId']}",
                               {"status": "RELEASED", "venueId": ctx.get("venueId", "")})
            for r in (payload.get("records", []) if isinstance(payload, dict) else []):
                expected[str(r.get("rollNo", ""))] = {
                    "name": r.get("candidateName") or "",
                    "seat": r.get("seatNo") or "",
                }
        except HTTPException:
            vms_reachable = False
    else:
        vms_reachable = False

    enrolled_rolls = {p["roll"] for p in roster.values()}

    # --- 1. enrolled here but not on this venue's list ----------------------
    if vms_reachable and expected:
        strangers = sorted(r for r in enrolled_rolls if r not in expected)
        if strangers:
            add("roster-roll-unknown", "BLOCKER", "Enrolled roll not on this venue's list",
                f"{len(strangers)} enrolled roll(s) have no released admit card for this venue.",
                "The gate will admit them and log an entry against a roll the VMS cannot resolve, "
                "so the dashboard shows a verified entry for a candidate nobody can identify.",
                "Delete the print, or map it to the correct roll from the Roster tab.",
                strangers)

        # --- 2. expected but no fingerprint ---------------------------------
        missing = sorted(r for r in expected if r not in enrolled_rolls)
        if missing:
            add("candidate-not-enrolled", "WARNING", "Candidate has a card but no fingerprint",
                f"{len(missing)} of {len(expected)} candidate(s) for this venue have no enrolled print.",
                "They arrive holding a valid admit card and the gate refuses them, because the "
                "sensor has nothing to match. Every one of these is a queue at the door.",
                "Enrol them from the Terminal tab before exam day.",
                [f"{r} {expected[r]['name']}".strip() for r in missing])

    # --- 3. roster entries with no roll at all ------------------------------
    blank = sorted(str(t) for t, p in roster.items() if not p["roll"].strip())
    if blank:
        add("roster-blank-roll", "BLOCKER", "Print with no roll number",
            f"{len(blank)} print(s) are stored with an empty roll number.",
            "A match on these produces an entry with no candidate at all, which cannot be "
            "logged to the VMS and cannot be investigated afterwards.",
            "Map or delete them from the Roster tab.", blank)

    # --- 4. sensor holds more prints than the roster explains ---------------
    on_sensor = _device.get("templates")
    if isinstance(on_sensor, int) and on_sensor > len(roster):
        add("sensor-orphan-templates", "WARNING", "Sensor holds unmapped prints",
            f"The sensor reports {on_sensor} prints; the roster accounts for {len(roster)}.",
            "The extra prints match nobody. A candidate presenting one is refused with no "
            "explanation, and an impostor whose print was enrolled during testing may match.",
            "Use 'Map a template already on the sensor', or wipe and re-enrol.",
            [f"{on_sensor - len(roster)} unaccounted"])

    # --- 5. roster entries pinned to a different venue ----------------------
    if ctx.get("venueId"):
        wrong = sorted(p["roll"] for p in roster.values()
                       if p.get("venueId") and p["venueId"] != ctx["venueId"])
        if wrong:
            add("roster-venue-mismatch", "WARNING", "Print enrolled for another venue",
                f"{len(wrong)} print(s) are tagged with a different venue than this terminal.",
                "Their entries will be logged against the wrong hall, so the venue's attendance "
                "count will not reconcile.",
                "Re-enrol at the correct terminal, or re-point this terminal.", wrong)

    # --- 6. reference photos for the second biometric factor ---------------
    # Only meaningful once face verification is configured. A missing or
    # unusable reference photo does not fail loudly at enrolment -- it fails on
    # exam morning, as a refusal the candidate cannot argue with.
    if CAM_URL and FACE_AVAILABLE and expected:
        no_photo, bad_photo = [], []
        for roll, info in sorted(expected.items()):
            path = face_engine.photo_path(roll)
            if path is None:
                no_photo.append(f"{roll} {info['name']}".strip())
                continue
            _, res = face_engine.load_reference(roll)
            if not res.ok:
                bad_photo.append(f"{roll}: {res.reason}")

        if no_photo:
            add("face-no-reference", "WARNING", "Candidate has no reference photo",
                f"{len(no_photo)} of {len(expected)} candidate(s) have no photo on file.",
                "Face verification cannot run for them. With the camera enabled the gate "
                "falls back to fingerprint alone, so the second factor silently does not "
                "apply to exactly the people nobody checked.",
                f"Add candidates/<roll>.jpg for each, then re-run this check.",
                no_photo)

        if bad_photo:
            add("face-unusable-reference", "BLOCKER", "Reference photo cannot be used",
                f"{len(bad_photo)} reference photo(s) failed quality checks.",
                "An unusable reference does not error at the gate -- it produces a low "
                "similarity score against the real person, so a legitimate candidate is "
                "flagged for impersonation.",
                "Replace with a clear, front-facing, well-lit photo where the face is at "
                "least 80px across.",
                bad_photo)

    # --- 7. camera reachability --------------------------------------------
    if CAM_URL:
        if not FACE_AVAILABLE:
            add("face-engine-missing", "BLOCKER", "Camera configured but face engine unavailable",
                f"CAM_URL is set but the face models could not load. {FACE_IMPORT_ERROR}".strip(),
                "Every scan will fall through to fingerprint-only while the dashboard and the "
                "operator both believe two factors are in force.",
                "Download the ONNX models into terminal/server/models, or unset CAM_URL.", [])
        else:
            try:
                requests.get(CAM_URL, timeout=3).raise_for_status()
            except requests.RequestException as exc:
                add("camera-unreachable", "BLOCKER", "Camera not reachable",
                    f"No usable response from {CAM_URL} ({exc.__class__.__name__}).",
                    "Face verification will report NOT_CAPTURED for every candidate, which the "
                    "gate treats as a refusal -- so nobody gets in.",
                    "Power the Pi, confirm it is on this network, and open CAM_URL in a browser.",
                    [CAM_URL])

    # --- 8. no venue bound --------------------------------------------------
    if not ctx.get("venueId"):
        add("terminal-unbound", "BLOCKER", "Terminal is not bound to a venue",
            "No exam or venue has been selected for this gate.",
            "Every entry is logged against the gateway's default venue, which may be the wrong "
            "hall — and the candidate list cannot be scoped, so anyone can be enrolled here.",
            "Set the exam and venue from the Terminal tab.", [])

    blockers = sum(1 for f in findings if f["severity"] == "BLOCKER")
    warnings = sum(1 for f in findings if f["severity"] == "WARNING")
    order = {"BLOCKER": 0, "WARNING": 1, "INFO": 2}
    return {
        "ok": blockers == 0,
        "blockers": blockers,
        "warnings": warnings,
        "vmsReachable": vms_reachable,
        "findings": sorted(findings, key=lambda f: order[f["severity"]]),
        "face": {
            "enabled": bool(CAM_URL),
            "engineReady": FACE_AVAILABLE,
            "camUrl": CAM_URL or None,
        },
        "inspected": {
            "enrolledPrints": len(roster),
            "printsOnSensor": on_sensor if isinstance(on_sensor, int) else None,
            "expectedCandidates": len(expected),
            "venue": ctx.get("venueName") or None,
        },
    }


@app.get("/admin/context")
def get_context() -> dict[str, Any]:
    return load_context()


class ContextRequest(BaseModel):
    examId: str = ""
    examName: str = ""
    examCode: str = ""
    venueId: str = ""
    venueName: str = ""
    cityName: str = ""


@app.post("/admin/context")
def set_context(body: ContextRequest) -> dict[str, Any]:
    """Bind this terminal to an exam and venue. Persisted across restarts."""
    ctx = save_context(body.model_dump())
    print(f"[{_stamp()}] CONTEXT     {ctx.get('examCode') or ctx.get('examId')} @ "
          f"{ctx.get('venueName')} ({ctx.get('cityName')})")
    _log_event("device", f"Terminal set to {ctx.get('venueName') or 'venue'} — "
                         f"{ctx.get('examCode') or 'exam'}")
    return ctx


@app.get("/roster")
def get_roster() -> dict[str, Any]:
    roster = load_roster()
    return {"enrolled": len(roster),
            "roster": {str(k): v for k, v in sorted(roster.items())}}


@app.get("/health")
def health() -> dict[str, Any]:
    return admin_state()


# ================================================================== portal ===

@app.get("/", response_class=HTMLResponse)
def portal() -> HTMLResponse:
    page = BASE_DIR / "static" / "admin.html"
    if not page.exists():
        return HTMLResponse("<h1>admin.html is missing from static/</h1>", status_code=500)
    return HTMLResponse(page.read_text())


if __name__ == "__main__":
    print("Run with:  uvicorn server:app --host 0.0.0.0 --port 8000", file=sys.stderr)
