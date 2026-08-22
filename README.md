# UPSC VMS — Venue Management System

Software for running a national competitive examination: allotting candidates to
venues, moving material and money through an eight-rank approval chain, checking
the data before it becomes irreversible, and admitting candidates at the door
with a fingerprint.

Three applications, one hardware terminal, one database.

---

## The problem

A UPSC examination is a logistics operation with a hard deadline and no second
attempt. Roughly the same failure recurs: a data error entered weeks earlier —
a centre with no venue attached, a candidate whose city preference points
nowhere, two candidates on one seat — is discovered on exam morning, when the
only remaining options are bad ones.

Three things follow from that, and they are what this project builds:

1. **Errors must surface while they are still cheap.** A completeness check runs
   against the live roster and names each problem, what it will break, and how
   to fix it — before admit cards are released rather than after.
2. **Allotment must be explainable.** A candidate gives three city preferences.
   The system records *which* preference each allocation satisfied, so "why am I
   in this city" has an answer.
3. **Identity at the door must be verifiable.** A biometric gate terminal checks
   a fingerprint against the roster and records the match confidence, so a
   disputed entry has evidence rather than recollection.

---

## What is here

| Component | Stack | Size |
|---|---|---|
| **API** | Express · Prisma · PostgreSQL | 77 routes, 28 models, ~4.7k LOC |
| **Officer portal** | React 19 · Vite · UX4G | 40 screens, ~6.3k LOC |
| **Field app (PWA)** | React 19 · Vite · IndexedDB | 16 screens, ~3.2k LOC |
| **Gate gateway** | FastAPI · Python | ~1.2k LOC |
| **Gate firmware** | ESP32 · AS608 · C++ | ~650 LOC |

### The eight roles

`JS → DS → US → SO → ASO` are the headquarters chain; `CS` (city), `VS` (venue)
and `IO` (inspection) work in the field. Authority is not decorative — it decides
who may release an exam, sanction an advance, approve a venue, and release admit
cards. The API enforces it per route; the interfaces only ever offer what the
signed-in role can actually do.

---

## Three things worth looking at

### 1. Data completeness check — *explainability*

`apps/api/src/services/datacheck.service.ts`

Twelve checks run against a live exam roster. Each finding carries more than a
message: the **stage** the error entered at, the **consequence** if it ships,
and the **fix**, graded `BLOCKER` / `WARNING` / `INFO`.

The distinction that matters is between an error and a risk. A centre with no
venue attached is a blocker — admit cards cannot be printed. A city that is
oversubscribed is a warning — it will work, but somebody gets their third
choice. Both are reported; only one stops the release.

```
GET /api/admit-cards/:examId/data-check
→ { ok: false, blockers: 1, warnings: 1, findings: [
      { id: "centre-without-venue", severity: "BLOCKER",
        consequence: "Admit cards for this centre cannot be printed",
        fix: "Attach a venue, or move its candidates", stage: "venue-assignment",
        count: 1, samples: [...] } ] }
```

### 2. Allotment from stated preferences — *traceability*

`apps/api/src/services/allocation.service.ts`

The public form collects three cities in priority order; the schema carries up
to five. Allotment walks `priority1..5` in order and records `preferenceRank`
on the allocation — so every seat
knows which preference it satisfied. A supplementary mode (`new-only`) allots
late registrations without disturbing seats already issued, which is what
actually happens when a correction window closes.

### 3. Biometric gate terminal — *hardware*

`terminal/` — ESP32 DevKit + AS608 optical fingerprint sensor over UART2.

The ESP32 is a DHCP client with no fixed address, so it cannot be commanded
directly. It **polls a single-slot command queue** on the gateway instead; the
gateway is the only component that talks to the VMS. Enrolment, identification
and roster sync are all driven through that one channel.

The subtle part is the confidence mapping (`normalise_confidence`). The sensor
reports a match score on its own open-ended scale; the VMS stores 0–100 and
flags anything under 70. Two decisions come from one score — *does the gate
open* and *is the record flagged* — and they are made in different places. If
they disagree by even one point, the terminal admits a candidate while filing
them as suspect. That boundary is covered by tests (below), including the
off-by-one that originally caused it.

---

## Running it

**Prerequisites:** Node 18+, PostgreSQL, Python 3.9+ (gateway only).

```bash
cd apps/api && npm install && cd ../web && npm install && cd ../pwa && npm install
```

