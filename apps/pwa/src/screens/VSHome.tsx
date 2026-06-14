import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { EXAM_CONTEXT, VS_VENUE } from '../lib/mockData'
import { formatDate } from '../lib/fmt'

export function VSHome() {
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0

  const tasks = [
    { to: '/vs/checklist', icon: '☑', title: 'Exam-Day Checklist', desc: 'Gate, biometric, jammer, QP, attendance' },
    { to: '/vs/staff', icon: '👥', title: 'Staff Deployment', desc: 'Record invigilators and duty staff' },
    { to: '/vs/dispatch', icon: '📦', title: 'Material Dispatch', desc: 'Post-exam sealed material confirmation' },
  ]

  return (
    <div className="screen">
      <div className="venue-card">
        <span className="venue-code">{VS_VENUE.code}</span>
        <strong>{VS_VENUE.name}</strong>
        <span className="venue-meta">{VS_VENUE.city} · Capacity {VS_VENUE.capacity}</span>
        <span className="venue-meta">{EXAM_CONTEXT.examName} · {formatDate(EXAM_CONTEXT.examDate)}</span>
      </div>

      <div className="task-tiles">
        {tasks.map((t) => (
          <Link key={t.to} to={t.to} className="task-tile">
            <span className="task-icon">{t.icon}</span>
            <div><strong>{t.title}</strong><p>{t.desc}</p></div>
            <span className="task-arrow">→</span>
          </Link>
        ))}
      </div>

      <p className="queue-note">{pending > 0 ? `${pending} report(s) queued for sync` : 'All reports synced'}</p>
    </div>
  )
}
