import { useNavigate, useLocation } from "react-router-dom"
import clsx from "clsx"
import type { LucideIcon } from "lucide-react"

interface NavItem { label: string; icon: LucideIcon; path: string }

export default function BottomNav({ items }: { items: NavItem[] }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-navy border-t border-navy-light
                 max-w-lg mx-auto flex"
      // The iPhone home indicator overlaps a bare fixed footer, which put the
      // bottom ~20px of every tab button under the bar and made them hard to
      // hit. Pad by the safe-area inset (0 on devices that have none).
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
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
              active ? "text-white" : "text-blue-200/70 active:text-white",
            )}
          >
            {active && (
              <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-white" />
            )}
            <item.icon size={20} strokeWidth={2} />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
