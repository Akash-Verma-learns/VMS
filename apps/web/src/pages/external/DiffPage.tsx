import { useState } from 'react'
import { api } from '../../lib/api'
import { useApi } from '../../lib/hooks'
import { useToast } from '../../components/Toast'
import type { Assignment } from '../../lib/domain'
import { PageHeader, AsyncBoundary, Stat, Field, Textarea } from '../../components/ui'
import { Modal } from '../../components/Modal'

type Resolution = 'pending' | 'confirmed' | 'justified'

export function DiffPage() {
  const toast = useToast()
  const { data, loading, error } = useApi(() => api.get<Assignment[]>('/assignments'))
  const rows = data ?? []
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({})
  const [justifying, setJustifying] = useState<Assignment | null>(null)
  const [reason, setReason] = useState('')

  // A change = supervisor differs from previous cycle (incl. newly added).
  const changes = rows.filter((r) => (r.vsName ?? null) !== (r.previousVsName ?? null))

  function confirm(r: Assignment) {
    setResolutions((s) => ({ ...s, [r.id]: 'confirmed' }))
    toast.success('Change confirmed')
  }
  function saveJustification() {
    if (!justifying) return
    if (!reason.trim()) { toast.error('Enter a justification'); return }
    setResolutions((s) => ({ ...s, [justifying.id]: 'justified' }))
    toast.success('Justification recorded')
    setJustifying(null); setReason('')
  }

  const resolved = changes.filter((r) => resolutions[r.id] && resolutions[r.id] !== 'pending').length

  return (
    <div className="page">
      <PageHeader title="Diff vs Previous Cycle" subtitle="Confirm or justify changes from the last examination cycle" />
      <AsyncBoundary loading={loading} error={error}>
        <div className="stat-row">
          <Stat label="Total venues" value={rows.length} />
          <Stat label="Changes detected" value={changes.length} tone="warning" />
          <Stat label="Resolved" value={resolved} tone="success" />
          <Stat label="Outstanding" value={changes.length - resolved} tone={changes.length - resolved ? 'danger' : 'success'} />
        </div>

        {changes.length === 0 ? (
          <div className="empty"><strong>No changes</strong><p className="muted">All assignments match the previous cycle.</p></div>
        ) : (
          <div className="stack gap">
            {changes.map((r) => {
              const res = resolutions[r.id] ?? 'pending'
              return (
                <div key={r.id} className="card card-pad">
                  <div className="row" style={{ justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <strong>{r.venue}</strong> <span className="faint">· {r.city}</span>
                      <div className="diff-line">
                        <span className="diff-old">{r.previousVsName ?? 'Not used last cycle'}</span>
                        <span className="diff-arrow">→</span>
                        <span className="diff-new">{r.vsName ?? 'Unassigned'}</span>
                      </div>
                    </div>
                    <div className="row gap-sm">
                      {res === 'pending' ? (
                        <>
                          <button className="btn btn-secondary" onClick={() => setJustifying(r)}>Justify</button>
                          <button className="btn btn-primary" onClick={() => confirm(r)}>Confirm</button>
                        </>
                      ) : (
                        <span className={`badge badge-${res === 'confirmed' ? 'success' : 'info'}`}>{res}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </AsyncBoundary>

      <Modal
        open={!!justifying}
        title="Justify change"
        onClose={() => { setJustifying(null); setReason('') }}
        footer={<><button className="btn btn-secondary" onClick={() => { setJustifying(null); setReason('') }}>Cancel</button><button className="btn btn-primary" onClick={saveJustification}>Save justification</button></>}
      >
        {justifying && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>{justifying.venue} — {justifying.previousVsName ?? 'new'} → {justifying.vsName ?? 'unassigned'}</p>
            <Field label="Reason for change">
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Previous supervisor unavailable; reallocated from pool." />
            </Field>
          </>
        )}
      </Modal>
    </div>
  )
}
