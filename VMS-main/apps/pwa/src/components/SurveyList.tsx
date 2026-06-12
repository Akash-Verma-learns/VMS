import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'

interface SurveyItem {
  id: string
  title: string
  description?: string
  dueAt?: number
  responded?: boolean
}

export function SurveyList() {
  const [surveys, setSurveys] = useState<SurveyItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadSurveys()
  }, [])

  async function loadSurveys() {
    try {
      // Try fetching from API first
      if (navigator.onLine) {
        const token = localStorage.getItem('vms_token') || 'MOCK_TOKEN'
        const response = await fetch('http://localhost:3001/api/surveys/mine', {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (response.ok) {
          const data = await response.json()
          setSurveys(data)
          // Cache for offline
          for (const s of data) {
            await db.surveys.put({
              id: s.id,
              title: s.title,
              description: s.description,
              questions: s.questions || [],
              dueAt: s.dueAt ? new Date(s.dueAt).getTime() : undefined,
              cachedAt: Date.now(),
            })
          }
          setLoading(false)
          return
        }
      }

      // Fallback: load from Dexie
      const cached = await db.surveys.orderBy('cachedAt').reverse().toArray()
      // Check which ones we've responded to
      const responded = await db.surveyResponses.toArray()
      const respondedIds = new Set(responded.map(r => r.surveyId))

      setSurveys(cached.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        dueAt: s.dueAt,
        responded: respondedIds.has(s.id),
      })))
    } catch (error) {
      console.error('Failed to load surveys:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="survey-list"><div className="sl-header">Loading surveys...</div></div>
  }

  return (
    <div className="survey-list">
      <div className="sl-header">My Surveys</div>
      {surveys.length === 0 && (
        <div className="sl-empty">No surveys assigned to you.</div>
      )}
      {surveys.map(survey => (
        <div
          key={survey.id}
          className="sl-item"
          onClick={() => navigate(`/survey/${survey.id}`)}
        >
          <div className="sl-title">{survey.title}</div>
          {survey.dueAt && (
            <div className="sl-due">Due: {new Date(survey.dueAt).toLocaleDateString()}</div>
          )}
          <div className={`sl-status ${survey.responded ? 'completed' : 'pending'}`}>
            {survey.responded ? '✅ Completed' : '⏳ Pending'}
          </div>
        </div>
      ))}
    </div>
  )
}
