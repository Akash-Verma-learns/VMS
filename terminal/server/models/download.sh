#!/usr/bin/env bash
# Face detection (YuNet) and recognition (SFace) weights from the official
# OpenCV model zoo. Kept out of git — 37MB of binary that never changes.
set -euo pipefail
cd "$(dirname "$0")"
BASE=https://github.com/opencv/opencv_zoo/raw/main/models
curl -fL -o yunet.onnx "$BASE/face_detection_yunet/face_detection_yunet_2023mar.onnx"
curl -fL -o sface.onnx "$BASE/face_recognition_sface/face_recognition_sface_2021dec.onnx"
echo "models downloaded:"; ls -lh *.onnx | awk '{print "  " $9, $5}'
