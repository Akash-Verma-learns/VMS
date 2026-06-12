import { useState, useEffect, useRef } from 'react'

interface QuestionSummary {
  questionId: string
  text: string
  type: string
  yesCount?: number
  noCount?: number
  options?: Record<string, number>
  values?: string[]
  total: number
}

interface SurveySummary {
  surveyId: string
  totalDistributed: number
  totalResponded: number
  questions: QuestionSummary[]
}

const API_URL = 'http://localhost:3001/api'

function getToken(): string {
  return localStorage.getItem('vms_token') || 'MOCK_TOKEN'
}

export function SurveyDashboard({ surveyId }: { surveyId: string }) {
  const [summary, setSummary] = useState<SurveySummary | null>(null)
  const [connected, setConnected] = useState(false)
  const [surveyTitle, setSurveyTitle] = useState('')
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    fetchSurveyMeta()
    connectSSE()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [surveyId])

  async function fetchSurveyMeta() {
    try {
      const res = await fetch(`${API_URL}/surveys/${surveyId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSurveyTitle(data.title)
      }
    } catch {
      // Ignore
    }
  }

  function connectSSE() {
    const es = new EventSource(`${API_URL}/surveys/${surveyId}/live`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setSummary(data)
      } catch {
        // Ignore parse errors
      }
    }

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
  }

  if (!summary) {
    return <div className="survey-dashboard"><div className="sd-header">Loading dashboard...</div></div>
  }

  return (
    <div className="survey-dashboard">
      <div className="sd-header">
        <div className="sd-title">{surveyTitle}</div>
        <div className="sd-live-dot-container">
          <span className={`sd-live-dot ${connected ? 'connected' : 'disconnected'}`}></span>
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>

      <div className="sd-progress">
        {summary.totalResponded} of {summary.totalDistributed} responded
        <div className="sd-progress-bar">
          <div
            className="sd-progress-fill"
            style={{
              width: summary.totalDistributed > 0
                ? `${(summary.totalResponded / summary.totalDistributed) * 100}%`
                : '0%'
            }}
          ></div>
        </div>
      </div>

      <div className="sd-questions">
        {summary.questions.map(q => (
          <div key={q.questionId} className="sd-question">
            <div className="sd-question-text">{q.text}</div>
            <div className="sd-question-count">{q.total} answers</div>

            {q.type === 'BOOLEAN' && q.yesCount !== undefined && (
              <div className="sd-boolean-bar">
                <div className="sd-bar-row">
                  <span className="sd-bar-label">Yes</span>
                  <div className="sd-bar-track">
                    <div
                      className="sd-bar-fill yes"
                      style={{ width: q.total > 0 ? `${(q.yesCount / q.total) * 100}%` : '0%' }}
                    ></div>
                  </div>
                  <span className="sd-bar-pct">{q.total > 0 ? Math.round((q.yesCount / q.total) * 100) : 0}%</span>
                </div>
                <div className="sd-bar-row">
                  <span className="sd-bar-label">No</span>
                  <div className="sd-bar-track">
                    <div
                      className="sd-bar-fill no"
                      style={{ width: q.total > 0 ? `${((q.noCount ?? 0) / q.total) * 100}%` : '0%' }}
                    ></div>
                  </div>
                  <span className="sd-bar-pct">{q.total > 0 ? Math.round(((q.noCount ?? 0) / q.total) * 100) : 0}%</span>
                </div>
              </div>
            )}

            {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTI_CHOICE') && q.options && (
              <div className="sd-choice-bars">
                {Object.entries(q.options).map(([opt, count]) => (
                  <div key={opt} className="sd-bar-row">
                    <span className="sd-bar-label">{opt}</span>
                    <div className="sd-bar-track">
                      <div
                        className="sd-bar-fill choice"
                        style={{ width: q.total > 0 ? `${(count / q.total) * 100}%` : '0%' }}
                      ></div>
                    </div>
                    <span className="sd-bar-pct">{count}</span>
                  </div>
                ))}
              </div>
            )}

            {(q.type === 'TEXT' || q.type === 'NUMBER') && q.values && (
              <div className="sd-text-responses">
                {q.values.slice(0, 20).map((v, i) => (
                  <div key={i} className="sd-text-item">"{v}"</div>
                ))}
                {q.values.length > 20 && (
                  <div className="sd-text-more">...and {q.values.length - 20} more</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
