import { useState } from 'react'
import { api } from '../../lib/api'
import { useApi, useMutation } from '../../lib/hooks'
import { useToast } from '../../components/Toast'
import type { Assignment } from '../../lib/domain'
import { PageHeader, AsyncBoundary, Stat } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'

export function SubmitPage() {
  const toast = useToast()
  const { data, loading, error, reload } = useApi(() => api.get<Assignment[]>('/assignments'))
  const rows = data ?? []
  const [agree, setAgree] = useState(false)
  const submit = useMutation(() => api.post<{ submitted: number }>('/assignments/submit'))

  const unassigned = rows.filter((r) => !r.vsId)
  const alreadySubmitted = rows.length > 0 && rows.every((r) => r.status === 'submitted' || !r.vsId)
  const canSubmit = agree && unassigned.length === 0 && !alreadySubmitted

  async function doSubmit() {
    const res = await submit.run()
    if (res) { toast.success(`Submitted ${res.submitted} venues to UPSC`); reload() }
  }

  const columns: Column<Assignment>[] = [
    { header: 'Venue', cell: (r) => <strong>{r.venue}</strong> },
    { header: 'City', cell: (r) => r.city },
    { header: 'Supervisor', cell: (r) => r.vsName ?? <span className="badge badge-warning">Unassigned</span> },
    { header: 'Status', cell: (r) => <span className={`badge badge-${r.status === 'submitted' ? 'success' : 'neutral'}`}>{r.status}</span> },
  ]

  return (
    <div className="page">
      <PageHeader title="Submit Venue List to UPSC" subtitle="Final review and submission of the assigned venue list" />
      <AsyncBoundary loading={loading} error={error}>
        <div className="stat-row">
          <Stat label="Venues" value={rows.length} />
          <Stat label="Assigned" value={rows.filter((r) => r.vsId).length} tone="success" />
          <Stat label="Unassigned" value={unassigned.length} tone={unassigned.length ? 'danger' : 'success'} />
        </div>

        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />

        <div className="card card-pad" style={{ marginTop: '1.25rem' }}>
          {unassigned.length > 0 && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {unassigned.length} venue(s) still unassigned. Assign all supervisors before submitting.
            </div>
          )}
          {alreadySubmitted && (
            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>This venue list has already been submitted to UPSC.</div>
          )}
          <label className="row gap-sm" style={{ cursor: 'pointer', marginBottom: '1rem' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={alreadySubmitted} />
            <span>I confirm the venue list and supervisor assignments are final and accurate.</span>
          </label>
          <button className="btn btn-primary btn-lg" disabled={!canSubmit || submit.busy} onClick={doSubmit}>
            {submit.busy ? 'Submitting…' : 'Submit to UPSC'}
          </button>
        </div>
      </AsyncBoundary>
    </div>
  )
}
