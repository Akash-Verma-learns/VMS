import { useNavigate, useLocation } from "react-router-dom"
import clsx from "clsx"
import type { LucideIcon } from "lucide-react"

interface NavItem { label: string; icon: LucideIcon; path: string }

export default function BottomNav({ items }: { items: NavItem[] }) {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-navy border-t border-navy-light flex z-40 max-w-lg mx-auto">
      {items.map((item) => (
        <button key={item.path} onClick={() => navigate(item.path)}
          className={clsx("flex-1 flex flex-col items-center py-2 text-xs gap-0.5 transition-colors",
            location.pathname === item.path ? "text-white" : "text-blue-200/70")}>
          <item.icon size={20} strokeWidth={2} />
          {item.label}
        </button>
      ))}
    </nav>
  )
}
