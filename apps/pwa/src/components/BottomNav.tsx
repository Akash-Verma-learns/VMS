import { useNavigate, useLocation } from "react-router-dom"
import clsx from "clsx"
import type { LucideIcon } from "lucide-react"

interface NavItem { label: string; icon: LucideIcon; path: string }

export default function BottomNav({ items }: { items: NavItem[] }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t max-w-lg mx-auto flex"
      // The iPhone home indicator overlaps a bare fixed footer, which put the
      // bottom ~20px of every tab button under the bar and made them hard to
      // hit. Pad by the safe-area inset (0 on devices that have none).
      // A second, brighter violet directly below the header made the chrome
      // read as decoration. The bar is a surface; the current tab is the only
      // thing that needs colour.
      style={{
        background: "var(--ux4g-color-neutral-0)",
        borderColor: "var(--ux4g-color-neutral-200)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {items.map((item) => {
        const active = location.pathname === item.path
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative flex-1 flex flex-col items-center gap-0.5 py-2",
              "text-xs font-medium transition-colors",
              // 44px is the minimum comfortable touch target; the old nav was 38.
              "min-h-[52px] justify-center",
              active ? "ux4g-label-m-strong" : "ux4g-label-m-default",
            )}
          >
            {active && (
              <span className="absolute top-0 inset-x-5 h-0.5"
                    style={{ background: "var(--ux4g-color-primary-700)" }} />
            )}
            <item.icon size={22} strokeWidth={active ? 2.2 : 1.8}
              style={{ color: active ? "var(--ux4g-color-primary-700)" : "var(--ux4g-color-neutral-600)" }} />
            <span style={{ color: active ? "var(--ux4g-color-primary-800)" : "var(--ux4g-color-neutral-600)" }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
