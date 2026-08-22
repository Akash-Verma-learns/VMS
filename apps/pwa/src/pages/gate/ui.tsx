import type { ReactNode } from "react"
import clsx from "clsx"

/* Small shared primitives so the three gate screens stay visually identical
   instead of each inventing its own card and label styling. */

export function Card({ title, action, children, className }: {
  title?: string; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={clsx("bg-white rounded-2xl border border-gray-200/80 shadow-sm", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          {title && (
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className="px-4 pb-4 pt-0.5">{children}</div>
    </section>
  )
}

export function Row({ label, value, mono, tone }: {
  label: string; value: ReactNode; mono?: boolean; tone?: "normal" | "warn" | "bad"
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={clsx(
        "text-sm text-right",
        mono && "font-mono text-[13px]",
        tone === "warn" && "text-amber-600 font-medium",
        tone === "bad" && "text-red-600 font-semibold",
        !tone && "text-gray-800",
      )}>{value}</span>
    </div>
  )
}

export function Field({ label, hint, children }: {
  label: string; hint?: string; children: ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

export const inputClass =
  "w-full border border-gray-300 rounded-xl px-3.5 py-3 text-[15px] bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"

export function Button({ children, variant = "primary", className, ...rest }: {
  children: ReactNode; variant?: "primary" | "ghost" | "danger"
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={clsx(
        "rounded-xl font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        variant === "primary" && "bg-navy text-white py-3 px-4 text-[15px] w-full active:bg-navy/90",
        variant === "ghost" && "border border-gray-300 text-gray-700 py-2.5 px-4 text-sm w-full active:bg-gray-50",
        variant === "danger" && "border border-red-200 text-red-600 text-xs px-2.5 py-1.5 active:bg-red-50",
        className,
      )}
    >{children}</button>
  )
}

export function Dot({ ok }: { ok: boolean }) {
  return (
    <span className={clsx("w-2 h-2 rounded-full shrink-0", ok ? "bg-green-500" : "bg-red-500")} />
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-400 text-center py-10 px-6">{children}</p>
}
