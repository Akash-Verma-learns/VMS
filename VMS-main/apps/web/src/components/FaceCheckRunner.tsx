import { useState, useRef } from 'react'
import { loadModels, getDescriptor, compareDescriptors } from '../lib/faceApi'
import { FaceMatchCard } from './FaceMatchCard'

const API_URL = 'http://localhost:3001/api'

function getToken(): string {
  return localStorage.getItem('vms_token') || 'MOCK_TOKEN'
}

interface VenuePhoto {
  id: string
  photoUrl: string
  capturedAt: string
}

interface ReferencePhoto {
  id: string
  photoUrl: string
  label: string
}

interface MatchResult {
  venuePhotoId: string
  venuePhotoUrl: string
  referencePhotoId: string
  referencePhotoUrl: string
  refLabel: string
  distance: number
  matched: boolean
  resultId?: string
  reviewStatus: string
}

export function FaceCheckRunner() {
  const [step, setStep] = useState(1)
  const [jobId, setJobId] = useState<string | null>(null)
  const [examId, setExamId] = useState('')
  const [exams, setExams] = useState<any[]>([])
  const [referencePhotos, setReferencePhotos] = useState<ReferencePhoto[]>([])
  const [venuePhotos, setVenuePhotos] = useState<VenuePhoto[]>([])
  const [results, setResults] = useState<MatchResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [filterFlagged, setFilterFlagged] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch exams on mount
  useState(() => {
    fetch(`${API_URL}/exams`, {
      headers: { 'Authorization': `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(setExams)
      .catch(console.error)
  })

  async function createJobAndUpload() {
    if (!examId) {
      setMessage('Select an exam first.')
      return
    }

    try {
      // Create job
      const jobRes = await fetch(`${API_URL}/face-auth/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ examId }),
      })

      if (!jobRes.ok) throw new Error('Failed to create job')
      const job = await jobRes.json()
      setJobId(job.id)
      setMessage(`Job created: ${job.id}`)
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    }
  }

  async function uploadRefPhotos() {
    if (!jobId || !fileInputRef.current?.files?.length) {
      setMessage('Select files to upload.')
      return
    }

    const files = Array.from(fileInputRef.current.files)
    let uploaded = 0

    for (const file of files) {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('label', `Suspect-${String.fromCharCode(65 + uploaded)}`)

      const res = await fetch(`${API_URL}/face-auth/jobs/${jobId}/reference-photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData,
      })

      if (res.ok) {
        const photo = await res.json()
        setReferencePhotos(prev => [...prev, photo])
        uploaded++
      }
    }

    setMessage(`Uploaded ${uploaded} reference photos.`)
    setStep(2)
  }

  async function loadVenuePhotos() {
    if (!jobId) return
    setMessage('Loading venue photos...')

    try {
      const res = await fetch(`${API_URL}/face-auth/jobs/${jobId}/start`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${getToken()}` },
      })

      if (!res.ok) throw new Error('Failed to start job')
      const data = await res.json()
      setVenuePhotos(data.venuePhotoUrls)
      setReferencePhotos(data.referencePhotoUrls)
      setMessage(`Loaded ${data.venuePhotoUrls.length} venue photos and ${data.referencePhotoUrls.length} reference photos.`)
      setStep(3)
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    }
  }

  async function runMatching() {
    setRunning(true)
    setResults([])
    setMessage('Loading face recognition models...')

    try {
      await loadModels()
      setMessage('Models loaded. Computing descriptors...')

      const total = venuePhotos.length * referencePhotos.length
      setProgress({ current: 0, total })

      const threshold = 0.6
      const allResults: MatchResult[] = []
      let processed = 0

      // Compute reference descriptors once
      const refDescriptors: { photo: ReferencePhoto; descriptor: Float32Array | null }[] = []
      for (const ref of referencePhotos) {
        const desc = await getDescriptor(ref.photoUrl)
        refDescriptors.push({ photo: ref, descriptor: desc })
      }

      // Compare each venue photo against each reference
      for (const vp of venuePhotos) {
        const vpDesc = await getDescriptor(vp.photoUrl)

        for (const { photo: ref, descriptor: refDesc } of refDescriptors) {
          processed++
          setProgress({ current: processed, total })

          if (!vpDesc || !refDesc) {
            // No face detected in one of the photos
            continue
          }

          const distance = compareDescriptors(vpDesc, refDesc)
          const matched = distance < threshold

          allResults.push({
            venuePhotoId: vp.id,
            venuePhotoUrl: vp.photoUrl,
            referencePhotoId: ref.id,
            referencePhotoUrl: ref.photoUrl,
            refLabel: ref.label,
            distance,
            matched,
            reviewStatus: 'PENDING_REVIEW',
          })
        }

        // Yield to browser every 5 venue photos
        if (processed % (refDescriptors.length * 5) === 0) {
          await new Promise(r => setTimeout(r, 0))
        }
      }

      setResults(allResults.sort((a, b) => a.distance - b.distance))
      setMessage(`Matching complete. ${allResults.filter(r => r.matched).length} flagged out of ${allResults.length} comparisons.`)

      // Submit results to API
      await submitResultsToAPI(allResults)
      setStep(4)
    } catch (error: any) {
      setMessage(`Error during matching: ${error.message}`)
    } finally {
      setRunning(false)
    }
  }

  async function submitResultsToAPI(matchResults: MatchResult[]) {
    if (!jobId) return

    try {
      const res = await fetch(`${API_URL}/face-auth/jobs/${jobId}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          totalComparisons: matchResults.length,
          results: matchResults.map(r => ({
            venuePhotoId: r.venuePhotoId,
            referencePhotoId: r.referencePhotoId,
            distance: r.distance,
            matched: r.matched,
            threshold: 0.6,
          })),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setMessage(prev => `${prev} Results saved: ${data.inserted} inserted, ${data.flagged} flagged.`)
      }
    } catch (error) {
      console.error('Failed to submit results:', error)
    }
  }

  async function handleReview(resultId: string, status: string, note: string) {
    try {
      const res = await fetch(`${API_URL}/face-auth/results/${resultId}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ reviewStatus: status, reviewNote: note }),
      })

      if (res.ok) {
        setResults(prev => prev.map(r =>
          r.resultId === resultId ? { ...r, reviewStatus: status } : r
        ))
      }
    } catch (error) {
      console.error('Review failed:', error)
    }
  }

  const displayResults = filterFlagged ? results.filter(r => r.matched) : results

  return (
    <div className="face-check-runner">
      <div className="fcr-header">Face Authentication — Post-Exam Forensic</div>

      <div className="fcr-warning">
        ⚠️ This tool is for post-exam forensic review only.
        Results are advisory. No candidate is rejected based on this system.
      </div>

      <div className="fcr-steps">
        <div className={`fcr-step ${step >= 1 ? 'active' : ''}`}>1. Upload References</div>
        <div className={`fcr-step ${step >= 2 ? 'active' : ''}`}>2. Load Venue Photos</div>
        <div className={`fcr-step ${step >= 3 ? 'active' : ''}`}>3. Run Matching</div>
        <div className={`fcr-step ${step >= 4 ? 'active' : ''}`}>4. Review Results</div>
      </div>

      {step === 1 && (
        <div className="fcr-step-content">
          <div className="fcr-field">
            <label>Select Exam:</label>
            <select value={examId} onChange={e => setExamId(e.target.value)}>
              <option value="">-- Select --</option>
              {exams.map((exam: any) => (
                <option key={exam.id} value={exam.id}>{exam.name} ({exam.examCode})</option>
              ))}
            </select>
          </div>

          {!jobId && (
            <button className="fcr-btn primary" onClick={createJobAndUpload}>Create Job</button>
          )}

          {jobId && (
            <>
              <div className="fcr-field">
                <label>Upload Reference Photos:</label>
                <input type="file" ref={fileInputRef} accept="image/*" multiple />
              </div>
              <button className="fcr-btn primary" onClick={uploadRefPhotos}>Upload & Next</button>

              {referencePhotos.length > 0 && (
                <div className="fcr-ref-list">
                  {referencePhotos.map(p => (
                    <div key={p.id} className="fcr-ref-item">
                      <img src={p.photoUrl} alt={p.label} className="fcr-ref-thumb" />
                      <span>{p.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="fcr-step-content">
          <div className="fcr-venue-stats">
            {venuePhotos.length > 0
              ? `${venuePhotos.length} venue photos loaded.`
              : 'Click to fetch venue photos from the API.'}
          </div>
          <button className="fcr-btn primary" onClick={loadVenuePhotos}>
            Fetch Photo URLs from API
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="fcr-step-content">
          <div className="fcr-venue-stats">
            {venuePhotos.length} venue photos × {referencePhotos.length} references = {venuePhotos.length * referencePhotos.length} comparisons
          </div>

          {running && (
            <div className="fcr-progress">
              <div className="fcr-progress-bar">
                <div
                  className="fcr-progress-fill"
                  style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                ></div>
              </div>
              <div className="fcr-progress-text">
                Analysing {progress.current} of {progress.total}...
              </div>
            </div>
          )}

          <button className="fcr-btn primary" onClick={runMatching} disabled={running}>
            {running ? 'Running...' : 'Start Matching'}
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="fcr-step-content">
          <div className="fcr-filter">
            <label>
              <input
                type="checkbox"
                checked={filterFlagged}
                onChange={e => setFilterFlagged(e.target.checked)}
              />
              Show flagged only ({results.filter(r => r.matched).length})
            </label>
          </div>

          <div className="fcr-results-grid">
            {displayResults.map((r, i) => (
              <FaceMatchCard
                key={i}
                venuePhotoUrl={r.venuePhotoUrl}
                venuePhotoCaption={`Photo ${r.venuePhotoId.slice(0, 8)}`}
                refPhotoUrl={r.referencePhotoUrl}
                refLabel={r.refLabel}
                distance={r.distance}
                matched={r.matched}
                reviewStatus={r.reviewStatus}
                resultId={r.resultId ?? ''}
                showReviewActions={true}
                onReview={handleReview}
              />
            ))}
          </div>
        </div>
      )}

      {message && <div className="fcr-message">{message}</div>}
    </div>
  )
}
