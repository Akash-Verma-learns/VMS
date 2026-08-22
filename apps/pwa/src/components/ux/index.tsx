import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react"
import type { LucideIcon } from "lucide-react"
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"
import clsx from "clsx"

/**
 * UX4G primitives for the field app.
 *
 * Component identity comes from ux4g-* classes and --ux4g-* tokens; Tailwind
 * is used only for layout around them. Sizes lean one step larger than the
 * desktop defaults throughout: this surface is used standing, one-handed, in
 * whatever light the venue has.
 */

/* ------------------------------------------------------------------ button */

type Variant = "primary" | "outline" | "danger" | "text"

const VARIANT: Record<Variant, string> = {
  primary: "ux4g-btn-primary",
  outline: "ux4g-btn-outline-primary",
  danger:  "ux4g-btn-outline-danger",
  text:    "ux4g-btn-text-primary",
}

export function Button({
  children, variant = "primary", size = "lg", block, icon: Icon, className, ...rest
}: {
  children?: ReactNode
  variant?: Variant
  /** lg is the field default — 48px, comfortably hit while walking. */
  size?: "sm" | "md" | "lg"
  block?: boolean
  icon?: LucideIcon
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={clsx("ux4g-btn", VARIANT[variant], `ux4g-btn-${size}`,
        "inline-flex items-center justify-center gap-2",
        block && "w-full", className)}
    >
      {Icon && <Icon size={size === "sm" ? 16 : 18} strokeWidth={2} aria-hidden />}
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------- card */

// Bare .ux4g-card paints nothing here — the surface comes from the -solid
// variant, and its padding rule computes to 0, so spacing is Tailwind's.
export function Card({ title, action, children, className }: {
  title?: string; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={clsx("ux4g-card ux4g-card-solid p-4", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 mb-3">
          {title && <h2 className="ux4g-label-s-strong uppercase tracking-wide opacity-70">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------- field */

export const inputClass = "ux4g-input w-full"

export function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: ReactNode
}) {
  return (
    <div className="ux4g-form-group">
      <label className="ux4g-label-m-strong block mb-1.5">{label}</label>
      {children}
      {/* Errors replace the hint rather than stacking, so the recovery is the
          only thing being read when something is wrong. */}
      {error
        ? <p className="ux4g-body-xs-default mt-1.5 flex items-center gap-1.5 text-[var(--ux4g-color-red-700)]">
            <XCircle size={14} strokeWidth={2} aria-hidden /> {error}
          </p>
        : hint && <p className="ux4g-body-xs-default mt-1.5 opacity-70">{hint}</p>}
    </div>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputClass, props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputClass, props.className)} />
}

/* ------------------------------------------------------------------- alert */

export type Tone = "success" | "error" | "warning" | "info"

const TONE_CLASS: Record<Tone, string> = {
  success: "ux4g-alert-success",
  error:   "ux4g-alert-error",
  warning: "ux4g-alert-warning",
  info:    "ux4g-alert-info",
}

const TONE_ICON: Record<Tone, LucideIcon> = {
  success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info,
}

export function Alert({ tone = "info", title, children }: {
  tone?: Tone; title?: string; children?: ReactNode
}) {
  const Icon = TONE_ICON[tone]
  return (
    <div className={clsx("ux4g-alert", TONE_CLASS[tone])} role={tone === "error" ? "alert" : "status"}>
      {/* The icon is what carries the state for anyone who cannot separate the
          tints — colour is never the only signal. */}
      <span className="ux4g-alert-icon"><Icon size={18} strokeWidth={2} aria-hidden /></span>
      <div className="ux4g-alert-content">
        {title && <p className="ux4g-alert-title">{title}</p>}
        {children && <div className="ux4g-alert-message">{children}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- status + badge */

export function Badge({ tone = "info", children }: { tone?: Tone | "neutral"; children: ReactNode }) {
  // UX4G has no bare `.ux4g-badge` rule — it defines nothing, and its real
  // badges are digit/dot/icon variants, not text chips. So this paints from
  // the tokens directly rather than wearing a class that does nothing.
  const map: Record<string, { fg: string; bg: string }> = {
    success: { fg: "var(--ux4g-color-green-800)",   bg: "var(--ux4g-color-green-50)" },
    error:   { fg: "var(--ux4g-color-red-800)",     bg: "var(--ux4g-color-red-50)" },
    warning: { fg: "var(--ux4g-color-orange-800)",  bg: "var(--ux4g-color-orange-50)" },
    info:    { fg: "var(--ux4g-color-primary-800)", bg: "var(--ux4g-color-primary-50)" },
    neutral: { fg: "var(--ux4g-color-neutral-700)", bg: "var(--ux4g-color-neutral-100)" },
  }
  const c = map[tone] ?? map.info
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 ux4g-label-s-strong whitespace-nowrap"
          style={{ color: c.fg, background: c.bg }}>
      {children}
    </span>
  )
}

/** Dot plus words. The dot alone would be a colour-only signal. */
export function Status({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: ok ? "var(--ux4g-color-green-600)" : "var(--ux4g-color-red-600)" }} />
      <span className="ux4g-label-m-strong"
        style={{ color: ok ? "var(--ux4g-color-green-800)" : "var(--ux4g-color-red-800)" }}>
        {children}
      </span>
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="ux4g-body-s-default text-center py-10 px-6 opacity-70">{children}</p>
}

/** Key/value row, used wherever a screen reports device or link state. */
export function Row({ label, value, mono, tone }: {
  label: string; value: ReactNode; mono?: boolean; tone?: "normal" | "warn" | "bad"
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b last:border-0"
      style={{ borderColor: "var(--ux4g-color-neutral-200)" }}>
      <span className="ux4g-body-xs-default opacity-70 shrink-0">{label}</span>
      <span className={clsx("ux4g-label-m-strong text-right", mono && "font-mono")}
        style={{ color: tone === "bad" ? "var(--ux4g-color-red-700)"
               : tone === "warn" ? "var(--ux4g-color-orange-700)" : undefined }}>
        {value}
      </span>
    </div>
  )
}
