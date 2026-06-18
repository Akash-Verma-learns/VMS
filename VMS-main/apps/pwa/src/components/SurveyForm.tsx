import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../lib/db'
import { syncSurveyResponses } from '../lib/sync'

interface Question {
  id: string
  order: number
  text: string
  type: string
  options?: string[]
  required: boolean
}

export function SurveyForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadSurvey()
  }, [id])

  async function loadSurvey() {
    if (!id) return

    try {
      // Try API first
      if (navigator.onLine) {
        const token = localStorage.getItem('vms_token') || 'MOCK_TOKEN'
        const response = await fetch(`http://localhost:3001/api/surveys/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (response.ok) {
          const data = await response.json()
          setTitle(data.title)
          setDescription(data.description || '')
          setQuestions(data.questions || [])

          // Check if already responded
          const myResponse = data.responses?.find((r: any) => r.userId === 'CURRENT_USER')
          if (myResponse) {
            setSubmitted(true)
            const existingAnswers: Record<string, string> = {}
            for (const a of myResponse.answers) {
              existingAnswers[a.questionId] = a.value
            }
            setAnswers(existingAnswers)
          }

          setLoading(false)
          return
        }
      }

      // Fallback: Dexie
      const cached = await db.surveys.get(id)
      if (cached) {
        setTitle(cached.title)
        setDescription(cached.description || '')
        setQuestions(cached.questions || [])
      }

      // Check if already submitted offline
      const existing = await db.surveyResponses.where('surveyId').equals(id).first()
      if (existing) {
        setSubmitted(true)
        const existingAnswers: Record<string, string> = {}
        for (const a of existing.answers) {
          existingAnswers[a.questionId] = a.value
        }
        setAnswers(existingAnswers)
      }
    } catch (error) {
      console.error('Error loading survey:', error)
    } finally {
      setLoading(false)
    }
  }

  function updateAnswer(questionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  function toggleMultiChoice(questionId: string, option: string) {
    setAnswers(prev => {
      const current = prev[questionId] ? prev[questionId].split(',') : []
      const index = current.indexOf(option)
      if (index > -1) {
        current.splice(index, 1)
      } else {
        current.push(option)
      }
      return { ...prev, [questionId]: current.join(',') }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id || submitted) return
    setIsSubmitting(true)

    // Validate required questions
    for (const q of questions) {
      if (q.required && !answers[q.id]) {
        setMessage(`Please answer: "${q.text}"`)
        setIsSubmitting(false)
        return
      }
    }

    try {
      const responseId = uuidv4()
      const answersList = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value,
      }))

      await db.surveyResponses.add({
        id: responseId,
        surveyId: id,
        answers: answersList,
        deviceTime: Date.now(),
        status: 'pending',
        createdAt: Date.now(),
      })

      setSubmitted(true)
      setMessage('✅ Response saved locally.')

      if (navigator.onLine) syncSurveyResponses()
    } catch (error) {
      console.error('Error saving response:', error)
      setMessage('Failed to save response.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <div className="survey-form"><div className="sf-title">Loading survey...</div></div>
  }

  return (
    <div className="survey-form">
      <div className="sf-title">{title}</div>
      {description && <div className="sf-description">{description}</div>}

      <form onSubmit={handleSubmit}>
        <div className="sf-questions">
          {questions.map(q => (
            <div key={q.id} className="sf-question">
              <div className="sf-question-text">
                {q.order}. {q.text}
                {q.required && <span className="required-mark">*</span>}
              </div>

              {q.type === 'TEXT' && (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={e => updateAnswer(q.id, e.target.value)}
                  rows={3}
                  disabled={submitted}
                  placeholder="Your answer..."
                ></textarea>
              )}

              {q.type === 'NUMBER' && (
                <input
                  type="number"
                  value={answers[q.id] || ''}
                  onChange={e => updateAnswer(q.id, e.target.value)}
                  disabled={submitted}
                  placeholder="Enter a number"
                />
              )}

              {q.type === 'BOOLEAN' && (
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={answers[q.id] === 'true'}
                      onChange={() => updateAnswer(q.id, 'true')}
                      disabled={submitted}
                    />
                    Yes
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={answers[q.id] === 'false'}
                      onChange={() => updateAnswer(q.id, 'false')}
                      disabled={submitted}
                    />
                    No
                  </label>
                </div>
              )}

              {q.type === 'SINGLE_CHOICE' && q.options && (
                <div className="radio-group">
                  {q.options.map(opt => (
                    <label key={opt} className="radio-label">
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[q.id] === opt}
                        onChange={() => updateAnswer(q.id, opt)}
                        disabled={submitted}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'MULTI_CHOICE' && q.options && (
                <div className="checkbox-group-choices">
                  {q.options.map(opt => (
                    <label key={opt} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={(answers[q.id] || '').split(',').includes(opt)}
                        onChange={() => toggleMultiChoice(q.id, opt)}
                        disabled={submitted}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {!submitted && (
          <button type="submit" disabled={isSubmitting} className="submit-btn sf-submit">
            {isSubmitting ? 'Saving...' : 'Submit Response'}
          </button>
        )}
      </form>

      {submitted && (
        <div className="scan-message" style={{ color: 'var(--gt-green)' }}>
          Response submitted. Thank you!
        </div>
      )}

      {message && <div className="scan-message">{message}</div>}

      <button
        className="submit-btn"
        style={{ marginTop: '1rem', backgroundColor: '#718096' }}
        onClick={() => navigate('/surveys')}
      >
        ← Back to Surveys
      </button>
    </div>
  )
}
