# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Eight government roles in a strict hierarchy, split across two very different
situations:

- **Officers at a desk** — JS, DS, US, SO, ASO. They create exams, approve
  venues, sanction advances, allot seats, release admit cards, and review
  flagged biometric entries. Desktop browser, sitting down, unhurried.
- **Field staff on their feet** — CS (Centre Superintendent), VS (Venue
  Superintendent), IO (Inspection Officer). They work inside an exam venue on
  a phone: readiness checklists, material chain-of-custody, inspections, and
  operating the biometric gate as candidates arrive. Standing, often holding
  something else, sometimes in poor light, under time pressure.
- **Candidates** — anonymous public users who submit city preferences and
  later download an admit card. No login.

## Product Purpose

Run the logistics of a national examination end to end, and verify at the door
that the person entering the hall is the candidate who was admitted.

Success is an exam day where every candidate is seated in a venue they chose,
every entry is attributable, and any irregularity is flagged to an invigilator
while it can still be acted on.

## Positioning

The gate is not a separate product bolted onto the VMS — it writes into the
same records officers already review. A fingerprint at the door resolves to a
roll number, a released admit card, an allotted venue and a seat, and lands on
the officer's dashboard as a verified or flagged entry.

## Operating Context

- **Exam day is the deadline.** Allotment and admit-card release are one-way:
  once a candidate has been told which hall to attend, seats cannot move.
- **The venue network is improvised.** Laptop, phone and ESP32 terminal share
  a phone hotspot. Addresses change between sessions; the venue may have no
  internet at all, and the gate must keep working when it does not.
- **Roll number is the only join.** It links the public preference form, the
  admit card, and the fingerprint at the gate. Nothing else identifies a
  candidate across those three systems.
- **Hardware is fallible in the open.** Sensors report phantom contact, wifi
  drops, cameras go unreachable. The interface has to distinguish "this is not
  the right person" from "the equipment failed", because they demand opposite
  responses from an invigilator.

## Capabilities and Constraints

- Roles: JS, DS, US, SO, ASO, CS, VS, IO. Authority is real, not cosmetic —
  ASO/SO prepare a seat allotment, only US releases admit cards.
- Seat allotment is driven by the candidate's own ranked city preferences, and
  records which preference was satisfied so the outcome can be explained.
- Two data-completeness layers report problems before they reach candidates:
  one over exam logistics, one over candidate allotment and the gate.
- The gate verifies fingerprint locally on the sensor, and optionally a face
  against the enrolled photo. Face is off unless a camera is configured.
- Auth is OTP-only, tokens last 8 hours, and the VMS permits one session per
  user — logging in elsewhere silently invalidates a running terminal.

## Brand Commitments

- **UX4G** (Government of India Design System) is binding: `ux4g-*` component
  classes and `--ux4g-*` tokens, applied over Tailwind layout.
- Existing product name and role vocabulary are fixed and must not be
  reworded — UPSC VMS, and the role acronyms above as users say them.

## Evidence on Hand

- A working ESP32 fingerprint terminal, a FastAPI gateway, and a Pi/webcam
  face factor, all in `terminal/`.
- Seeded demo data: two exams, three venues across three cities, 26 candidate
  preferences, 26 released admit cards.
- No real candidate photographs and no production data. Reference photos and
  candidate identities in the repository are placeholders and must never be
  presented as real people.

## Product Principles

1. **Say what breaks next.** A problem is reported with its downstream
   consequence and its remedy, never as a bare count.
2. **Never let equipment failure look like guilt.** An unreachable camera, a
   dead sensor and a genuine mismatch must be visually distinct.
3. **The irreversible step asks twice.** Allotment and release change what a
   candidate has been told; destructive actions name what is lost.
4. **Readable at arm's length, one-handed.** The field surface is used
   standing, in bad light, while holding something else.
5. **Degrade loudly, keep working.** Missing backend, missing camera, missing
   photo — the gate keeps deciding, and says which factor is not applying.

## Accessibility & Inclusion

WCAG 2.1 AA is the floor, per the UX4G baseline. Colour is never the only
carrier of status; every interactive control is keyboard-operable with focus
styles intact; touch targets on the field surface are at least 44px.
