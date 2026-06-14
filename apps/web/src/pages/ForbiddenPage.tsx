import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return (
    <div className="page" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <div className="card card-pad" style={{ textAlign: 'center', maxWidth: 420 }}>
        <h1 style={{ fontSize: '2.5rem' }}>403</h1>
        <p className="muted" style={{ marginBottom: '1.25rem' }}>
          Your role doesn’t have access to this screen.
        </p>
        <Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>
      </div>
    </div>
  )
}
