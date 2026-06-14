import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Shell } from './components/Shell'
import { Login } from './components/Login'
import { VSHome } from './screens/VSHome'
import { ExamDayChecklist } from './screens/ExamDayChecklist'
import { StaffDeployment } from './screens/StaffDeployment'
import { MaterialDispatch } from './screens/MaterialDispatch'
import { CSDashboard } from './screens/CSDashboard'
import { IOInspection } from './screens/IOInspection'
import './App.css'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return <div className="boot">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={`/${user.role.toLowerCase()}`} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth><Shell /></RequireAuth>}>
        <Route path="/vs" element={<VSHome />} />
        <Route path="/vs/checklist" element={<ExamDayChecklist />} />
        <Route path="/vs/staff" element={<StaffDeployment />} />
        <Route path="/vs/dispatch" element={<MaterialDispatch />} />
        <Route path="/cs" element={<CSDashboard />} />
        <Route path="/io" element={<IOInspection />} />
      </Route>

      <Route path="/" element={<RoleRedirect />} />
      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  )
}

export default App
