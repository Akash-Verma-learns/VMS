import { useLocation } from 'react-router-dom'
import { findNavItem } from '../config/nav'
import { Icon } from '../components/Icon'

// Placeholder for routes whose screen isn't built yet. Renders the feature's
// purpose and the API endpoints it will use, so the full IA is navigable and
// the build plan is visible.
export function FeatureStubPage() {
  const { pathname } = useLocation()
  const item = findNavItem(pathname)

  return (
    <div className="page">
      <div className="page-head">
        <div className="row gap-sm">
          {item && <span className="stub-icon"><Icon name={item.icon} size={22} /></span>}
          <div>
            <h1>{item?.label ?? 'Screen'}</h1>
            <p className="muted">{item?.description ?? 'This screen is not built yet.'}</p>
          </div>
        </div>
        <span className="badge badge-warning">Not built yet</span>
      </div>

      <div className="card card-pad">
        <h3 style={{ marginBottom: '0.75rem' }}>Planned API integration</h3>
        {item?.endpoints?.length ? (
          <ul className="endpoint-list">
            {item.endpoints.map((ep) => (
              <li key={ep}><code>{ep}</code></li>
            ))}
          </ul>
        ) : (
          <p className="muted">Endpoints to be confirmed.</p>
        )}
      </div>
    </div>
  )
}
