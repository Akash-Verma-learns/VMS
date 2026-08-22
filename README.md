# UPSC VMS — Venue Management System

A full-stack government exam logistics platform for managing examination venues, field staff, financial advances, and real-time exam-day operations across India.

---

## Architecture

```
upsc-vms/
├── apps/
│   ├── api/   — Express.js REST API (Node.js + TypeScript + Prisma + PostgreSQL)
│   ├── web/   — HQ Officer Portal (React 19 + Vite + TailwindCSS v4)
│   └── pwa/   — Field Staff App   (React 19 + Vite + PWA + Dexie offline)
```

### Role Hierarchy

```
JS  (Joint Secretary)
DS  (Deputy Secretary)        ← war room cockpit, FAL sanction
US  (Under Secretary)         ← approves venues, releases exams
SO  (Section Officer)         ← reviews venues, creates FALs
ASO (Assistant Section Officer) ← creates exams and FALs
CS  (Centre Superintendent)   ← field: assigns venues, submits bills
VS  (Venue Superintendent)    ← field: readiness, checkpoints, materials
IO  (Inspection Officer)      ← field: venue inspections
```

---

## Modules

| # | Module | Description |
|---|--------|-------------|
| MOD-01 | Auth | OTP-only login (no passwords), JWT sessions, full audit log |
| MOD-02 | Exam Management | Create → Release → Assign workflow |
| MOD-03 | Venue Management | CS assigns venues, 3-level approval chain (CS → SO → US) |
| MOD-04 | Approvals | Administrative approval queue with bulk actions |
| MOD-05 | FAL | Financial Advance Letters — created by ASO/SO, sanctioned by DS, acknowledged by CS |
| MOD-06 | Finance & Bills | CS submits bills; all amounts in BigInt paise (zero floating point) |
| MOD-07 | Field Reporting | VS submits 6 exam-day checkpoints + readiness checklist |
| MOD-08 | Material Tracking | PIN/QR-based chain of custody for exam materials |
| MOD-09 | Inspections | IO conducts pre-exam venue inspections |
| MOD-10 | Surveys | US/SO creates surveys; CS/VS/IO responds via PWA |
| MOD-11 | Face Auth | Biometric verification records per candidate |
| MOD-12 | Cockpit | DS/US war room — SSE live feed, jammer status, PwBD counts |
| MOD-13 | Reports | 9 MIS report types, CSV export |ff

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL (or Docker)
- Git

### 1. Clone & install

```bash
git clone <repo-url>
cd upsc-vms

cd apps/api && npm install
cd ../web  && npm install
cd ../pwa  && npm install
```

### 2. Configure environment

```bash
cp apps/.env.example apps/.env   # or create apps/.env manually
```

`apps/.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/upsc_vms
JWT_SECRET=upsc-vms-dev-secret-change-before-production
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=johnathan99@ethereal.email
SMTP_PASS=MDfVUeveTdBdbpX8Nf
```

