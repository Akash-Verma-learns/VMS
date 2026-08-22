# Gate camera — Raspberry Pi Zero 2 W

The Pi is a camera and nothing more. It serves one JPEG per request; the
laptop does all detection and matching.

## Why this split

A Zero 2 W can run face recognition, but slowly — and the laptop is already
running the gateway with CPU to spare. Keeping the Pi dumb means:

- the gate stays inside its ~2 second budget
- a camera fault is never mistaken for a recognition fault
- the Pi needs no models, no reference photos, and no updates when thresholds
  change

## Setup

```bash
sudo apt update
sudo apt install -y python3-picamera2 python3-flask
python3 capture_server.py
```

Confirm from the laptop:

```bash
curl -o test.jpg http://<pi-ip>:8080/capture
```

Then in `terminal/server/.env`:

```
CAM_URL=http://<pi-ip>:8080/capture
```

## Run it on boot

```bash
sudo tee /etc/systemd/system/gate-camera.service >/dev/null <<'EOF'
[Unit]
Description=Gate camera
After=network-online.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/capture_server.py
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now gate-camera
```

## Notes

- Put the Pi on the same network as the laptop and the ESP32.
- Its DHCP address will move; either reserve it on the router or re-set
  `CAM_URL`. The gateway's data check reports an unreachable camera as a
  blocker rather than letting it fail silently at the gate.
- Mount it at candidate face height. The reference-photo quality gate needs a
  face at least 80px across, which 1280x720 gives comfortably at arm's length.
