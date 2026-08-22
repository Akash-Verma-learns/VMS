#!/usr/bin/env bash
# Point the firmware at whatever address this laptop currently has, then build
# and upload. The laptop's IP moves every time the network changes, and a stale
# SERVER_BASE looks like "connection refused" on the serial monitor rather than
# like a configuration problem — so this reads it fresh every time.
set -euo pipefail
cd "$(dirname "$0")"

CLI="/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli"
PORT="${PORT:-/dev/cu.usbserial-0001}"
FQBN="esp32:esp32:esp32"
BUILD="${TMPDIR:-/tmp}/gate-fw-build"

IP="$(ipconfig getifaddr en0 || true)"
[ -n "$IP" ] || { echo "Not on wifi — connect first."; exit 1; }

SECRETS=main/secrets.h
[ -f "$SECRETS" ] || { echo "Missing $SECRETS — copy secrets.example.h and fill it in."; exit 1; }

SSID="$(sed -n 's/.*WIFI_SSID_VALUE  *"\(.*\)".*/\1/p' "$SECRETS")"
OLD="$(sed -n 's|.*SERVER_BASE_VALUE  *"http://\([0-9.]*\):8000".*|\1|p' "$SECRETS")"

if [ "$OLD" != "$IP" ]; then
  sed -i '' "s|SERVER_BASE_VALUE   \"http://[0-9.]*:8000\"|SERVER_BASE_VALUE   \"http://$IP:8000\"|" "$SECRETS"
  echo "gateway address: $OLD -> $IP"
else
  echo "gateway address: $IP (unchanged)"
fi
echo "wifi ssid      : $SSID"

# The ESP32 cannot join 5GHz. Say so here rather than after a failed upload.
CHAN="$(system_profiler SPAirPortDataType 2>/dev/null | awk '/Current Network Information/,/Other Local/' \
        | sed -n 's/.*Channel: \([0-9]*\).*/\1/p' | head -1)"
if [ -n "$CHAN" ] && [ "$CHAN" -gt 14 ]; then
  echo
  echo "WARNING: this laptop is on a 5GHz channel ($CHAN)."
  echo "The ESP32 is 2.4GHz-only, so it cannot reach $IP from that network."
  echo "Join the same 2.4GHz network the board uses, then run this again."
  echo
fi

# Bake in an address only if the gateway actually answers on it. The IP is read
# at flash time, so a laptop that briefly hops networks can otherwise burn a
# dead address into the board — which then looks like a broken sensor.
if ! curl -fsS -m 3 "http://$IP:8000/ping" >/dev/null 2>&1; then
  echo
  echo "ERROR: nothing answering at http://$IP:8000/ping"
  echo "Start the gateway, or wait for the wifi to settle, then run this again."
  echo "Refusing to flash an address the board cannot reach."
  exit 1
fi
echo "gateway reachable at http://$IP:8000"

if lsof "$PORT" >/dev/null 2>&1; then
  echo "ERROR: $PORT is busy — close the Arduino Serial Monitor and retry."
  exit 1
fi

"$CLI" compile --fqbn "$FQBN" --build-path "$BUILD" ./main
"$CLI" upload  --fqbn "$FQBN" --build-path "$BUILD" -p "$PORT" ./main
echo
echo "Flashed. Watch the boot banner for:"
echo "  Gateway: http://$IP:8000"
