import { useState } from 'react'
import { useDrill } from '../lib/drill'
import { submitReport } from '../lib/submit'
import { EXAM_CONTEXT, VS_VENUE } from '../lib/mockData'
import { PhotoCapture } from '../components/PhotoCapture'
import type { CapturedPhoto } from '../components/PhotoCapture'

interface StageDef {
  id: string
  title: string
  reportType: string
  hint: string
  confirmLabel: string
  requiresPhoto?: boolean
  extra?: 'count' | 'witnesses' | 'attendance'
}

const STAGES: StageDef[] = [
  { id: 'gate', title: '1. Gate Closure', reportType: 'GATE_CLOSURE', hint: 'Close gates at scheduled reporting time.', confirmLabel: 'Gates closed at scheduled time', requiresPhoto: true, extra: 'count' },
  { id: 'biometric', title: '2. Biometric Verification', reportType: 'BIOMETRIC', hint: 'Biometric attendance captured for all candidates.', confirmLabel: 'Biometric verification completed', extra: 'count' },
  { id: 'jammer', title: '3. Jammer Confirmation', reportType: 'JAMMER', hint: 'Confirm mobile jammers are active and tested.', confirmLabel: 'Jammers active and signal blocked' },
  { id: 'qp', title: '4. Question Paper Opening', reportType: 'QP_OPENING', hint: 'Open QP box at the authorised time with witnesses.', confirmLabel: 'QP box seal intact, opened on time', requiresPhoto: true, extra: 'witnesses' },
  { id: 'attendance', title: '5. Final Attendance', reportType: 'ATTENDANCE', hint: 'Record present and absent candidate counts.', confirmLabel: 'Attendance reconciled', extra: 'attendance' },
]

export function ExamDayChecklist() {
  const { drill } = useDrill()
  const [open, setOpen] = useState<string>('gate')
  const [done, setDone] = useState<Record<string, boolean>>({})
  const completed = STAGES.filter((s) => done[s.id]).length

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>Exam-Day Checklist</h2>
        <p>{VS_VENUE.name} · {VS_VENUE.code}</p>
        <p className="screen-sub">{EXAM_CONTEXT.session}</p>
      </div>

      <div className="progress">
        <div className="progress-bar"><div style={{ width: `${(completed / STAGES.length) * 100}%` }} /></div>
        <span>{completed}/{STAGES.length} complete</span>
      </div>

      <div className="stage-list">
        {STAGES.map((stage, i) => {
          const isDone = !!done[stage.id]
          const locked = i > 0 && !done[STAGES[i - 1].id] && !isDone
          return (
            <Stage
              key={stage.id}
              stage={stage}
              isDone={isDone}
              locked={locked}
              expanded={open === stage.id}
              drill={drill}
              onToggle={() => setOpen(open === stage.id ? '' : stage.id)}
              onDone={() => {
                setDone((d) => ({ ...d, [stage.id]: true }))
                const next = STAGES[i + 1]
                if (next) setOpen(next.id)
              }}
            />
          )
        })}
      </div>

      {completed === STAGES.length && (
        <div className="all-done">✓ All exam-day stages submitted{drill ? ' (drill)' : ''}.</div>
      )}
    </div>
  )
}

function Stage({
  stage, isDone, locked, expanded, drill, onToggle, onDone,
}: {
  stage: StageDef; isDone: boolean; locked: boolean; expanded: boolean; drill: boolean
  onToggle: () => void; onDone: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [count, setCount] = useState('')
  const [absent, setAbsent] = useState('')
  const [witnesses, setWitnesses] = useState('')
  const [busy, setBusy] = useState(false)

  const photoOk = !stage.requiresPhoto || photos.length > 0
  const extraOk =
    stage.extra === 'count' ? count !== '' :
    stage.extra === 'witnesses' ? witnesses.trim() !== '' :
    stage.extra === 'attendance' ? count !== '' && absent !== '' : true
  const canSubmit = confirmed && photoOk && extraOk && !busy

  async function submit() {
    setBusy(true)
    const data: Record<string, unknown> = { confirmed: true }
    if (stage.extra === 'count') data.candidateCount = Number(count)
    if (stage.extra === 'attendance') { data.present = Number(count); data.absent = Number(absent) }
    if (stage.extra === 'witnesses') data.witnesses = witnesses
    data.photos = photos.map((p) => ({ sizeKb: p.sizeKb, geo: p.geo }))
    await submitReport({ venueId: VS_VENUE.id, reportType: stage.reportType, data, isDrill: drill })
    setBusy(false)
    onDone()
  }

  return (
    <div className={`stage ${isDone ? 'stage-done' : ''} ${locked ? 'stage-locked' : ''}`}>
      <button className="stage-head" onClick={onToggle} disabled={locked && !isDone}>
        <span className={`stage-check ${isDone ? 'on' : ''}`}>{isDone ? '✓' : ''}</span>
        <span className="stage-title">{stage.title}</span>
        <span className="stage-caret">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && !isDone && !locked && (
        <div className="stage-body">
          <p className="stage-hint">{stage.hint}</p>

          {stage.extra === 'count' && (
            <label className="fld"><span>Candidate count</span>
              <input type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="e.g. 1180" /></label>
          )}
          {stage.extra === 'attendance' && (
            <div className="fld-row">
              <label className="fld"><span>Present</span><input type="number" value={count} onChange={(e) => setCount(e.target.value)} /></label>
              <label className="fld"><span>Absent</span><input type="number" value={absent} onChange={(e) => setAbsent(e.target.value)} /></label>
            </div>
          )}
          {stage.extra === 'witnesses' && (
            <label className="fld"><span>Witness names</span>
              <input value={witnesses} onChange={(e) => setWitnesses(e.target.value)} placeholder="Names of witnesses present" /></label>
          )}

          {stage.requiresPhoto && <PhotoCapture photos={photos} onChange={setPhotos} />}

          <label className="confirm-row">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>{stage.confirmLabel}</span>
          </label>

          <button className="btn-primary" disabled={!canSubmit} onClick={submit}>
            {busy ? 'Saving…' : 'Confirm & submit'}
          </button>
        </div>
      )}

      {isDone && expanded && <div className="stage-body"><p className="stage-hint">Submitted and queued for sync.</p></div>}
    </div>
  )
}
