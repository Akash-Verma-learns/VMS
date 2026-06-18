import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../lib/db'
import { syncMaterialLogs } from '../lib/sync'

export function MaterialScan() {
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [scannerActive, setScannerActive] = useState(false)
  const [packageCount, setPackageCount] = useState('')
  const [sealIntact, setSealIntact] = useState<boolean | null>(null)
  const [remarks, setRemarks] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const scannerRef = useRef<any>(null)

  const venueId = 'VENUE-123' // Hardcoded for demo

  useEffect(() => {
    startScanner()
    return () => {
      stopScanner()
    }
  }, [])

  async function startScanner() {
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          setScanResult(decodedText)
          stopScanner()

          // Check if PIN matches expected venue
          db.staticData.get('venue-pin').then(expectedPin => {
            if (expectedPin && expectedPin.pin !== decodedText) {
              setMessage('⚠️ PIN MISMATCH — This package may not be for your venue!')
              // Auto-create discrepancy log
              handleDiscrepancy(decodedText)
            }
          })
        },
        () => { /* ignore scan failures */ }
      )
      setScannerActive(true)
    } catch (error) {
      console.error('Scanner init error:', error)
      setMessage('Camera access denied or not available. Enter PIN manually.')
    }
  }

  function stopScanner() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setScannerActive(false)
  }

  async function handleDiscrepancy(pin?: string) {
    const logId = uuidv4()
    let lat: number | undefined
    let lng: number | undefined

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      )
      lat = pos.coords.latitude
      lng = pos.coords.longitude
    } catch {
      // Geo not available — fine
    }

    await db.materialLogs.add({
      id: logId,
      pinId: pin || scanResult || '',
      venueId,
      event: 'DISCREPANCY_REPORTED',
      remarks: remarks || 'PIN mismatch detected',
      latitude: lat,
      longitude: lng,
      status: 'pending',
      createdAt: Date.now(),
    })

    setMessage('🚨 Discrepancy reported. Alert sent to CS.')
    if (navigator.onLine) syncMaterialLogs()
  }

  async function handleConfirmReceipt(e: React.FormEvent) {
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
        event: 'RECEIPT_CONFIRMED',
        packageCount: packageCount ? Number(packageCount) : undefined,
        sealIntact: sealIntact ?? undefined,
        remarks: remarks || undefined,
        latitude: lat,
        longitude: lng,
        status: 'pending',
        createdAt: Date.now(),
      })

      setMessage('✅ Receipt confirmed and saved locally.')
      setPackageCount('')
      setSealIntact(null)
      setRemarks('')

      if (navigator.onLine) syncMaterialLogs()
    } catch (error) {
      console.error('Error saving receipt:', error)
      setMessage('Failed to save receipt.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="material-scan-container">
      <div className="scan-header">Material Receipt Scan</div>
      <div className="venue-info">Venue: {venueId}</div>

      {!scanResult && (
        <div className="scanner-box">
          <div id="qr-reader" style={{ width: '100%' }}></div>
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

          <form onSubmit={handleConfirmReceipt} className="confirm-form">
            <div className="form-group">
              <label>Package Count</label>
              <input
                type="number"
                min="0"
                value={packageCount}
                onChange={e => setPackageCount(e.target.value)}
                placeholder="Number of packages"
              />
            </div>

            <div className="form-group">
              <label>Seal Intact?</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="sealIntact"
                    checked={sealIntact === true}
                    onChange={() => setSealIntact(true)}
                  />
                  Yes
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="sealIntact"
                    checked={sealIntact === false}
                    onChange={() => setSealIntact(false)}
                  />
                  No
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Remarks (optional)</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                placeholder="Any notes about the delivery"
              ></textarea>
            </div>

            <button type="submit" disabled={isSubmitting} className="submit-btn">
              {isSubmitting ? 'Saving...' : 'Confirm Receipt'}
            </button>
          </form>

          <button className="discrepancy-btn" onClick={() => handleDiscrepancy()}>
            Report Discrepancy
          </button>
        </>
      )}

      {message && <div className="scan-message">{message}</div>}

      <button
        className="submit-btn"
        style={{ marginTop: '1rem', backgroundColor: '#718096' }}
        onClick={() => {
          setScanResult(null)
          setMessage(null)
          startScanner()
        }}
      >
        Scan Another
      </button>
    </div>
  )
}
