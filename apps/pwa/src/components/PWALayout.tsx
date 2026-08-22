import { useState } from "react"
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
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto"
         style={{ background: "var(--ux4g-color-neutral-50)" }}>
      <OfflineBadge />

      <header
        className="px-4 py-3 flex items-center gap-3 shrink-0 text-white"
        style={{
          background: "var(--ux4g-color-neutral-900)",
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
        {/* Carries its word, not just a glyph.
            As an unlabelled icon in the top-right corner this was the easiest
            control on the screen to hit by accident — that corner is where a
            thumb rests and where close and back normally live — and hitting it
            ends the session silently. Getting back in needs a fresh one-time
            code from email, so the cost of a mis-tap is minutes, in a hall, on
            a phone. The label says what it does and the confirmation makes it
            deliberate. */}
        <button
          onClick={() => setConfirmingSignOut(true)}
          className="-mr-2 px-3 min-h-[44px] flex items-center gap-1.5 rounded-full
                     text-white/90 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut size={18} strokeWidth={2} aria-hidden />
          <span className="ux4g-label-m-strong">Log out</span>
        </button>
      </header>

      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {children}
      </main>

      {confirmingSignOut && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
             role="dialog" aria-modal="true" aria-labelledby="signout-heading">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmingSignOut(false)} />
          <div className="ux4g-card ux4g-card-solid relative w-full max-w-sm p-5"
               style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}>
            <h2 id="signout-heading" className="ux4g-title-m-strong">Log out of the field app?</h2>
            <p className="ux4g-body-s-default mt-1" style={{ color: "var(--ux4g-color-neutral-700)" }}>
              Signing back in needs a new one-time code from your email. Anything
              saved on this device stays until it syncs.
            </p>
            <div className="flex flex-col gap-2 mt-5">
              <button
                onClick={() => { clearAuth(); navigate("/") }}
                className="ux4g-btn ux4g-btn-danger ux4g-btn-lg w-full min-h-[48px]"
              >
                Log out
              </button>
              <button
                autoFocus
                onClick={() => setConfirmingSignOut(false)}
                className="ux4g-btn ux4g-btn-secondary ux4g-btn-lg w-full min-h-[48px]"
              >
                Stay signed in
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
