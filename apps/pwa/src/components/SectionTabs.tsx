import { useNavigate, useLocation } from "react-router-dom"
import { useRef, useEffect } from "react"
import clsx from "clsx"

/**
 * Sub-navigation inside a section, directly under the header.
 *
 * The gate used to replace the whole bottom bar with its own four tabs, so
 * entering it swapped the app's navigation out from under you and the only
 * way back was an arrow in the header. Sub-navigation belongs next to the
 * content it filters, not in the place that tells you where you are.
 *
 * Horizontally scrollable so it never has to shrink below a 44px target, and
 * the active tab is scrolled into view on arrival.
 */
export default function SectionTabs({ items }: {
  items: { label: string; path: string }[]
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" })
  }, [pathname])

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="Section"
      className="flex gap-1 overflow-x-auto px-3 py-2 border-b sticky top-0 z-10"
      style={{
        background: "var(--ux4g-color-neutral-0)",
        borderColor: "var(--ux4g-color-neutral-200)",
        scrollbarWidth: "none",
      }}
    >
      {items.map((t) => {
        const active = pathname === t.path
        return (
          <button
            key={t.path}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            onClick={() => navigate(t.path)}
            className={clsx(
              "shrink-0 px-1 mx-2 min-h-[44px] whitespace-nowrap transition-colors border-b-2",
              active ? "ux4g-label-l-strong" : "ux4g-label-l-default border-transparent",
            )}
            style={active
              ? { color: "var(--ux4g-color-primary-800)", borderColor: "var(--ux4g-color-primary-700)" }
              : { color: "var(--ux4g-color-neutral-600)" }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