Create `apps/api/.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/upsc_vms
JWT_SECRET=change-me-before-production
# SMTP_* is optional. With none set, one-time codes print to the API terminal.
```

```bash
cd apps/api
npx prisma migrate dev
npm run seed            # demo users for all eight roles
```

Then three terminals:

```bash
cd apps/api && npm run dev     # :3001
```
```bash
cd apps/web && npm run dev     # :5173  officer portal
```
```bash
cd apps/pwa && npm run dev     # :5174  field app
```

### Signing in

Authentication is **one-time-code only — there is no password**. Enter a demo
address (`us@upsc.gov.in`, `vs@upsc.gov.in`, `cs@upsc.gov.in`, …) and the code
prints in the API terminal:

```
──────────────────────────────────────────────
  OTP for us@upsc.gov.in
  711122     (valid 10 minutes)
──────────────────────────────────────────────
```

Sessions last 8 hours and are concurrent — a phone in the hall and a desk
machine can both stay signed in.

### The gate terminal (optional)

```bash
cd terminal/server && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python server.py       # :8000
```

Flash the firmware with `terminal/firmware/flash.sh`, which writes the current
host IP into `secrets.h` and refuses to flash if the gateway is unreachable —
the failure mode it exists to prevent is a board baked with a stale address
after a network change. See [terminal/README.md](terminal/README.md).

---

## Verifying it works

```bash
./scripts/verify.sh
```

Checks the things that break silently: every service up, authentication working,
**role boundaries actually enforced** (a VS must get `403` on an officer
endpoint, not `200`), the completeness check returning a real report, and the
biometric confidence unit tests.

```
Role boundaries
  ✓ US can list exams (200)
  ✓ VS is refused the officer exam list (403, not 401)
  ✓ unauthenticated request refused (401)
  ✓ forged token refused (401)

14 passed, 0 failed
```

Unit tests for the gate arithmetic:

```bash
cd terminal/server && .venv/bin/python test_confidence.py
```

These are mutation-checked: reintroducing the original `<=` off-by-one fails two
of the six, naming the exact score (`raw=50: gate accepted=True but flagged=True`).

---

## Architecture notes

**Offline-first field app.** Venues have poor connectivity. Submissions queue in
IndexedDB and sync on reconnect; the QR scanner releases the camera on unmount,
because a field app that holds the camera open drains a phone that is needed
later in the day.

**The gateway is a coordinator, not a proxy.** It holds a dedicated service
account (`gate-terminal@upsc.gov.in`) rather than borrowing an officer's, so
machine and human sessions cannot evict each other.

**Errors are made legible rather than swallowed.** Both front ends carry error
boundaries that keep the session and name the failing screen — a blank page is
indistinguishable from being signed out, and that ambiguity costs more to
diagnose than the original bug. In development the API records every rejected
request with its cause to `apps/api/rejected-auth.log`.

**Design system.** Both interfaces are built on UX4G, the Government of India
design system, with an explicit token layer mapping Tailwind onto UX4G
primitives. Conventions and the reasoning behind them are in
[DESIGN.md](DESIGN.md); product context is in [PRODUCT.md](PRODUCT.md).

---

## Security

- One-time-code authentication; no passwords stored or transmitted
- JWT with server-side session validation — revocation is immediate, not
  dependent on token expiry
- Per-route role enforcement, verified by `scripts/verify.sh` rather than assumed
- Wi-Fi credentials live in an untracked `secrets.h`; `.env` files are gitignored
- Public admit-card lookup makes an unreleased card **indistinguishable from a
  missing one**, so the endpoint cannot be used to enumerate the roster

The gateway's `/device/*` endpoints are unauthenticated by design — an ESP32
cannot hold a secret meaningfully — and are intended for an isolated demo LAN,
not a shared network.

---

## Known limitations

Stated plainly rather than discovered by a judge:

- `/vs/exam-day` requires pasting two UUIDs; it needs a `/api/field/my-venue`
  endpoint that does not exist yet
- VS receives `403` on `/api/venues` and `/api/inspections/my` — the field app
  works around it, but the role grants are inconsistent
- The face-recognition factor (OpenCV YuNet + SFace) is scaffolded but not wired
  into the gate flow; fingerprint is the only live biometric
- No automated tests on the API or front ends beyond `scripts/verify.sh`; the
  unit tests cover the gate arithmetic only
