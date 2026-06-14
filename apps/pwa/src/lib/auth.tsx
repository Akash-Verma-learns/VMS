import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { FieldRole, FieldUser } from './mockData'
import { DEMO_OTP, findFieldUser, findFieldUserById } from './mockData'

const TOKEN_KEY = 'vms_token'
const USER_KEY = 'vms_user'

interface AuthValue {
  user: FieldUser | null
  role: FieldRole | null
  ready: boolean
  login: (email: string, otp: string) => Promise<FieldUser>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FieldUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(USER_KEY)
    if (raw) {
      try { setUser(JSON.parse(raw) as FieldUser) } catch { /* ignore */ }
    }
    setReady(true)
  }, [])

  async function login(email: string, otp: string): Promise<FieldUser> {
    await new Promise((r) => setTimeout(r, 250))
    const u = findFieldUser(email)
    if (!u || otp !== DEMO_OTP) throw new Error('Invalid email or OTP')
    localStorage.setItem(TOKEN_KEY, `mock.${u.id}`)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u)
    return u
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  const value = useMemo<AuthValue>(() => ({ user, role: user?.role ?? null, ready, login, logout }), [user, ready])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// re-export for token resolution in sync
export { findFieldUserById }
