import { useState, useRef, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Navigate } from "react-router-dom"
import { useAuthStore } from "../store/auth"
import api from "../lib/api"
import { roleHome } from "./gate/GateNav"
import toast from "react-hot-toast"
import { ShieldCheck } from "lucide-react"
import { Button, Field, Input, Alert } from "../components/ux"


/**
 * Set by the API client when a request came back 401.
 *
 * Read at module scope, not inside a hook. Reading it is destructive — the flag
 * is cleared so a later visit to this screen does not repeat a stale notice —
 * and StrictMode invokes state initialisers twice in development, so an
 * initialiser consumed the flag on the first call and saw nothing on the
 * second. The notice never rendered.
 *
 * Module scope runs once per page load, and the API client sets the flag
 * immediately before a full reload, so this reads exactly once per sign-out.
 */
const signedOutReason = sessionStorage.getItem("vms:signed-out")
sessionStorage.removeItem("vms:signed-out")

function useSignedOutNotice() {
  const returnTo = () => {
    const t = sessionStorage.getItem("vms:return-to")
    sessionStorage.removeItem("vms:return-to")
    return t
  }
  return { expired: signedOutReason === "expired", returnTo }
}

export default function Login() {
  const [step, setStep] = useState<"email" | "otp">("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const { setAuth, token, user } = useAuthStore()
  const { expired, returnTo } = useSignedOutNotice()

  // Anything that lands on "/" with a session intact — a stale link, a route
  // that no longer exists, a back button — used to render this form, which is
  // indistinguishable from having been signed out. The session is still valid,
  // so send them where they were going instead of asking them to sign in again.
  if (token && user) return <Navigate to={roleHome(user.role)} replace />
  const navigate = useNavigate()
  const online = navigator.onLine

  async function requestOtp() {
    if (!email) return
    setLoading(true)
    try {
      await api.post("/api/auth/request-otp", { email })
      setStep("otp"); setCountdown(60)
      const t = setInterval(() => setCountdown((c) => { if (c <= 1) clearInterval(t); return c - 1 }), 1000)
      toast.success("OTP sent to " + email)
    } catch (e: any) { toast.error(e.response?.data?.error ?? "Failed") } finally { setLoading(false) }
  }

  async function verifyOtp() {
    const code = otp.join("")
    if (code.length < 6) return
    setLoading(true)
    try {
      const res = await api.post("/api/auth/verify-otp", { email, otp: code })
      const { token, user } = res.data
      setAuth(token, user)
      const role = user.role
      const back = returnTo()
      if (back) navigate(back, { replace: true })
      else if (role === "VS") navigate("/vs/home")
      else if (role === "CS") navigate("/cs/home")
      else if (role === "IO") navigate("/io/home")
      else navigate("/vs/home")
    } catch (e: any) { toast.error("Invalid OTP") } finally { setLoading(false) }
  }

  /**
   * Accepts one digit or a whole code.
   *
   * The guard used to be /^\d?$/, which rejected any value longer than one
   * character — so pasting the six-digit code from the email did nothing at
   * all, and typing quickly dropped digits that arrived while focus was still
   * moving. Both are the same fix: take whatever digits arrive, lay them out
   * from this box onward, and put the caret after the last one filled.
   */
  function handleDigit(i: number, val: string) {
    const digits = val.replace(/\D/g, "")
    if (!digits) {
      const cleared = [...otp]; cleared[i] = ""; setOtp(cleared)
      return
    }
    const next = [...otp]
    for (let k = 0; k < digits.length && i + k < 6; k++) next[i + k] = digits[k]
    setOtp(next)
    const last = Math.min(i + digits.length, 5)
    refs[last].current?.focus()
  }
  function handleKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[i] && i > 0) refs[i - 1].current?.focus()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
         style={{ background: "var(--ux4g-color-primary-800)" }}>
      {!online && (
        <div className="w-full max-w-sm mb-3">
          <Alert tone="warning" title="No connection">
            Signing in needs internet. The gate keeps working offline once you are in.
          </Alert>
        </div>
      )}
      <div className="ux4g-card ux4g-card-solid w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
               style={{ background: "var(--ux4g-color-primary-700)" }}>
            <ShieldCheck size={26} strokeWidth={2} className="text-white" aria-hidden />
          </div>
          <h1 className="ux4g-title-s-strong">UPSC Field App</h1>
          <p className="ux4g-body-xs-default opacity-70 mt-0.5">Venue Management System</p>
        </div>

        {expired && (
          <div className="mb-4">
            <Alert tone="info" title="Your session ended">
              Sessions last 8 hours. Sign in again and you will return to the
              page you were on.
            </Alert>
          </div>
        )}

        {step === "email" ? (
          <div className="space-y-4">
            <Field label="Work email" hint="A one-time code is sent here. There is no password.">
              <Input type="email" value={email} autoComplete="email" inputMode="email"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestOtp()}
                placeholder="you@upsc.gov.in" />
            </Field>
            <Button block onClick={requestOtp} disabled={!email || loading || !online}>
              {loading ? "Sending code…" : "Send code"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="ux4g-body-s-default text-center">
              Enter the 6-digit code sent to<br />
              <strong className="ux4g-label-m-strong">{email}</strong>
            </p>
            <div className="flex gap-2 justify-center">
              {otp.map((d, i) => (
                <input key={i} ref={refs[i]} type="tel" inputMode="numeric" maxLength={6} value={d}
                  onChange={(e) => handleDigit(i, e.target.value)} onKeyDown={(e) => handleKey(i, e)}
                  aria-label={`Digit ${i + 1} of 6`}
                  /* 44px minimum, and wider than tall so a thumb lands inside
                     the box rather than between two of them. */
                  className="ux4g-input w-11 h-12 text-center text-lg font-bold font-mono px-0" />
              ))}
            </div>
            <Button block onClick={verifyOtp} disabled={otp.join("").length < 6 || loading}>
              {loading ? "Verifying…" : "Sign in"}
            </Button>
            <Button block variant="text" disabled={countdown > 0}
              onClick={() => { setOtp(["", "", "", "", "", ""]); requestOtp() }}>
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
