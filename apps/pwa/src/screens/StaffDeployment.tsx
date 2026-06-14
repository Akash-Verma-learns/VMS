import { useState } from 'react'
import { useDrill } from '../lib/drill'
import { submitReport } from '../lib/submit'
import { VS_VENUE } from '../lib/mockData'

interface StaffRow { id: number; name: string; duty: string }
let counter = 1
const blank = (): StaffRow => ({ id: counter++, name: '', duty: 'Invigilator' })

const DUTIES = ['Invigilator', 'Relief Invigilator', 'Frisking Staff', 'Class IV', 'IT Support']

export function StaffDeployment() {
  const { drill } = useDrill()
  const [rows, setRows] = useState<StaffRow[]>([blank(), blank()])
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function update(id: number, patch: Partial<StaffRow>) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }
  const valid = rows.some((r) => r.name.trim())

  async function submit() {
    setBusy(true)
    await submitReport({
      venueId: VS_VENUE.id,
      reportType: 'STAFF_DEPLOYMENT',
      data: { staff: rows.filter((r) => r.name.trim()).map(({ name, duty }) => ({ name, duty })) },
      isDrill: drill,
    })
    setBusy(false)
    setSubmitted(true)
  }

  if (submitted) {
    return <div className="screen"><div className="all-done">✓ Staff deployment submitted{drill ? ' (drill)' : ''}.</div>
      <button className="btn-text" onClick={() => { setSubmitted(false); setRows([blank(), blank()]) }}>Submit another</button></div>
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>Staff Deployment</h2>
        <p>{VS_VENUE.name} · {VS_VENUE.code}</p>
      </div>

      <div className="staff-list">
        {rows.map((r) => (
          <div key={r.id} className="staff-row">
            <input className="staff-name" placeholder="Staff name" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
            <select value={r.duty} onChange={(e) => update(r.id, { duty: e.target.value })}>
              {DUTIES.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button className="staff-del" onClick={() => setRows((x) => x.length > 1 ? x.filter((y) => y.id !== r.id) : x)}>✕</button>
          </div>
        ))}
      </div>
      <button className="btn-text" onClick={() => setRows((r) => [...r, blank()])}>+ Add staff member</button>

      <button className="btn-primary" disabled={!valid || busy} onClick={submit}>{busy ? 'Saving…' : 'Submit deployment'}</button>
    </div>
  )
}
