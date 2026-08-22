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

UX4G's own scale via `ux4g-label-{xl,l,m,s}-{default,strong}`. No custom
display face: an Operate surface is served by the system stack, and UX4G
already owns the type decision.

Roll numbers, seat labels and template ids are **monospaced**. They get read
aloud at a gate and compared against a printed card, so digit alignment is
functional rather than stylistic — it is the one place a costume-monospace ban
does not apply.

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
