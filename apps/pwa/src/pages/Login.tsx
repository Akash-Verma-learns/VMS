import { useState, useRef, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/auth"
import api from "../lib/api"
import toast from "react-hot-toast"

export default function Login() {
  const [step, setStep] = useState<"email" | "otp">("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const { setAuth } = useAuthStore()
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
      if (role === "VS") navigate("/vs/home")
      else if (role === "CS") navigate("/cs/home")
      else if (role === "IO") navigate("/io/home")
      else navigate("/vs/home")
    } catch (e: any) { toast.error("Invalid OTP") } finally { setLoading(false) }
  }

  function handleDigit(i: number, val: string) {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]; next[i] = val; setOtp(next)
    if (val && i < 5) refs[i + 1].current?.focus()
  }
  function handleKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[i] && i > 0) refs[i - 1].current?.focus()
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4">
      {!online && (
        <div className="w-full max-w-sm mb-3 bg-amber-500 text-white text-center text-xs py-2 rounded-lg">
          You are offline — login requires internet
        </div>
      )}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-navy rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-lg">VMS</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900">UPSC Field App</h1>
          <p className="text-xs text-gray-500 mt-1">Venue Management System</p>
        </div>

        {step === "email" ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestOtp()}
                placeholder="you@upsc.gov.in" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <button onClick={requestOtp} disabled={!email || loading || !online}
              className="w-full py-2.5 bg-navy text-white rounded-lg font-medium disabled:opacity-50">
              {loading ? "Sending OTP…" : "Continue"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">Enter the 6-digit OTP sent to <br /><strong>{email}</strong></p>
            <div className="flex gap-2 justify-center">
              {otp.map((d, i) => (
                <input key={i} ref={refs[i]} type="tel" inputMode="numeric" maxLength={1} value={d}
                  onChange={(e) => handleDigit(i, e.target.value)} onKeyDown={(e) => handleKey(i, e)}
                  className="w-10 h-12 text-center border-2 border-gray-300 rounded-lg text-lg font-bold focus:border-navy outline-none" />
              ))}
            </div>
            <button onClick={verifyOtp} disabled={otp.join("").length < 6 || loading}
              className="w-full py-2.5 bg-navy text-white rounded-lg font-medium disabled:opacity-50">
              {loading ? "Verifying…" : "Login"}
            </button>
            <button disabled={countdown > 0} onClick={() => { setOtp(["", "", "", "", "", ""]); requestOtp() }}
              className="w-full text-sm text-gray-500 disabled:opacity-40">
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
