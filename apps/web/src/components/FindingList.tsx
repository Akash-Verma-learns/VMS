import { useState } from "react"
import clsx from "clsx"

// A finding is only useful if it says what breaks next. Each row shows the
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

const TONE = {
  BLOCKER: { bar: "bg-red-500",   chip: "bg-red-100 text-red-700",     label: "BLOCKER" },
  WARNING: { bar: "bg-amber-500", chip: "bg-amber-100 text-amber-800", label: "WARNING" },
  INFO:    { bar: "bg-blue-500",  chip: "bg-blue-100 text-blue-800",   label: "INFO" },
}

export default function FindingList({ findings }: { findings: Finding[] }) {
  const [open, setOpen] = useState<string | null>(findings[0]?.id ?? null)

  if (!findings.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        No completeness or consistency problems found.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {findings.map((f) => {
        const tone = TONE[f.severity]
        const isOpen = open === f.id
        return (
          <div key={f.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex">
            <div className={clsx("w-1 shrink-0", tone.bar)} />
            <div className="flex-1 min-w-0">
              <button onClick={() => setOpen(isOpen ? null : f.id)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50">
                <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5", tone.chip)}>
                  {tone.label}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">{f.title}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{f.detail}</span>
                </span>
                <span className="text-gray-300 shrink-0">{isOpen ? "▾" : "▸"}</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-2.5 text-sm">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      What this breaks later
                    </div>
                    <p className="text-gray-700 mt-0.5">{f.consequence}</p>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      How to fix
                    </div>
                    <p className="text-gray-700 mt-0.5">{f.fix}</p>
                  </div>
                  {f.samples.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Affected records{f.count > f.samples.length ? ` (${f.samples.length} of ${f.count})` : ""}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {f.samples.map((s) => (
                          <span key={s} className="font-mono text-xs bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
