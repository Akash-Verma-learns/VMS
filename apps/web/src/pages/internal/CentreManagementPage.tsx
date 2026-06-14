import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useApi, useMutation } from '../../lib/hooks'
import { useToast } from '../../components/Toast'
import type { Centre, Exam } from '../../lib/domain'
import { num } from '../../lib/format'
import { PageHeader, StatusBadge, AsyncBoundary, Select, Stat } from '../../components/ui'

export function CentreManagementPage() {
  const toast = useToast()
  const { data, loading, error, reload } = useApi(() => api.get<Exam[]>('/exams'))
  const exams = (data ?? []).filter((e) => e.centres.length > 0)
  const [examId, setExamId] = useState<string>('')
  const [edits, setEdits] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!examId && exams.length) setExamId(exams[0].id)
  }, [exams, examId])

  const exam = exams.find((e) => e.id === examId)
  const override = useMutation((cId: string, finalCapacity: number) =>
    api.patch<Centre>(`/exams/${examId}/centre/${cId}`, { finalCapacity }))
  const release = useMutation(() => api.patch<Exam>(`/exams/${examId}/release`))

  async function saveOverride(c: Centre) {
    const raw = edits[c.id]
    const value = Number(raw)
    if (!raw || Number.isNaN(value)) return
    const res = await override.run(c.id, value)
    if (res) {
      toast.success(`${c.city} capacity updated to ${num(value)}`)
      setEdits((e) => { const n = { ...e }; delete n[c.id]; return n })
      reload()
    }
  }

  async function doRelease() {
    const res = await release.run()
    if (res) { toast.success('Centres released to coordinators'); reload() }
  }

  const released = exam?.status === 'released'

  return (
    <div className="page">
      <PageHeader title="Centre Management" subtitle="Review and override suggested capacities, then release" />

      <AsyncBoundary loading={loading} error={error} empty={exams.length === 0}>
        <div className="toolbar">
          <Select value={examId} onChange={(e) => setExamId(e.target.value)} style={{ maxWidth: 360 }}>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <div className="grow" />
          {exam && <StatusBadge status={exam.status} />}
          <button className="btn btn-primary" disabled={released || release.busy} onClick={doRelease}>
            {released ? 'Released' : release.busy ? 'Releasing…' : 'Release centres'}
          </button>
        </div>

        {exam && (
          <>
            <div className="stat-row">
              <Stat label="Suggested total" value={num(exam.centres.reduce((s, c) => s + c.suggestedCapacity, 0))} />
              <Stat label="Final total" value={num(exam.centres.reduce((s, c) => s + c.finalCapacity, 0))} />
              <Stat label="Overridden" value={exam.centres.filter((c) => c.status === 'overridden').length} tone="info" />
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>City</th><th style={{ textAlign: 'right' }}>Suggested</th>
                    <th style={{ width: 200 }}>Final capacity</th>
                    <th style={{ textAlign: 'right' }}>Venues</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {exam.centres.map((c) => {
                    const dirty = edits[c.id] !== undefined && Number(edits[c.id]) !== c.finalCapacity
                    return (
                      <tr key={c.id}>
                        <td><strong>{c.city}</strong><div className="faint">{c.state}</div></td>
                        <td style={{ textAlign: 'right' }}>{num(c.suggestedCapacity)}</td>
                        <td>
                          <input
                            className="input" type="number" disabled={released}
                            value={edits[c.id] ?? String(c.finalCapacity)}
                            onChange={(e) => setEdits((s) => ({ ...s, [c.id]: e.target.value }))}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>{c.venuesNeeded}</td>
                        <td><StatusBadge status={c.status} /></td>
                        <td>
                          {!released && (
                            <button className="btn btn-secondary" disabled={!dirty || override.busy} onClick={() => saveOverride(c)}>
                              Save
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  )
}
