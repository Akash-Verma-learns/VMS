import { useNavigate, useLocation } from 'react-router-dom'

export function RoleSwitcher() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="role-switcher">
      <span className="role-label">Test Role:</span>
      <button 
        className={location.pathname === '/vs' ? 'active' : ''} 
        onClick={() => navigate('/vs')}
      >
        VS
      </button>
      <button 
        className={location.pathname === '/cs' ? 'active' : ''} 
        onClick={() => navigate('/cs')}
      >
        CS
      </button>
      <button 
        className={location.pathname === '/io' ? 'active' : ''} 
        onClick={() => navigate('/io')}
      >
        IO
      </button>
    </div>
  )
}
