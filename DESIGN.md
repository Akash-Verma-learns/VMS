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

## Verified

Batched inspection, desktop and mobile together:

- Impeccable detector over all changed files: no findings.
- Contrast on `/admit-cards` (1280px) and `/gate/readiness` (375px): zero AA
  failures after raising five secondary-text values.
- No interactive target under 44px on the field app.
