"""
Face verification for the gate terminal.

Uses OpenCV's bundled YuNet detector and SFace recogniser rather than dlib:
both ship as small ONNX files and need no compiler, which removes the single
largest setup risk in this project. Accuracy is more than adequate for
one-to-one verification against a known reference photo, which is all the gate
does -- it never searches a gallery.

The Pi Zero 2 is used only to capture frames. Recognition runs here, where
there is CPU to spare, so the Pi stays a dumb camera that cannot become the
bottleneck or a second thing to debug.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
YUNET = MODEL_DIR / "yunet.onnx"
SFACE = MODEL_DIR / "sface.onnx"

# Reference photos, one per roll number: candidates/0001234.jpg
PHOTO_DIR = Path(__file__).resolve().parent / "candidates"

# --- quality floors for a usable reference photo ----------------------------
# A reference photo that is too small or too dark does not fail loudly; it
# quietly drags every comparison towards the threshold and flags innocent
# people. Better to refuse it at enrolment time.
MIN_FACE_PIXELS = 80        # face box shorter side
MIN_BRIGHTNESS = 40         # mean luma of the face crop, 0-255
MAX_BRIGHTNESS = 225

# Cosine similarity above which SFace considers two faces the same person.
# 0.363 is the value OpenCV documents for this model; we expose it so the
# gate's threshold can be tuned in demo lighting without touching code.
SFACE_COSINE_THRESHOLD = 0.363

_lock = threading.Lock()
_detector = None
_recognizer = None


def models_available() -> bool:
    return YUNET.exists() and SFACE.exists()


def _load():
    """Lazy singletons — the detector is not thread-safe, hence the lock."""
    global _detector, _recognizer
    if _detector is None or _recognizer is None:
        if not models_available():
            raise FileNotFoundError(
                f"Face models missing from {MODEL_DIR}. See README for the download."
            )
        _detector = cv2.FaceDetectorYN.create(str(YUNET), "", (320, 320),
                                              score_threshold=0.7)
        _recognizer = cv2.FaceRecognizerSF.create(str(SFACE), "")
    return _detector, _recognizer


@dataclass
class FaceResult:
    ok: bool
    reason: str = ""
    faces: int = 0
    quality: dict[str, Any] | None = None


def detect(image: np.ndarray) -> tuple[Optional[np.ndarray], FaceResult]:
    """Find the single largest face. Returns (face_row, result)."""
    detector, _ = _load()
    h, w = image.shape[:2]
    with _lock:
        detector.setInputSize((w, h))
        _, faces = detector.detect(image)

    if faces is None or len(faces) == 0:
        return None, FaceResult(False, "no face found in the image", 0)

    # Largest box wins: in a gate photo the candidate is nearest the camera.
    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    best = faces[0]
    x, y, fw, fh = [int(v) for v in best[:4]]

    crop = image[max(0, y):y + fh, max(0, x):x + fw]
    brightness = float(np.mean(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY))) if crop.size else 0.0
    quality = {
        "facePixels": int(min(fw, fh)),
        "brightness": round(brightness, 1),
        "faces": len(faces),
        "imageSize": f"{w}x{h}",
    }

    if min(fw, fh) < MIN_FACE_PIXELS:
        return best, FaceResult(False, f"face too small ({min(fw, fh)}px, need {MIN_FACE_PIXELS})",
                                len(faces), quality)
    if brightness < MIN_BRIGHTNESS:
        return best, FaceResult(False, f"face too dark (brightness {brightness:.0f})",
                                len(faces), quality)
    if brightness > MAX_BRIGHTNESS:
        return best, FaceResult(False, f"face overexposed (brightness {brightness:.0f})",
                                len(faces), quality)

    return best, FaceResult(True, "", len(faces), quality)


def embed(image: np.ndarray, face_row: np.ndarray) -> np.ndarray:
    _, recognizer = _load()
    with _lock:
        aligned = recognizer.alignCrop(image, face_row)
        return recognizer.feature(aligned)


def similarity(a: np.ndarray, b: np.ndarray) -> float:
    _, recognizer = _load()
    with _lock:
        return float(recognizer.match(a, b, cv2.FaceRecognizerSF_FR_COSINE))


def to_confidence(cosine: float) -> float:
    """Map cosine similarity onto the 0-100 scale the VMS stores.

    The mapping is anchored so the model's own decision threshold lands exactly
    on the VMS auto-flag threshold of 70: anything the model accepts reads as
    un-flagged, anything it rejects reads as flagged. Same trick as the
    fingerprint score mapping, and for the same reason.
    """
    t = SFACE_COSINE_THRESHOLD
    if cosine <= 0:
        return 0.0
    if cosine <= t:
        return round(max(0.0, (cosine / t) * 69.0), 1)
    return round(min(99.0, 70.0 + ((cosine - t) / (1.0 - t)) * 29.0), 1)


def photo_path(roll: str) -> Optional[Path]:
    for ext in (".jpg", ".jpeg", ".png"):
        p = PHOTO_DIR / f"{roll}{ext}"
        if p.exists():
            return p
    return None


def load_reference(roll: str) -> tuple[Optional[np.ndarray], FaceResult]:
    """Reference embedding for a roll, or an explanation of why there is none."""
    path = photo_path(roll)
    if path is None:
        return None, FaceResult(False, "no reference photo on file")

    image = cv2.imread(str(path))
    if image is None:
        return None, FaceResult(False, f"{path.name} is not a readable image")

    face_row, result = detect(image)
    if face_row is None or not result.ok:
        return None, result
    return embed(image, face_row), result


def verify(frame_bytes: bytes, roll: str) -> dict[str, Any]:
    """Compare a captured frame against the reference photo for `roll`."""
    reference, ref_result = load_reference(roll)
    if reference is None:
        return {"result": "NO_REFERENCE", "confidence": 0.0,
                "detail": f"reference photo: {ref_result.reason}"}

    buf = np.frombuffer(frame_bytes, dtype=np.uint8)
    frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if frame is None:
        return {"result": "NOT_CAPTURED", "confidence": 0.0,
                "detail": "camera returned something that is not an image"}

    face_row, live = detect(frame)
    if face_row is None or not live.ok:
        return {"result": "NOT_CAPTURED", "confidence": 0.0,
                "detail": f"captured frame: {live.reason}", "quality": live.quality}

    cosine = similarity(embed(frame, face_row), reference)
    confidence = to_confidence(cosine)
    matched = cosine > SFACE_COSINE_THRESHOLD
    return {
        "result": "MATCH" if matched else "INCONCLUSIVE",
        "confidence": confidence,
        "cosine": round(cosine, 4),
        "detail": "" if matched else "face does not match the enrolled photo",
        "quality": live.quality,
    }
