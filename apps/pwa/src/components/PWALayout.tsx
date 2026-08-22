import { useAuthStore } from "../store/auth"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, LogOut } from "lucide-react"
import OfflineBadge from "./OfflineBadge"
import type { ReactNode } from "react"

export default function PWALayout({ children, title, back }: {
  children: ReactNode; title?: string; back?: string
}) {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto"
         style={{ background: "var(--ux4g-color-neutral-50)" }}>
      <OfflineBadge />

      <header
        className="px-4 py-3 flex items-center gap-3 shrink-0 text-white"
        style={{
          background: "var(--ux4g-color-primary-700)",
          // Sits under the notch rather than behind it.
          paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
        }}
      >
        {back && (
          <button
            onClick={() => navigate(back)}
            aria-label="Back"
            /* 44px target — the old 20px glyph was the hardest control to hit
               on the whole surface. */
            className="-ml-2 w-11 h-11 flex items-center justify-center rounded-full
                       text-white/90 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="ux4g-title-s-strong truncate">{title ?? "UPSC VMS"}</h1>
          {user && (
            <p className="ux4g-body-xs-default text-white/75 truncate">
              {user.name} · {user.role}
            </p>
          )}
        </div>
        <button
          onClick={() => { clearAuth(); navigate("/") }}
          aria-label="Log out"
          className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full
                     text-white/90 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut size={18} strokeWidth={2} />
        </button>
      </header>

      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {children}
      </main>
    </div>
  )
}
