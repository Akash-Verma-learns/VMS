import { useNavigate } from "react-router-dom"
import { Check, ChevronRight } from "lucide-react"
import clsx from "clsx"

export interface Task {
  label: string
  done: boolean
  route: string
  /** Mandatory items read as outstanding, not merely unticked. */
  mandatory?: boolean
}

/**
 * The action list every role lands on.
 *
 * Three states have to be told apart at a glance while standing: done,
 * outstanding-and-required, outstanding-and-optional. Done carries a tick as
 * well as the colour; required carries a word as well as the ring, because a
 * red outline alone is invisible to a chunk of users and in bad light.
 */
export default function TaskList({ title, tasks }: { title: string; tasks: Task[] }) {
  const navigate = useNavigate()
  const outstanding = tasks.filter((t) => !t.done).length

  return (
    <section className="ux4g-card ux4g-card-solid overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2">
        <h2 className="ux4g-label-s-strong uppercase tracking-wide opacity-70">{title}</h2>
        <span className="ux4g-label-s-default opacity-70">
          {outstanding === 0 ? "All done" : `${outstanding} outstanding`}
        </span>
      </header>

      <ul>
        {tasks.map((t) => (
          <li key={t.label}>
            <button
              onClick={() => navigate(t.route)}
              className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[56px] text-left
                         border-t hover:bg-black/[0.02] active:bg-black/[0.04] transition-colors"
              style={{ borderColor: "var(--ux4g-color-neutral-200)" }}
            >
              <span
                aria-hidden
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0"
                style={{
                  background: t.done ? "var(--ux4g-color-green-600)" : "transparent",
                  borderColor: t.done
                    ? "var(--ux4g-color-green-600)"
                    : t.mandatory
                      ? "var(--ux4g-color-red-600)"
                      : "var(--ux4g-color-neutral-400)",
                }}
              >
                {t.done && <Check size={14} className="text-white" strokeWidth={3} />}
              </span>

              <span className="flex-1 min-w-0">
                <span className={clsx("block ux4g-label-m-strong", t.done && "line-through opacity-50")}>
                  {t.label}
                </span>
                {!t.done && t.mandatory && (
                  <span className="ux4g-label-s-default" style={{ color: "var(--ux4g-color-red-700)" }}>
                    Required
                  </span>
                )}
              </span>

              {!t.done && <ChevronRight size={18} className="shrink-0 opacity-40" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
