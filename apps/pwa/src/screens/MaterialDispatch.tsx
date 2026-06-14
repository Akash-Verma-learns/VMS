import { useState } from 'react'
import { useDrill } from '../lib/drill'
import { submitReport } from '../lib/submit'
import { VS_VENUE } from '../lib/mockData'
import { PhotoCapture } from '../components/PhotoCapture'
import type { CapturedPhoto } from '../components/PhotoCapture'

export function MaterialDispatch() {
  const { drill } = useDrill()
  const [packets, setPackets] = useState('')
  const [scripts, setScripts] = useState('')
  const [courier, setCourier] = useState('')
  const [sealed, setSealed] = useState(false)
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const valid = packets !== '' && scripts !== '' && courier.trim() && sealed && photos.length > 0

  async function submit() {
    setBusy(true)
    await submitReport({
      venueId: VS_VENUE.id,
      reportType: 'MATERIAL_DISPATCH',
      data: {
        sealedPackets: Number(packets),
        answerScripts: Number(scripts),
        courierRef: courier,
        sealedConfirmed: true,
        photos: photos.map((p) => ({ sizeKb: p.sizeKb })),
      },
      isDrill: drill,
    })
    setBusy(false)
    setSubmitted(true)
  }

  if (submitted) {
    return <div className="screen"><div className="all-done">✓ Material dispatch confirmed{drill ? ' (drill)' : ''}.</div></div>
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>Post-Exam Material Dispatch</h2>
        <p>{VS_VENUE.name} · {VS_VENUE.code}</p>
      </div>

      <div className="fld-row">
        <label className="fld"><span>Sealed packets</span><input type="number" value={packets} onChange={(e) => setPackets(e.target.value)} /></label>
        <label className="fld"><span>Answer scripts</span><input type="number" value={scripts} onChange={(e) => setScripts(e.target.value)} /></label>
      </div>
      <label className="fld"><span>Courier / dispatch reference</span>
        <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. SPEED-POST AWB 1234567890" /></label>

      <label className="fld"><span>Sealed material photo</span></label>
      <PhotoCapture photos={photos} onChange={setPhotos} />

      <label className="confirm-row">
        <input type="checkbox" checked={sealed} onChange={(e) => setSealed(e.target.checked)} />
        <span>I confirm all material is sealed and handed to the courier.</span>
      </label>

      <button className="btn-primary" disabled={!valid || busy} onClick={submit}>{busy ? 'Saving…' : 'Confirm dispatch'}</button>
    </div>
  )
}
