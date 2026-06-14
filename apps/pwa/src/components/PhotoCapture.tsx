import { useState } from 'react'
import imageCompression from 'browser-image-compression'
import type { GeoPoint } from '../lib/submit'

export interface CapturedPhoto {
  id: string
  url: string
  sizeKb: number
  geo: GeoPoint | null
}

// Camera capture with client-side compression (<300KB) and optional geo-tag.
export function PhotoCapture({
  photos, onChange, geoTag = false,
}: {
  photos: CapturedPhoto[]
  onChange: (photos: CapturedPhoto[]) => void
  geoTag?: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function capture(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    const next: CapturedPhoto[] = []
    for (const file of files) {
      try {
        const compressed = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1200, useWebWorker: true })
        let geo: GeoPoint | null = null
        if (geoTag) {
          const { getGeoPoint } = await import('../lib/submit')
          geo = await getGeoPoint()
        }
        next.push({
          id: `ph-${Math.random().toString(36).slice(2, 8)}`,
          url: URL.createObjectURL(compressed),
          sizeKb: Math.round(compressed.size / 1024),
          geo,
        })
      } catch { /* skip bad image */ }
    }
    onChange([...photos, ...next])
    setBusy(false)
  }

  return (
    <div className="photo-capture">
      <label className="photo-btn">
        <input type="file" accept="image/*" capture="environment" multiple hidden onChange={capture} />
        {busy ? 'Processing…' : geoTag ? '📷 Capture geo-tagged photo' : '📷 Capture photo'}
      </label>
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p) => (
            <div key={p.id} className="photo-thumb">
              <img src={p.url} alt="evidence" />
              <button type="button" className="photo-del" onClick={() => onChange(photos.filter((x) => x.id !== p.id))}>✕</button>
              <span className="photo-meta">{p.sizeKb}KB{p.geo ? ` · 📍${p.geo.lat.toFixed(3)},${p.geo.lng.toFixed(3)}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
