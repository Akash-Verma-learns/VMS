import { useAuthStore } from "../store/auth"
import { useNavigate } from "react-router-dom"
import OfflineBadge from "./OfflineBadge"
import type { ReactNode } from "react"

export default function PWALayout({ children, title, back }: { children: ReactNode; title?: string; back?: string }) {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <OfflineBadge />
      <header className="bg-navy text-white px-4 py-3 flex items-center gap-3 shrink-0">
        {back && (
          <button onClick={() => navigate(back)} className="text-white/80 hover:text-white text-lg leading-none">←</button>
        )}
        <div className="flex-1">
          <h1 className="font-bold text-sm">{title ?? "UPSC VMS"}</h1>
          {user && <p className="text-xs text-blue-200">{user.name} · {user.role}</p>}
        </div>
        <button onClick={() => { clearAuth(); navigate("/") }} className="text-xs text-blue-200 hover:text-white">Logout</button>
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
    </div>
  )
}
