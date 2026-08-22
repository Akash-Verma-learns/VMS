import { useState, useRef, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/auth"
import api from "../lib/api"
import toast from "react-hot-toast"
import { Button, Field, Input } from "../components/ux"
import { Shield } from "lucide-react"

const ROLE_REDIRECTS: Record<string, string> = {
  JS: "/dashboard", DS: "/dashboard", US: "/dashboard",
  SO: "/dashboard", ASO: "/dashboard",
  CS: "/cs/dashboard", VS: "/vs/dashboard", IO: "/dashboard",
}

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState("")
  const [step, setStep] = useState<1 | 2>(1)
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  async function sendOtp() {
    if (!email) return
    setLoading(true)
    try {
      await api.post("/api/auth/request-otp", { email })
      setStep(2)
      startCountdown()
      toast.success("OTP sent to " + email)
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to send OTP")
    } finally { setLoading(false) }
  }

  function startCountdown() {
    setCountdown(60)
    const t = setInterval(() => setCountdown((c) => { if (c <= 1) { clearInterval(t); return 0 } return c - 1 }), 1000)
  }

  function handleOtpKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus()
  }

  function handleOtpChange(i: number, val: string) {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]; next[i] = val; setOtp(next)
    if (val && i < 5) refs.current[i + 1]?.focus()
  }

  async function verifyOtp() {
    const code = otp.join("")
    if (code.length < 6) return
    setLoading(true)
    try {
      const res = await api.post("/api/auth/verify-otp", { email, otp: code })
      setAuth(res.data.token, res.data.user)
      navigate(ROLE_REDIRECTS[res.data.user.role] ?? "/dashboard")
    } catch (e: any) {
      toast.error("Invalid OTP. Please try again.")
      setOtp(["", "", "", "", "", ""])
      refs.current[0]?.focus()
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: "var(--ux4g-color-primary-800)" }}>
      <div className="ux4g-card ux4g-card-solid w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
               style={{ background: "var(--ux4g-color-primary-700)" }}>
            <Shield className="text-white" size={30} strokeWidth={2} aria-hidden />
          </div>
          <h1 className="ux4g-heading-xl-strong">UPSC Venue Management System</h1>
          <p className="ux4g-body-xs-default mt-1" style={{ color: "var(--ux4g-color-neutral-600)" }}>
            Official Government Portal — restricted access
          </p>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <Field label="Government email address"
                   hint="A one-time code is sent here. There is no password.">
              <Input type="email" value={email} autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                placeholder="you@upsc.gov.in" />
            </Field>
            <Button block size="lg" onClick={sendOtp} disabled={loading || !email}>
              {loading ? "Sending…" : "Send code"}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="ux4g-body-s-default">
              Code sent to <span className="ux4g-label-m-strong">{email}</span>
            </p>
            <div>
              <label className="ux4g-label-m-strong block mb-3">Enter the 6-digit code</label>
              <div className="flex gap-2 justify-center">
                {otp.map((d, i) => (
                  <input key={i} ref={(el) => { refs.current[i] = el }}
                    type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    aria-label={`Digit ${i + 1} of 6`}
                    className="ux4g-input w-11 h-12 text-center text-xl font-bold font-mono px-0"
                  />
                ))}
              </div>
            </div>
            <Button block size="lg" onClick={verifyOtp} disabled={loading || otp.join("").length < 6}>
              {loading ? "Verifying…" : "Verify and sign in"}
            </Button>
            <div className="text-center">
              {countdown > 0
                ? <span className="ux4g-body-xs-default" style={{ color: "var(--ux4g-color-neutral-600)" }}>
                    Resend code in {countdown}s
                  </span>
                : <Button variant="text" size="sm"
                    onClick={() => { sendOtp(); setOtp(["","","","","",""]) }}>Resend code</Button>
              }
            </div>
          </div>
        )}

        <p className="ux4g-body-xs-default text-center mt-8"
           style={{ color: "var(--ux4g-color-neutral-600)" }}>
          All access is logged under GoI IT Security Policy
        </p>
      </div>
    </div>
  )
}
