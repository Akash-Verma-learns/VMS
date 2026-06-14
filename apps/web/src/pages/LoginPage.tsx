import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError, usingMocks } from '../lib/api'
import { DEMO_OTP, DEMO_USERS } from '../mocks/data'
import { Icon } from '../components/Icon'

type Step = 'email' | 'otp'

interface LocationState {
  from?: { pathname?: string }
}

export function LoginPage() {
  const { requestOtp, verifyOtp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const dest = (location.state as LocationState | null)?.from?.pathname ?? '/dashboard'

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await requestOtp(email)
      setNotice('OTP sent to your registered email.')
      setStep('otp')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send OTP. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await verifyOtp(email, otp)
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <div className="auth-brand">
          <div className="brand-mark lg">VMS</div>
          <h1>UPSC Venue Management</h1>
          <p className="muted">Internal &amp; External Portal</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {step === 'email' ? (
          <form onSubmit={handleRequestOtp}>
            <div className="field">
              <label htmlFor="email">Official email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="name@upsc.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy || !email}>
              {busy ? 'Sending…' : 'Request OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            {notice && <div className="alert alert-info" style={{ marginBottom: '1rem' }}>{notice}</div>}
            <p className="muted" style={{ marginTop: 0 }}>
              Enter the 6-digit code sent to <strong>{email}</strong>.
            </p>
            <div className="field">
              <label htmlFor="otp">One-time password</label>
              <input
                id="otp"
                className="input input-otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
              />
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy || otp.length < 6}>
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ marginTop: '0.5rem' }}
              onClick={() => { setStep('email'); setOtp(''); setError(null) }}
            >
              Use a different email
            </button>
          </form>
        )}

        {usingMocks && (
          <div className="demo-panel">
            <div className="demo-head">
              <Icon name="lock" size={14} />
              <span>Demo mode — OTP is <code>{DEMO_OTP}</code></span>
            </div>
            <div className="demo-grid">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="demo-chip"
                  onClick={() => { setEmail(u.email); setStep('email'); setError(null) }}
                  title={u.email}
                >
                  <strong>{u.role}</strong>
                  <span>{u.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
