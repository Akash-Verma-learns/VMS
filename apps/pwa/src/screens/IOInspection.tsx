import { useState } from 'react'
import { useDrill } from '../lib/drill'
import { submitReport } from '../lib/submit'
import { IO_VENUES } from '../lib/mockData'
import { PhotoCapture } from '../components/PhotoCapture'
import type { CapturedPhoto } from '../components/PhotoCapture'

const CHECK_ITEMS = [
  'Premises secured, single entry point enforced',
  'CCTV operational and recording',
  'Mobile jammers active',
  'Frisking and prohibited-item checks in place',
  'Notice board displays exam instructions',
  'Drinking water and medical aid available',
]

export function IOInspection() {
  const { drill } = useDrill()
  const [venueId, setVenueId] = useState(IO_VENUES[0].id)
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [remarks, setRemarks] = useState('')
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const venue = IO_VENUES.find((v) => v.id === venueId)!
  const allChecked = CHECK_ITEMS.every((c) => checks[c])
  const geoOk = photos.some((p) => p.geo)
  const valid = allChecked && photos.length > 0 && geoOk

  async function submit() {
    setBusy(true)
    await submitReport({
      venueId,
      reportType: 'IO_INSPECTION',
      data: {
        checklist: CHECK_ITEMS.map((c) => ({ item: c, ok: !!checks[c] })),
        remarks,
        photos: photos.map((p) => ({ sizeKb: p.sizeKb, geo: p.geo })),
      },
      isDrill: drill,
    })
    setBusy(false)
    setSubmitted(true)
  }

  if (submitted) {
    return <div className="screen"><div className="all-done">✓ Inspection submitted for {venue.name}{drill ? ' (drill)' : ''}.</div>
      <button className="btn-text" onClick={() => { setSubmitted(false); setChecks({}); setPhotos([]); setRemarks('') }}>Inspect another venue</button></div>
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>IO Inspection</h2>
        <p>Geo-tagged venue inspection</p>
      </div>

      <label className="fld"><span>Venue</span>
        <select value={venueId} onChange={(e) => { setVenueId(e.target.value); setChecks({}); setPhotos([]) }}>
          {IO_VENUES.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.code})</option>)}
        </select>
      </label>

      <div className="check-list">
        {CHECK_ITEMS.map((c) => (
          <label key={c} className={`check-item ${checks[c] ? 'on' : ''}`}>
            <input type="checkbox" checked={!!checks[c]} onChange={(e) => setChecks((s) => ({ ...s, [c]: e.target.checked }))} />
            <span>{c}</span>
          </label>
        ))}
      </div>

      <label className="fld"><span>Remarks</span>
        <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Observations, deficiencies, action taken…" /></label>

      <label className="fld"><span>Geo-tagged photo evidence (required)</span></label>
      <PhotoCapture photos={photos} onChange={setPhotos} geoTag />
      {photos.length > 0 && !geoOk && <p className="warn-text">⚠ Location not captured — enable location and retake at least one photo.</p>}

      <button className="btn-primary" disabled={!valid || busy} onClick={submit}>{busy ? 'Saving…' : 'Submit inspection'}</button>
    </div>
  )
}
