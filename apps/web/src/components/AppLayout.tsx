import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLES } from '../lib/types'
import { sectionsForRole } from '../config/nav'
import { usingMocks } from '../lib/api'
import { Icon } from './Icon'

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null
  const sections = sectionsForRole(user.role)
  const roleInfo = ROLES[user.role]
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">VMS</div>
          <div className="brand-text">
            <strong>UPSC VMS</strong>
            <span>Venue Management</span>
          </div>
        </div>

        <nav className="nav">
          {sections.map((section) => (
            <div className="nav-section" key={section.title}>
              <p className="nav-section-title">{section.title}</p>
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className={`badge ${roleInfo.portal === 'external' ? 'badge-info' : 'badge-neutral'}`}>
            {roleInfo.portal} portal
          </span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            {usingMocks && <span className="badge badge-warning">Mock data</span>}
          </div>
          <div className="topbar-right">
            <div className="user-chip">
              <div className="avatar">{initials.toUpperCase()}</div>
              <div className="user-meta">
                <strong>{user.name}</strong>
                <span className="muted">{roleInfo.label} · {user.role}</span>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={handleLogout} title="Log out">
              <Icon name="logout" />
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
