import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useDrill } from '../lib/drill'
import { EXAM_CONTEXT } from '../lib/mockData'
import { SyncStatus } from './SyncStatus'

interface Tab { to: string; label: string; icon: string }

const TABS: Record<string, Tab[]> = {
  VS: [
    { to: '/vs', label: 'Tasks', icon: '◉' },
    { to: '/vs/checklist', label: 'Exam Day', icon: '☑' },
    { to: '/vs/staff', label: 'Staff', icon: '👥' },
    { to: '/vs/dispatch', label: 'Dispatch', icon: '📦' },
  ],
  CS: [
    { to: '/cs', label: 'Centre', icon: '◉' },
  ],
  IO: [
    { to: '/io', label: 'Inspections', icon: '◉' },
  ],
}

export function Shell() {
  const { user, logout } = useAuth()
  const { drill, setDrill } = useDrill()
  const navigate = useNavigate()
  if (!user) return null

  const tabs = TABS[user.role] ?? []

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`shell ${drill ? 'drill' : ''}`}>
      <header className="app-bar">
        <div className="app-bar-main">
          <div>
            <strong>{EXAM_CONTEXT.examName}</strong>
            <span className="app-bar-sub">{user.name} · {user.role}</span>
          </div>
          <button className="icon-btn" onClick={handleLogout} aria-label="Log out">⏻</button>
        </div>
        <label className="drill-toggle">
          <input type="checkbox" checked={drill} onChange={(e) => setDrill(e.target.checked)} />
          <span>Drill mode</span>
        </label>
      </header>

      {drill && <div className="drill-banner">⚠ DRILL MODE — test submissions, not counted as live reports</div>}

      <SyncStatus />

      <main className="shell-main">
        <Outlet />
      </main>

      {tabs.length > 1 && (
        <nav className="tabbar">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
              <span className="tab-icon">{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
