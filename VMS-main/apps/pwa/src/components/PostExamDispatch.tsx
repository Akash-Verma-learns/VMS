import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../lib/db'
import { syncMaterialLogs } from '../lib/sync'

export function PostExamDispatch() {
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [scannerActive, setScannerActive] = useState(false)
  const [omrCount, setOmrCount] = useState('')
  const [salCount, setSalCount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const scannerRef = useRef<any>(null)

  const venueId = 'VENUE-123'

  useEffect(() => {
    startScanner()
    return () => { stopScanner() }
  }, [])

  async function startScanner() {
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader-dispatch')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          setScanResult(decodedText)
          stopScanner()
        },
        () => {}
      )
      setScannerActive(true)
    } catch (error) {
      console.error('Scanner init error:', error)
      setMessage('Camera not available. Enter PIN manually.')
    }
  }

  function stopScanner() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setScannerActive(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!scanResult) return
    setIsSubmitting(true)

    let lat: number | undefined
    let lng: number | undefined

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      )
      lat = pos.coords.latitude
      lng = pos.coords.longitude
    } catch {
      // Geo not available
    }

    try {
      const logId = uuidv4()
      await db.materialLogs.add({
        id: logId,
        pinId: scanResult,
        venueId,
        event: 'POST_EXAM_DISPATCH',
        packageCount: (Number(omrCount) || 0) + (Number(salCount) || 0),
        remarks: `OMR: ${omrCount || '0'}, SAL: ${salCount || '0'}. ${remarks}`.trim(),
        latitude: lat,
        longitude: lng,
        status: 'pending',
        createdAt: Date.now(),
      })

      setMessage('✅ Post-exam dispatch confirmed and saved.')
      setOmrCount('')
      setSalCount('')
      setRemarks('')

      if (navigator.onLine) syncMaterialLogs()
    } catch (error) {
      console.error('Error saving dispatch:', error)
      setMessage('Failed to save dispatch.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="material-scan-container">
      <div className="scan-header">Post-Exam Material Dispatch</div>
      <div className="venue-info">Venue: {venueId}</div>

      {!scanResult && (
        <div className="scanner-box">
          <div id="qr-reader-dispatch" style={{ width: '100%' }}></div>
          {!scannerActive && (
            <button className="submit-btn" onClick={() => startScanner()}>
              Start Camera
            </button>
          )}
        </div>
      )}

      {scanResult && (
        <>
          <div className="scan-result">
            <strong>Scanned PIN:</strong> {scanResult}
          </div>

          <form onSubmit={handleSubmit} className="confirm-form">
            <div className="form-group">
              <label>OMR Sheets Count</label>
              <input
                type="number"
                min="0"
                value={omrCount}
                onChange={e => setOmrCount(e.target.value)}
                placeholder="Number of OMR sheets"
              />
            </div>

            <div className="form-group">
              <label>SAL Packets Count</label>
              <input
                type="number"
                min="0"
                value={salCount}
                onChange={e => setSalCount(e.target.value)}
                placeholder="Number of SAL packets"
              />
            </div>

            <div className="form-group">
              <label>Remarks (optional)</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                placeholder="Any notes"
              ></textarea>
            </div>

            <button type="submit" disabled={isSubmitting} className="submit-btn">
              {isSubmitting ? 'Saving...' : 'Confirm Dispatch'}
            </button>
          </form>
        </>
      )}

      {message && <div className="scan-message">{message}</div>}
    </div>
  )
}
