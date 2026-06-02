import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import imageCompression from 'browser-image-compression'
import { db } from '../lib/db'
import { syncOutbox } from '../lib/sync'

export function IODashboard() {
  const [photos, setPhotos] = useState<{file: File, lat: number | null, lng: number | null}[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const venueId = 'VENUE-456'

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    let lat: number | null = null
    let lng: number | null = null

    // Get Geolocation
    if ('geolocation' in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        })
        lat = position.coords.latitude
        lng = position.coords.longitude
      } catch (err) {
        console.warn('Geolocation failed', err)
      }
    }

    const newPhotos = []
    
    for (const file of files) {
      try {
        const compressedFile = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1200 })
        newPhotos.push({ file: compressedFile, lat, lng })
      } catch (error) {
        console.error('Error compressing image:', error)
      }
    }

    setPhotos(prev => [...prev, ...newPhotos])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (photos.length < 5) {
      alert('Minimum 5 geo-tagged photos required.')
      return
    }

    setIsSubmitting(true)
    const formData = new FormData(e.target as HTMLFormElement)
    const data = {
      infrastructure: formData.get('infrastructure') === 'on',
      accessibility: formData.get('accessibility') === 'on',
      security: formData.get('security') === 'on',
      remarks: formData.get('remarks')
    }

    try {
      const payloadId = uuidv4()
      await db.outbox.add({
        id: payloadId,
        venueId,
        isDrill: false,
        reportType: 'INSPECTION_REPORT',
        data,
        status: 'pending',
        createdAt: Date.now()
      })

      ;(e.target as HTMLFormElement).reset()
      setPhotos([])
      alert('Inspection Report saved securely.')

      if (navigator.onLine) {
        syncOutbox()
      }
    } catch (error) {
      console.error(error)
      alert('Failed to save report locally.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="checklist-card">
      <h2>Inspection Portal</h2>
      <p className="subtitle">Venue: {venueId}</p>

      <form onSubmit={handleSubmit} className="checklist-form">
        <div className="form-section">
          <h3>Section A: Infrastructure</h3>
          <label className="checkbox-label">
            <input type="checkbox" name="infrastructure" required />
            Hall layout matches approved seating plan
          </label>
        </div>

        <div className="form-section">
          <h3>Section B: Accessibility</h3>
          <label className="checkbox-label">
            <input type="checkbox" name="accessibility" required />
            PwBD ramp and facilities adequate
          </label>
        </div>

        <div className="form-section">
          <h3>Section C: Security</h3>
          <label className="checkbox-label">
            <input type="checkbox" name="security" required />
            Perimeter secured
          </label>
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>Remarks</label>
          <textarea name="remarks" rows={3}></textarea>
        </div>

        <div className="form-group">
          <label>Capture Geo-tagged Photos (Min 5)</label>
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            onChange={handlePhotoCapture} 
            multiple
          />
          <div className="photo-preview-list">
            {photos.map((p, index) => (
              <div key={index} className="photo-preview">
                <img src={URL.createObjectURL(p.file)} alt="preview" />
                <span className="photo-size" style={{ fontSize: '0.5rem' }}>
                  {p.lat ? '📍 Tagged' : 'No GPS'}
                </span>
              </div>
            ))}
          </div>
          <p className="helper-text" style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: photos.length >= 5 ? 'var(--gt-green)' : 'var(--gt-coral)' }}>
            Photos taken: {photos.length} / 5 minimum
          </p>
        </div>

        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Saving...' : 'Submit Inspection Report'}
        </button>
      </form>
    </div>
  )
}
