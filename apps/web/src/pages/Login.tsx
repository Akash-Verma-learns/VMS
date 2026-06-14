import { useState, useRef, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/auth"
import api from "../lib/api"
import toast from "react-hot-toast"
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
    <div className="min-h-screen bg-gradient-to-br from-navy to-navy-light flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-navy rounded-full mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">UPSC Venue Management System</h1>
          <p className="text-red-600 text-xs mt-1 font-medium">Official Government Portal — Restricted Access</p>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Government Email Address *</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                placeholder="you@upsc.gov.in"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-navy focus:border-navy"
              />
            </div>
            <button onClick={sendOtp} disabled={loading || !email}
              className="w-full bg-navy text-white py-2.5 rounded-lg font-medium hover:bg-navy-light disabled:opacity-50 transition-colors">
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-gray-600">OTP sent to <span className="font-medium">{email}</span></p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Enter 6-digit OTP *</label>
              <div className="flex gap-2 justify-center">
                {otp.map((d, i) => (
                  <input key={i} ref={(el) => { refs.current[i] = el }}
                    type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    className="w-11 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-navy focus:ring-0"
                  />
                ))}
              </div>
            </div>
            <button onClick={verifyOtp} disabled={loading || otp.join("").length < 6}
              className="w-full bg-navy text-white py-2.5 rounded-lg font-medium hover:bg-navy-light disabled:opacity-50 transition-colors">
              {loading ? "Verifying…" : "Verify and Login"}
            </button>
            <div className="text-center">
              {countdown > 0
                ? <span className="text-sm text-gray-400">Resend OTP in {countdown}s</span>
                : <button onClick={() => { sendOtp(); setOtp(["","","","","",""]) }}
                    className="text-sm text-navy underline">Resend OTP</button>
              }
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          All access is logged under GoI IT Security Policy
        </p>
      </div>
    </div>
  )
}
