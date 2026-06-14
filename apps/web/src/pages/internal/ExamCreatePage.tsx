import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useMutation } from '../../lib/hooks'
import { useToast } from '../../components/Toast'
import type { Exam, ExamType } from '../../lib/domain'
import { num } from '../../lib/format'
import { PageHeader, Field, TextInput, Select } from '../../components/ui'

const EXAM_TYPES: ExamType[] = [
  'Civil Services (Prelims)', 'Civil Services (Mains)', 'Engineering Services', 'CDS', 'NDA', 'CAPF',
]

interface CityRow { id: number; city: string; state: string; suggestedCapacity: string }
let cityCounter = 1
const blankCity = (): CityRow => ({ id: cityCounter++, city: '', state: '', suggestedCapacity: '' })

export function ExamCreatePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const create = useMutation((payload: unknown) => api.post<Exam>('/exams', payload))

  const [name, setName] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [type, setType] = useState<ExamType>(EXAM_TYPES[0])
  const [examDate, setExamDate] = useState('')
  const [cities, setCities] = useState<CityRow[]>([blankCity()])

  function updateCity(id: number, patch: Partial<CityRow>) {
    setCities((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  const totalCapacity = cities.reduce((s, c) => s + (Number(c.suggestedCapacity) || 0), 0)
  const valid = name.trim() && examDate && cities.some((c) => c.city.trim() && Number(c.suggestedCapacity) > 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name, year, type, examDate,
      cities: cities
        .filter((c) => c.city.trim())
        .map((c) => ({ city: c.city, state: c.state, suggestedCapacity: Number(c.suggestedCapacity) || 0 })),
    }
    const exam = await create.run(payload)
    if (exam) {
      toast.success('Exam created')
      navigate(`/exams/${exam.id}`)
    }
  }

  return (
    <div className="page">
      <PageHeader title="Create Examination" subtitle="Define the exam, schedule and city-wise capacities" />

      <form onSubmit={submit} style={{ maxWidth: 820 }}>
        <div className="card card-pad">
          <div className="cols-2">
            <Field label="Examination name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Civil Services Examination 2026" required />
            </Field>
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as ExamType)}>
                {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Year">
              <TextInput type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </Field>
            <Field label="Exam date">
              <TextInput type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
            </Field>
          </div>
        </div>

        <div className="card card-pad" style={{ marginTop: '1.25rem' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.9rem' }}>
            <h3 style={{ fontSize: '1rem' }}>Cities &amp; capacities</h3>
            <span className="pill">Total: {num(totalCapacity)} candidates</span>
          </div>

          <div className="stack gap-sm">
            {cities.map((c) => (
              <div key={c.id} className="city-row">
                <TextInput placeholder="City" value={c.city} onChange={(e) => updateCity(c.id, { city: e.target.value })} />
                <TextInput placeholder="State" value={c.state} onChange={(e) => updateCity(c.id, { state: e.target.value })} />
                <TextInput type="number" placeholder="Capacity" value={c.suggestedCapacity} onChange={(e) => updateCity(c.id, { suggestedCapacity: e.target.value })} />
                <button type="button" className="btn btn-ghost" onClick={() => setCities((r) => r.length > 1 ? r.filter((x) => x.id !== c.id) : r)} aria-label="Remove">✕</button>
              </div>
            ))}
          </div>
          <button type="button" className="link-btn" style={{ marginTop: '0.8rem' }} onClick={() => setCities((r) => [...r, blankCity()])}>
            + Add another city
          </button>
        </div>

        {create.error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{create.error}</div>}

        <div className="row gap-sm" style={{ marginTop: '1.25rem' }}>
          <button className="btn btn-primary" disabled={!valid || create.busy}>{create.busy ? 'Creating…' : 'Create exam'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/exams')}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
