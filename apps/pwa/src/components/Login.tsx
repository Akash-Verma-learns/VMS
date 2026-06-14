import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { DEMO_OTP, FIELD_USERS } from '../lib/mockData'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (step === 'email') { setStep('otp'); return }
    setBusy(true)
    try {
      const u = await login(email, otp)
      navigate(`/${u.role.toLowerCase()}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-brand">
        <div className="login-mark">VMS</div>
        <h1>UPSC Field App</h1>
        <p>Exam-day venue reporting</p>
      </div>

      <form onSubmit={submit} className="login-form">
        {error && <div className="field-alert">{error}</div>}
        {step === 'email' ? (
          <label className="fld">
            <span>Official email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vs@centre.gov.in" required autoFocus />
          </label>
        ) : (
          <label className="fld">
            <span>OTP sent to {email}</span>
            <input className="otp-input" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="••••••" required autoFocus />
          </label>
        )}
        <button className="btn-primary" disabled={busy}>{busy ? 'Verifying…' : step === 'email' ? 'Request OTP' : 'Sign in'}</button>
        {step === 'otp' && <button type="button" className="btn-text" onClick={() => { setStep('email'); setOtp('') }}>Change email</button>}
      </form>

      <div className="login-demo">
        <p>Demo — OTP <strong>{DEMO_OTP}</strong></p>
        <div className="demo-roles">
          {FIELD_USERS.map((u) => (
            <button key={u.id} onClick={() => { setEmail(u.email); setStep('email') }}>
              <strong>{u.role}</strong><span>{u.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
