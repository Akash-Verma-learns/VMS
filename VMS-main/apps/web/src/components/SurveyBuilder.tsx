import { useState } from 'react'

interface QuestionInput {
  order: number
  text: string
  type: string
  options: string[]
  required: boolean
}

const API_URL = 'http://localhost:3001/api'

function getToken(): string {
  return localStorage.getItem('vms_token') || 'MOCK_TOKEN'
}

export function SurveyBuilder() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [questions, setQuestions] = useState<QuestionInput[]>([])
  const [filterRoles, setFilterRoles] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [createdSurveyId, setCreatedSurveyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  function addQuestion() {
    setQuestions(prev => [
      ...prev,
      { order: prev.length + 1, text: '', type: 'TEXT', options: [], required: true },
    ])
  }

  function removeQuestion(index: number) {
    setQuestions(prev => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i + 1 })))
  }

  function updateQuestion(index: number, field: string, value: any) {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q))
  }

  function addOption(index: number) {
    setQuestions(prev => prev.map((q, i) =>
      i === index ? { ...q, options: [...q.options, ''] } : q
    ))
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    setQuestions(prev => prev.map((q, i) =>
      i === qIndex
        ? { ...q, options: q.options.map((o, j) => j === oIndex ? value : o) }
        : q
    ))
  }

  function removeOption(qIndex: number, oIndex: number) {
    setQuestions(prev => prev.map((q, i) =>
      i === qIndex
        ? { ...q, options: q.options.filter((_, j) => j !== oIndex) }
        : q
    ))
  }

  function toggleRole(role: string) {
    setFilterRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  async function saveDraft() {
    if (!title) {
      setMessage('Title is required.')
      return
    }
    setSaving(true)
    setMessage(null)

    try {
      const body: any = {
        title,
        description: description || undefined,
        dueAt: dueAt || undefined,
        questions: questions.map(q => ({
          order: q.order,
          text: q.text,
          type: q.type,
          options: q.options.length > 0 ? q.options : undefined,
          required: q.required,
        })),
      }

      const res = await fetch(`${API_URL}/surveys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Save failed')
      }

      const survey = await res.json()
      setCreatedSurveyId(survey.id)
      setMessage(`Draft saved. Survey ID: ${survey.id}`)
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!createdSurveyId) {
      setMessage('Save draft first.')
      return
    }
    if (filterRoles.length === 0) {
      setMessage('Select at least one recipient role.')
      return
    }
    setPublishing(true)
    setMessage(null)

    try {
      const res = await fetch(`${API_URL}/surveys/${createdSurveyId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ recipientFilter: { roles: filterRoles } }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Publish failed')
      }

      const data = await res.json()
      setMessage(`Published! Distributed to ${data.distributed} recipients.`)
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    } finally {
      setPublishing(false)
    }
  }

  const showOptions = (type: string) => type === 'SINGLE_CHOICE' || type === 'MULTI_CHOICE'

  return (
    <div className="survey-builder">
      <div className="sb-header">Create Survey</div>

      <div className="sb-meta">
        <div className="sb-field">
          <label>Title *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Survey title" />
        </div>
        <div className="sb-field">
          <label>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optional description" />
        </div>
        <div className="sb-field">
          <label>Due Date</label>
          <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} />
        </div>
      </div>

      <div className="sb-questions">
        <div className="sb-section-title">Questions</div>
        {questions.map((q, i) => (
          <div key={i} className="qe-row">
            <div className="qe-header">
              <span className="qe-number">Q{q.order}</span>
              <button className="qe-remove" onClick={() => removeQuestion(i)}>✕</button>
            </div>
            <div className="qe-fields">
              <select value={q.type} onChange={e => updateQuestion(i, 'type', e.target.value)} className="qe-type">
                <option value="TEXT">Text</option>
                <option value="BOOLEAN">Yes/No</option>
                <option value="SINGLE_CHOICE">Single Choice</option>
                <option value="MULTI_CHOICE">Multiple Choice</option>
                <option value="NUMBER">Number</option>
              </select>
              <input
                type="text"
                value={q.text}
                onChange={e => updateQuestion(i, 'text', e.target.value)}
                placeholder="Question text"
                className="qe-text"
              />
              <label className="qe-required-toggle">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={e => updateQuestion(i, 'required', e.target.checked)}
                />
                Required
              </label>
            </div>
            {showOptions(q.type) && (
              <div className="qe-options">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="qe-option-row">
                    <input
                      type="text"
                      value={opt}
                      onChange={e => updateOption(i, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                    />
                    <button className="qe-remove-opt" onClick={() => removeOption(i, oi)}>✕</button>
                  </div>
                ))}
                <button className="qe-add-opt" onClick={() => addOption(i)}>+ Add Option</button>
              </div>
            )}
          </div>
        ))}
        <button className="sb-add-btn" onClick={addQuestion}>+ Add Question</button>
      </div>

      <div className="sb-recipients">
        <div className="sb-section-title">Recipients</div>
        <div className="sb-role-checkboxes">
          {['VS', 'CS', 'IO', 'SO', 'ASO'].map(role => (
            <label key={role} className="sb-role-label">
              <input
                type="checkbox"
                checked={filterRoles.includes(role)}
                onChange={() => toggleRole(role)}
              />
              {role}
            </label>
          ))}
        </div>
      </div>

      {message && <div className="sb-message">{message}</div>}

      <div className="sb-actions">
        <button className="sb-btn save" onClick={saveDraft} disabled={saving}>
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button className="sb-btn publish" onClick={publish} disabled={publishing || !createdSurveyId}>
          {publishing ? 'Publishing...' : 'Publish'}
        </button>
      </div>
    </div>
  )
}
