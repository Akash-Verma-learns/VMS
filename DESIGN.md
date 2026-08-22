# Design

Visual authority for the UPSC VMS portal and field app. Written from the built
result, not ahead of it.

## World

**UX4G — the Government of India Design System — is the world, pinned by the
brief.** Component identity comes from `ux4g-*` classes and `--ux4g-*` tokens;
Tailwind is used for layout around them and nothing else. The division is
deliberate: a control's meaning belongs to UX4G, its position on the page
belongs to us.

Mode is **Operate** on every surface. Nobody visits this to be persuaded — an
officer is allotting seats, an invigilator is admitting a candidate. Expression
never obscures task, state, or affordance.

## Theme

`data-theme="light"`, pinned explicitly in `index.html` and re-asserted after
the UX4G runtime loads.

This is a decision, not a default. The runtime follows the OS colour
preference, which put dark-theme UX4G components on a light Tailwind surface —
black input fills on white cards. The use scene settles it: exam halls and
government offices are brightly lit, often with glare on a phone held at
arm's length. Light ground, dark text.

## Colour

- **Five hues carry meaning, and nothing else is painted:** primary, neutral,
  green (verified), orange (at risk), skyblue (informational). Eight were in
  play — amber, teal, indigo and blue alongside the semantic ones — across 852
  raw Tailwind colour classes.
- **The Tailwind palette is remapped onto UX4G in `@theme`.** Rather than edit
  852 call sites, `gray→neutral`, `amber/yellow→orange`, `blue→skyblue`, and
  `teal/indigo/purple→primary`. Existing classes keep working but paint from
  the design system, and the decorative hues collapse into the sanctioned set.
- **Chrome is neutral; the brand is an accent.** UX4G's primary is a saturated
  violet (`#6a4eff`). It was the header band *and* the bottom bar *and* every
  active state, which is what made the interface read as assembled from a
  palette rather than designed. Chrome is now `neutral-900`; violet appears on
  the current nav item, the primary action, and nothing else.
- **Ground:** `--ux4g-color-neutral-50`. Surfaces are `ux4g-card-solid`.
- **Chrome and primary action:** `--ux4g-color-primary-*`. The header band is
  primary-700; the primary button is `ux4g-btn-primary`.
- **State is earned, never decorative.** Red, orange and green appear only
  where something is actually wrong, at risk, or verified — a refused
  candidate, a blocker, a connected terminal. A screen with nothing wrong has
  no red on it.
- **Secondary text** uses `--ux4g-color-neutral-600`, not a lighter grey.
  Tailwind's `gray-400` measured 2.6:1 and failed AA.

## Type

**Noto Sans**, shipped by UX4G and verified loading — not a system fallback.
No custom display face is sourced: the brief pins UX4G, which owns the type
decision, so importing another face would break the pin rather than honour it.

UX4G provides four type roles, and each has a job:

| Role | Size / leading | Use |
|---|---|---|
| `heading-2xl…xs` | 24/32 → 14/20 | page and section headings |
| `title-l…s` | 20/24 → 16/20 | card and panel titles |
| `body-l…xs` | 18/26 → 12/18 | prose, table cells, descriptions |
| `label-xl…s` | 16/20 → 11/14 | form labels, chips, nav, chrome |

The distinction is leading, not just size. `label-m` is 12px on a 16px line —
correct for a chip, wrong for a sentence. Body copy was using label roles
throughout, so paragraphs rendered at 12px with chrome leading; they now use
`body-*`, and headings use `heading-*` rather than an oversized label.

Roll numbers, seat labels and template ids are **monospaced**. They get read
aloud at a gate and compared against a printed card, so digit alignment is
functional rather than stylistic — it is the one place a costume-monospace ban
does not apply.

## Radius

Tailwind v4 makes `rounded-lg` 12px and `rounded-xl` 16px; those two plus
`rounded-full` were ~190 of 240 corners, so every card, field, chip and tile
was the same soft blob. UX4G's own scale is 2/4/8/12/16/24 and its components
sit at 8px (button, input) and 12px (card).

The Tailwind steps are remapped down one notch in `@theme` so existing markup
lands on the system's values. Pills survive only where the shape carries
meaning — status chips — and nowhere else. Section tabs are an underline, not
a filled pill.

## Components

`components/ux/` in each app, same vocabulary in both so a control means the
same thing on a desk and in a hand. The only divergence is density: the field
app defaults buttons to `lg` (48px), the portal to `md`.

- `Button` — `ux4g-btn` + `primary | outline-primary | outline-danger | text`
- `Card` — `ux4g-card ux4g-card-solid`; bare `ux4g-card` paints nothing here,
  and its padding rule computes to 0, so spacing is Tailwind's
