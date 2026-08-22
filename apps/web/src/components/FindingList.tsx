import { useState } from "react"
import { AlertOctagon, AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import clsx from "clsx"

// A finding is only useful if it says what breaks next. Each row carries the
// consequence and the remedy, not just a count.
export interface Finding {
  id: string
  severity: "BLOCKER" | "WARNING" | "INFO"
  title: string
  detail: string
  consequence: string
  fix: string
  count: number
  samples: string[]
  stage?: string
}

// Severity reads from the icon and the label first; the tint is reinforcement,
// never the only carrier. Tints come from UX4G's own scales.
const TONE: Record<Finding["severity"], { icon: LucideIcon; fg: string; bg: string; label: string }> = {
  BLOCKER: { icon: AlertOctagon,  fg: "var(--ux4g-color-red-800)",    bg: "var(--ux4g-color-red-50)",    label: "Blocker" },
  WARNING: { icon: AlertTriangle, fg: "var(--ux4g-color-orange-800)", bg: "var(--ux4g-color-orange-50)", label: "Warning" },
  INFO:    { icon: Info,          fg: "var(--ux4g-color-primary-800)",bg: "var(--ux4g-color-primary-50)",label: "For information" },
}

export default function FindingList({ findings }: { findings: Finding[] }) {
  const [open, setOpen] = useState<string | null>(findings[0]?.id ?? null)

  if (!findings.length) {
    return (
      <div className="ux4g-alert ux4g-alert-success" role="status">
        <span className="ux4g-alert-icon"><Info size={18} strokeWidth={2} aria-hidden /></span>
        <div className="ux4g-alert-content">
          <p className="ux4g-alert-message">
            No completeness or consistency problems found.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {findings.map((f) => {
        const tone = TONE[f.severity]
        const Icon = tone.icon
        const isOpen = open === f.id
        return (
          <li key={f.id} className="ux4g-card ux4g-card-solid overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? null : f.id)}
              aria-expanded={isOpen}
              className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-black/[0.02]"
            >
              <span
                className="shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: tone.bg, color: tone.fg }}
              >
                <Icon size={16} strokeWidth={2.25} aria-hidden />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline gap-2 flex-wrap">
                  <span className="ux4g-label-m-strong">{f.title}</span>
                  <span className="ux4g-label-s-default" style={{ color: tone.fg }}>
                    {tone.label}
                  </span>
                </span>
                <span className="block ux4g-label-s-default opacity-70 mt-0.5">{f.detail}</span>
              </span>
              {isOpen
                ? <ChevronDown size={16} className="shrink-0 mt-1 opacity-40" aria-hidden />
                : <ChevronRight size={16} className="shrink-0 mt-1 opacity-40" aria-hidden />}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pl-14 space-y-3">
                <Detail term="What this breaks later" value={f.consequence} />
                <Detail term="How to fix" value={f.fix} />
                {f.samples.length > 0 && (
                  <div>
                    <dt className="ux4g-label-s-strong uppercase tracking-wide opacity-50">
                      Affected records
                      {f.count > f.samples.length ? ` (${f.samples.length} of ${f.count})` : ""}
                    </dt>
                    <dd className="flex flex-wrap gap-1.5 mt-1.5">
                      {f.samples.map((s) => (
                        <span key={s} className="ux4g-badge font-mono">{s}</span>
                      ))}
                    </dd>
                  </div>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className={clsx("ux4g-label-s-strong uppercase tracking-wide opacity-50")}>{term}</dt>
      <dd className="ux4g-label-m-default mt-0.5">{value}</dd>
    </div>
  )
}
