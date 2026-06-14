import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthSuccess, Role, User } from '../lib/types'
import {
  api,
  getStoredUserRaw,
  getToken,
  setStoredUserRaw,
  setToken,
} from '../lib/api'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  user: User | null
  role: Role | null
  status: AuthStatus
  requestOtp: (email: string) => Promise<void>
  verifyOtp: (email: string, otp: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): User | null {
  const raw = getStoredUserRaw()
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  // Restore session from storage on first load.
  useEffect(() => {
    const token = getToken()
    const stored = readStoredUser()
    if (token && stored) {
      setUser(stored)
      setStatus('authenticated')
    } else {
      setStatus('unauthenticated')
    }
  }, [])

  async function requestOtp(email: string): Promise<void> {
    await api.post('/auth/request-otp', { email }, { auth: false })
  }

  async function verifyOtp(email: string, otp: string): Promise<User> {
    const res = await api.post<AuthSuccess>('/auth/verify-otp', { email, otp }, { auth: false })
    setToken(res.token)
    setStoredUserRaw(JSON.stringify(res.user))
    setUser(res.user)
    setStatus('authenticated')
    return res.user
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore network/logout errors — clear locally regardless
    }
    setToken(null)
    setStoredUserRaw(null)
    setUser(null)
    setStatus('unauthenticated')
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, role: user?.role ?? null, status, requestOtp, verifyOtp, logout }),
    [user, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