- `Alert` — `ux4g-alert` + `success | error | warning | info`, always with an
  icon
- `Field` / `Input` / `Select` — `ux4g-input`, `ux4g-form-group`, labelled with
  `ux4g-label-m-strong`
- `Badge`, `Status`, `Row`, `Empty`

## Rules that outlast this build

1. **Colour is never the only carrier of state.** Every alert, finding and
   status pairs its tint with an icon and a word. Severity survives greyscale,
   colour-blindness, and a phone screen in sunlight.
2. **No accent bar as severity.** A coloured `border-left` was how findings
   read severity in the previous build; it is now an icon chip. Coloured
   borders above 1px are out.
3. **Equipment failure never looks like guilt.** An unreachable camera or a
   dead sensor renders as an equipment state, never in the same red as a
   refused candidate.
4. **44px minimum touch target on the field app**, and the safe-area inset is
   honoured top and bottom — the home indicator used to sit over the tab bar.
5. **Findings state the consequence.** Every problem surface shows what breaks
   later and how to fix it, never a bare count.
6. **Icons are drawn, from lucide, one stroke weight.** No emoji standing in
   for an icon system.

## Navigation — field app

**One bottom bar per role, three destinations, always present.** VS had six
tabs; a phone bar past four stops being scannable, and two of CS's five were
dead links to routes that do not exist in this app — tapping them fell through
to the redirect and logged the user out.

Each role gets the hub, the gate, and the one other place it goes often:

```
VS   Home · Gate · Surveys
CS   Home · Gate · Surveys
IO   Assignments · Gate · Inspect
```

**The gate is a section, not a mode.** Its four screens used to replace the
whole bottom bar, so entering the gate swapped the app's navigation out from
under the user and leaving needed a back arrow. They are now sub-navigation
under the header — a scrollable pill row, 44px, active tab scrolled into view.
The bar below never changes.

**Everything else is a row on the hub.** That is what makes three tabs safe:
when the bar shrank, the exam-day report became unreachable because it lived
only on the old six-tab bar. Hub-and-spoke means a screen cannot be orphaned
by a navigation change.

## Navigation

The officer sidebar is **grouped, not a flat list**. A US officer has twelve
destinations; an unstructured column of twelve makes each equally hard to
find. Groups follow the working day — Examinations, Exam day, Approvals and
field, Finance, Insight — so a destination is found by remembering what you
are doing rather than where a link sat.

**Nav labels match the heading of the page they open.** "FAL & Finance" used
to lead to a page titled "FAL Management", and "Face Auth" to one titled
"Flagged Records". Recognition beats recall.

**Shortcuts only surface what navigation cannot reach.** The dashboard's
quick actions repeated sidebar links, and the VS pair pointed at the page the
user was already on. What survives is the one destination with no nav entry.

The mobile drawer is a real dialog: `aria-modal`, focus moved to its close
button, Escape closes it, background scroll locked, and it dismisses on route
change instead of hanging over the page you just opened.

## Controls

- `Tabs` and `FilterChips` are shared. Three hand-rolled variants existed at
  26px, 32px and 38px on different pages; the same control should not change
  size depending on which screen you opened.
- Pointer targets are ≥36px in the portal and ≥44px on the field surface. The
  field app had a 16px text button.
- `Badge` paints from tokens, not from `ux4g-badge` — that class has **no rule
  in ux4g.css** and rendered nothing. Every UX4G class in both apps has been
  audited against the stylesheet; this was the only no-op.

## Alerts

`ux4g-alert` is a flex row expecting an `alert-icon` child and an
`alert-content` child. Putting raw text and `<strong>` straight inside it lays
each fragment out as its own column — a sentence renders as three disconnected
blocks. Always compose through the `Alert` component, never the class alone.

## Being signed out

An expired session is not a mistake the person made, so the sign-in screen names
the cause and the recovery — "Sessions last 8 hours. Sign in again and you will
return to the page you were on." — and the app actually returns them there
rather than to their role's default landing page. A bare sign-in form after a
timeout is indistinguishable from a crash.

## Empty states

"No approvals found." under a full set of column headers cannot be told apart
from a broken filter. An empty state names which it is and offers the way out:
the queue empty-state distinguishes "nothing has been raised" from "nothing
matches this status".

## States

Equipment failure gets a named state, not a red sentence. `GatewayDown` shows
which address is silent and offers a retry, because on a field surface the
laptop that stopped answering is usually in the same room.

## Verified

Batched inspection, desktop and mobile together:

- Impeccable detector over all changed files: no findings.
- Contrast on `/admit-cards` (1280px) and `/gate/readiness` (375px): zero AA
  failures after raising five secondary-text values.
- No interactive target under 44px on the field app.
