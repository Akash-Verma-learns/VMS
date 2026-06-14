import { CS_VENUES, EXAM_CONTEXT } from '../lib/mockData'

function tone(readiness: number): string {
  if (readiness >= 100) return 'ok'
  if (readiness >= 50) return 'warn'
  return 'low'
}

export function CSDashboard() {
  const avg = Math.round(CS_VENUES.reduce((s, v) => s + v.readiness, 0) / CS_VENUES.length)

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>Centre Overview</h2>
        <p>{EXAM_CONTEXT.examName}</p>
        <p className="screen-sub">{CS_VENUES.length} venues · {EXAM_CONTEXT.session}</p>
      </div>

      <div className="cs-summary">
        <div className="cs-stat"><span>{avg}%</span><small>Avg readiness</small></div>
        <div className="cs-stat"><span>{CS_VENUES.filter((v) => v.readiness >= 100).length}</span><small>Ready</small></div>
        <div className="cs-stat"><span>{CS_VENUES.filter((v) => v.readiness < 100).length}</span><small>In progress</small></div>
      </div>

      <div className="venue-readiness-list">
        {CS_VENUES.map((v) => (
          <div key={v.venue.id} className="readiness-card">
            <div className="readiness-head">
              <div>
                <strong>{v.venue.name}</strong>
                <span className="venue-meta">{v.venue.code} · VS {v.vs}</span>
              </div>
              <span className={`readiness-pct ${tone(v.readiness)}`}>{v.readiness}%</span>
            </div>
            <div className="progress-bar"><div className={tone(v.readiness)} style={{ width: `${v.readiness}%` }} /></div>
            <span className="readiness-last">Last: {v.lastReport}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