> **Dev SMTP**: Uses [Ethereal](https://ethereal.email) — emails are captured, not delivered. View them at https://ethereal.email/messages. OTP is also printed to the API terminal as `[DEV] OTP for <email>: <code>`.

### 3. Database setup

```bash
cd apps/api
npx prisma migrate dev
npm run seed          # creates demo users for all 8 roles
```

### 4. Run all three apps

Open 3 terminals:

```bash
# Terminal 1 — API (port 3001)
cd apps/api && npm run dev

# Terminal 2 — Web portal (port 5173)
cd apps/web && npm run dev

# Terminal 3 — PWA field app (port 5174)
cd apps/pwa && npm run dev
```

### 5. View demo users

```bash
cd apps/api && npx prisma studio
# Opens http://localhost:5555 → User table → see all emails
```

| Role | Example email |
|------|--------------|
| JS | js@upsc.gov.in |
| DS | ds@upsc.gov.in |
| US | us@upsc.gov.in |
| SO | so@upsc.gov.in |
| ASO | aso@upsc.gov.in |
| CS | cs@upsc.gov.in |
| VS | vs@upsc.gov.in |
| IO | io@upsc.gov.in |

Login at http://localhost:5173 → enter email → get OTP from Ethereal or terminal → login.

---

## Demo Walkthrough

### Scene 1 — OTP Login
`localhost:5173` → enter `aso@upsc.gov.in` → Send OTP → check Ethereal or API terminal → paste OTP → login.

### Scene 2 — Create Exam (as ASO)
Dashboard → **Create New Exam** → fill name/type/year/date → add cities (Delhi, Mumbai, Kolkata) → Review → Create.

### Scene 3 — Release Exam (as US)
Exams → View exam → **Release Exam** → status: `DRAFT → RELEASED`.

### Scene 4 — Assign Venues (as CS)
My Venues → **Add Venue** (name, city, capacity) → copy Exam ID from officer's exam page → paste into Exam ID field → **Load** → **Assign to Exam** → **Submit All for Review**.

### Scene 5 — Approve Venues (SO then US)
SO: Exams → View exam → Venue Assignments → **Mark Reviewed**.
US: Exams → View exam → Venue Assignments → **Approve**.

### Scene 6 — Create FAL (as ASO/SO)
FAL & Finance → **Create FAL** → select exam → select CS → enter ₹50,000 → Submit. Status: `PENDING_DS`.

### Scene 7 — Sanction FAL (as DS)
FAL & Finance → find FAL → **Sanction**. Status: `SANCTIONED`. Click **Copy ID for CS**.

### Scene 8 — Acknowledge FAL (as CS)
FAL (sidebar) → paste FAL ID → **Acknowledge Receipt**. Status: `ACKNOWLEDGED`.

### Scene 9 — Create Survey (as SO/US)
Surveys → **Create Survey** → add YES/NO and text questions → set deadline and recipient roles → Dispatch.

### Scene 10 — PWA: Readiness Checklist (as VS)
`localhost:5174` → login as VS → Readiness tab → select exam → complete checklist → Submit.

### Scene 11 — PWA: Exam Day Checkpoints (as VS)
Exam Day tab → walk through 6 steps: Gate Closure → Security → Paper Opening → Session Start → Attendance → Session End.

### Scene 12 — PWA: Material Tracking (as VS)
Material tab → scan QR or enter PIN → **Confirm Receipt**.

### Scene 13 — War Room Cockpit (as DS)
`localhost:5173` as DS → Cockpit → select exam → live SSE connection (green dot) → see jammer status, PwBD counts, team workload.

### Scene 14 — Reports (as US)
Reports → select report type → select exam → **Download CSV**.

---

## Production Deployment

| Component | Recommended host |
|-----------|-----------------|
| `apps/api` | Railway / Render |
| `apps/web` | Vercel |
| `apps/pwa` | Vercel |
| PostgreSQL | Neon / Railway |
| SMTP | Brevo (300 emails/day free) |

### Environment variables for production

**API (Railway/Render):**
```env
DATABASE_URL=postgresql://...
JWT_SECRET=<strong-random-secret>
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<brevo-login>
SMTP_PASS=<brevo-smtp-key>
PORT=3001
```

**Web & PWA (Vercel):**
```env
VITE_API_URL=https://your-api.railway.app
```

**Build & start commands for API:**
```
Build:  npx prisma migrate deploy && npm run build
Start:  node dist/index.js
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| OTP-only auth | No password storage — reduces breach risk |
| BigInt for money | Zero floating point errors on government financial data |
| SSE over WebSocket | One-way push for cockpit is simpler; no persistent bidirectional connection needed |
| Offline-first PWA | VS/CS operate in venues with poor connectivity; Dexie queues sync on reconnect |
| Role-based API guards on every route | Fine-grained RBAC — CS cannot call officer endpoints even if URL is known |
| Prisma + PostgreSQL | Type-safe queries; strong relational integrity for approval chains |

---

## Tech Stack

**API:** Express.js 5, TypeScript, Prisma ORM, PostgreSQL, JWT, Nodemailer, bcryptjs

**Web Portal:** React 19, Vite 8, TailwindCSS v4, TanStack Query v5, Zustand, Axios, React Router v7, date-fns, lucide-react

**PWA:** Same as web + vite-plugin-pwa, Dexie (IndexedDB), jsQR (QR scanner), uuid
