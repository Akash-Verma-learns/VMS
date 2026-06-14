import { Navigate } from "react-router-dom"
import { useAuthStore } from "../store/auth"

interface Props {
  allowedRoles: string[]
  children: React.ReactNode
}

export default function ProtectedRoute({ allowedRoles, children }: Props) {
  const { token, user } = useAuthStore()

  if (!token || !user) return <Navigate to="/" replace />

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-upsc-bg">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You do not have permission to view this page.</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-navy text-white rounded-lg hover:bg-navy-light"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
