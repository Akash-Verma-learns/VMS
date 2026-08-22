#!/usr/bin/env python3
"""
Gate camera — laptop webcam.

Serves the same contract as the Pi Zero 2 service (GET /capture -> one JPEG),
so the gateway cannot tell them apart. Use this to get face verification
working before the Pi is set up, or as the demo-day fallback if the Pi will
not boot.

Run:
    cd terminal/server
    .venv/bin/python ../cam/webcam_server.py

macOS will ask for camera permission the first time. It attributes the request
to the terminal app, so grant it there.

Then in terminal/server/.env:
    CAM_URL=http://127.0.0.1:8090/capture
"""

import logging
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import cv2

PORT = 8090
DEVICE_INDEX = 0
WARMUP_FRAMES = 5     # first frames come back dark before auto-exposure settles

log = logging.getLogger("gate-webcam")
_lock = threading.Lock()
_camera = None


def camera():
    """Held open between requests — reopening per capture costs ~1s each time."""
    global _camera
    if _camera is None or not _camera.isOpened():
        cam = cv2.VideoCapture(DEVICE_INDEX)
        if not cam.isOpened():
            raise RuntimeError(
                "cannot open the webcam — check camera permission for your terminal app"
            )
        cam.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        for _ in range(WARMUP_FRAMES):
            cam.read()
            time.sleep(0.05)
        _camera = cam
        log.info("webcam opened on index %s", DEVICE_INDEX)
    return _camera


def grab_jpeg() -> bytes:
    with _lock:
        cam = camera()
        ok, frame = cam.read()
        if not ok:
            # Drop the handle so the next request reopens rather than serving
            # a stale frame forever.
            cam.release()
            globals()["_camera"] = None
            raise RuntimeError("webcam returned no frame")
        ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not ok:
            raise RuntimeError("failed to encode frame as JPEG")
        return buf.tobytes()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/ping"):
            self._send(b'{"ok": true}', "application/json")
            return
        if not self.path.startswith("/capture"):
            self.send_error(404)
            return
        try:
            data = grab_jpeg()
        except Exception as exc:  # noqa: BLE001
            # 503, matching the Pi: the gateway reports NOT_CAPTURED rather
            # than treating a camera fault as a face mismatch.
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(f'{{"error": "{exc}"}}'.encode())
            return
        self._send(data, "image/jpeg")

    def _send(self, data: bytes, ctype: str):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(f"gate webcam on http://0.0.0.0:{PORT}/capture")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
