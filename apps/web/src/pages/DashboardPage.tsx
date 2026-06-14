import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLES } from '../lib/types'
import { navItemsForRole } from '../config/nav'
import { Icon } from '../components/Icon'

export function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null

  const roleInfo = ROLES[user.role]
  // Quick links = the role's nav items minus the dashboard itself.
  const quickLinks = navItemsForRole(user.role).filter((i) => i.path !== '/dashboard')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Welcome, {user.name.split(' ')[0]}</h1>
          <p className="muted">
            {roleInfo.label} · {roleInfo.portal === 'external' ? 'External' : 'Internal'} portal
          </p>
        </div>
      </div>

      <div className="quick-grid">
        {quickLinks.map((item) => (
          <Link to={item.path} key={item.path} className="quick-card card">
            <div className="quick-icon"><Icon name={item.icon} size={20} /></div>
            <div>
              <strong>{item.label}</strong>
              <p className="muted">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
