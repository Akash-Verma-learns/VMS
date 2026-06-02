import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import imageCompression from 'browser-image-compression'
import { db } from '../lib/db'
import { syncOutbox } from '../lib/sync'

export function Checklist() {
  const [photos, setPhotos] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Hardcoded for demo/testing
  const venueId = 'VENUE-123' 
  
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const compressedPhotos: File[] = []
    
    for (const file of files) {
      try {
        // Compress photo to under 300KB
        const options = {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1200,
          useWebWorker: true
        }
        const compressedFile = await imageCompression(file, options)
        compressedPhotos.push(compressedFile)
      } catch (error) {
        console.error('Error compressing image:', error)
      }
    }

    setPhotos(prev => [...prev, ...compressedPhotos])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Collect mock form data
    const formData = new FormData(e.target as HTMLFormElement)
    const data = {
      seatingReady: formData.get('seatingReady') === 'on',
      lightingVerified: formData.get('lightingVerified') === 'on',
      remarks: formData.get('remarks')
    }

    try {
      // Create payload UUID
      const payloadId = uuidv4()

      // Write to IndexedDB
      await db.outbox.add({
        id: payloadId,
        venueId,
        isDrill: false, // Prod mode
        reportType: 'PRE_EXAM_READINESS',
        data,
        status: 'pending',
        createdAt: Date.now()
      })

      // Optimistic UI clear
      ;(e.target as HTMLFormElement).reset()
      setPhotos([])
      alert('Checklist securely saved locally.')

      // Trigger background sync immediately if online
      if (navigator.onLine) {
        syncOutbox()
      }
    } catch (error) {
      console.error('Error saving checklist:', error)
      alert('Failed to save checklist locally.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="checklist-card">
      <h2>Pre-Exam Readiness Checklist</h2>
      <p className="subtitle">Venue: {venueId}</p>

      <form onSubmit={handleSubmit} className="checklist-form">
        <div className="form-group checkbox-group">
          <label>
            <input type="checkbox" name="seatingReady" required />
            Main hall seating arrangement complete
          </label>
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input type="checkbox" name="lightingVerified" required />
            Adequate lighting and ventilation verified
          </label>
        </div>

        <div className="form-group">
          <label>Remarks</label>
          <textarea name="remarks" rows={3} placeholder="Any structural issues?"></textarea>
        </div>

        <div className="form-group">
          <label>Photo Evidence (Max 300KB each)</label>
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            onChange={handlePhotoCapture} 
            multiple
          />
          <div className="photo-preview-list">
            {photos.map((photo, index) => (
              <div key={index} className="photo-preview">
                <img src={URL.createObjectURL(photo)} alt="preview" />
                <span className="photo-size">{(photo.size / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Saving securely...' : 'Submit Checklist to CS'}
        </button>
      </form>
    </div>
  )
}
