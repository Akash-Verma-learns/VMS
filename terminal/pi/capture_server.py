#!/usr/bin/env python3
"""
Gate camera — Raspberry Pi Zero 2 W.

Serves a single JPEG on demand at  GET /capture
Health check at                    GET /ping

Deliberately dumb. The Pi captures frames and nothing else: no detection, no
recognition, no state. All matching happens on the laptop, which has the CPU
and already holds the reference photos. That keeps the Zero 2 comfortably
within its means and means a camera problem can never be confused with a
recognition problem.

Install on the Pi (Raspberry Pi OS Bookworm):
    sudo apt update
    sudo apt install -y python3-picamera2 python3-flask
    python3 capture_server.py

Then from the laptop:
    curl -o test.jpg http://<pi-ip>:8080/capture

Set CAM_URL=http://<pi-ip>:8080/capture in terminal/server/.env
"""

import io
import logging
import threading
import time

from flask import Flask, Response, jsonify

try:
    from picamera2 import Picamera2
except ImportError:  # pragma: no cover - only meaningful on the Pi
    Picamera2 = None

PORT = 8080
RESOLUTION = (1280, 720)   # plenty for an 80px+ face at arm's length
JPEG_QUALITY = 85

app = Flask(__name__)
log = logging.getLogger("gate-camera")

_camera = None
_lock = threading.Lock()   # picamera2 is not safe for concurrent captures


def camera():
    global _camera
    if _camera is None:
        if Picamera2 is None:
            raise RuntimeError("picamera2 not installed — apt install python3-picamera2")
        cam = Picamera2()
        cam.configure(cam.create_still_configuration(main={"size": RESOLUTION}))
        cam.start()
        # Auto-exposure and white balance need a moment to settle, otherwise
        # the first frame after boot is dark enough to fail the quality gate.
        time.sleep(2)
        _camera = cam
        log.info("camera started at %sx%s", *RESOLUTION)
    return _camera


@app.get("/ping")
def ping():
    return jsonify(ok=True, camera=Picamera2 is not None)


@app.get("/capture")
def capture():
    try:
        with _lock:
            buf = io.BytesIO()
            camera().capture_file(buf, format="jpeg")
        data = buf.getvalue()
    except Exception as exc:  # noqa: BLE001
        log.exception("capture failed")
        # 503 rather than 500: the gateway treats this as NOT_CAPTURED and
        # says so, instead of reporting a mismatch the candidate cannot argue.
        return jsonify(error=str(exc)), 503

    return Response(data, mimetype="image/jpeg",
                    headers={"Cache-Control": "no-store"})


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # threaded=False: one capture at a time, matching the hardware.
    app.run(host="0.0.0.0", port=PORT, threaded=False)
