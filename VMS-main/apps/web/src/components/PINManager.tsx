import { useState, useEffect } from 'react'

interface VenuePIN {
  id: string
  pin: string
  qrUrl: string | null
  venue: { id: string; name: string; cityName: string }
  materialLogs: { event: string; serverTime: string }[]
}

const API_URL = 'http://localhost:3001/api'

function getToken(): string {
  return localStorage.getItem('vms_token') || 'MOCK_TOKEN'
}

export function PINManager() {
  const [exams, setExams] = useState<any[]>([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [pins, setPins] = useState<VenuePIN[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchExams()
  }, [])

  useEffect(() => {
    if (selectedExamId) fetchPins()
  }, [selectedExamId])

  async function fetchExams() {
    try {
      const res = await fetch(`${API_URL}/exams`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      })
      if (res.ok) setExams(await res.json())
    } catch (error) {
      console.error('Failed to fetch exams:', error)
    }
  }

  async function fetchPins() {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/material-tracking/pins?examId=${selectedExamId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      })
      if (res.ok) setPins(await res.json())
    } catch (error) {
      console.error('Failed to fetch PINs:', error)
    } finally {
      setLoading(false)
    }
  }

  async function generateAllPins() {
    if (!selectedExamId) return
    setGenerating(true)
    setMessage(null)

    try {
      // Get all venues assigned to this exam that don't have PINs yet
      const res = await fetch(`${API_URL}/venues/exams/${selectedExamId}/assignments`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Failed to fetch assignments')

      const assignments = await res.json()
      const existingVenueIds = new Set(pins.map(p => p.venue.id))
      const newAssignments = assignments.filter((a: any) => !existingVenueIds.has(a.venueId))

      let generated = 0
      for (const a of newAssignments) {
        const pinRes = await fetch(`${API_URL}/material-tracking/pin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ examId: selectedExamId, venueId: a.venueId }),
        })
        if (pinRes.ok) generated++
      }

      setMessage(`Generated ${generated} new PINs.`)
      fetchPins()
    } catch (error) {
      console.error('Failed to generate PINs:', error)
      setMessage('Error generating PINs.')
    } finally {
      setGenerating(false)
    }
  }

  function getDispatchStatus(logs: VenuePIN['materialLogs']): string {
    if (logs.some(l => l.event === 'DISPATCH_CONFIRMED')) return '✅ Dispatched'
    return '⏳ Pending'
  }

  function getReceiptStatus(logs: VenuePIN['materialLogs']): string {
    if (logs.some(l => l.event === 'DISCREPANCY_REPORTED')) return '🚨 Discrepancy'
    if (logs.some(l => l.event === 'RECEIPT_CONFIRMED')) return '✅ Received'
    return '⏳ Awaiting'
  }

  return (
    <div className="pin-manager">
      <div className="pm-header">Material PIN & QR Management</div>

      <div className="pm-controls">
        <div className="exam-selector">
          <label>Select Exam:</label>
          <select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}>
            <option value="">-- Select --</option>
            {exams.map(exam => (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.examCode})
              </option>
            ))}
          </select>
        </div>

        {selectedExamId && (
          <div className="pm-actions">
            <button className="pm-btn primary" onClick={generateAllPins} disabled={generating}>
              {generating ? 'Generating...' : 'Generate All PINs for Exam'}
            </button>
            <a
              className="pm-btn secondary"
              href={`${API_URL}/material-tracking/manifest/${selectedExamId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download QR Manifest (PDF)
            </a>
          </div>
        )}
      </div>

      {message && <div className="pm-message">{message}</div>}

      {loading && <div className="pm-loading">Loading PINs...</div>}

      {!loading && pins.length > 0 && (
        <table className="pm-table">
          <thead>
            <tr>
              <th>Venue</th>
              <th>City</th>
              <th>PIN</th>
              <th>QR</th>
              <th>Dispatch</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {pins.map(p => (
              <tr key={p.id}>
                <td>{p.venue.name}</td>
                <td>{p.venue.cityName}</td>
                <td><code>{p.pin}</code></td>
                <td>
                  {p.qrUrl ? (
                    <a href={p.qrUrl} target="_blank" rel="noopener noreferrer">View</a>
                  ) : (
                    <span className="text-grey">N/A</span>
                  )}
                </td>
                <td>{getDispatchStatus(p.materialLogs)}</td>
                <td>{getReceiptStatus(p.materialLogs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && selectedExamId && pins.length === 0 && (
        <div className="pm-empty">No PINs generated for this exam yet.</div>
      )}
    </div>
  )
}
