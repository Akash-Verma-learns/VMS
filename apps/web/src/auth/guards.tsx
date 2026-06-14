import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '../lib/types'
import { useAuth } from './AuthContext'

// Gate that requires an authenticated session. Preserves intended location
// so login can bounce the user back.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader />
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}

// Gate that additionally requires one of the given roles.
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader />
  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (!roles.includes(user.role)) {
    return <Navigate to="/403" replace />
  }
  return <>{children}</>
}

function FullScreenLoader() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <span className="muted">Loading…</span>
    </div>
  )
}
