import { useState } from 'react'
import { api } from '../../lib/api'
import { useApi, useMutation } from '../../lib/hooks'
import { useToast } from '../../components/Toast'
import type { Venue } from '../../lib/domain'
import { num } from '../../lib/format'
import { PageHeader, StatusBadge, AsyncBoundary, Stat, Field, Textarea } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'

export function VenueReviewQueuePage() {
  const toast = useToast()
  const { data, loading, error, reload } = useApi(() => api.get<Venue[]>('/venues'))
  const venues = data ?? []
  const [active, setActive] = useState<Venue | null>(null)
  const [note, setNote] = useState('')
  const review = useMutation((id: string, action: string, n?: string) =>
    api.patch<Venue>(`/venues/${id}/review`, { action, note: n }))

  async function act(action: 'approve' | 'reject' | 'annotate') {
    if (!active) return
    if (action === 'annotate' && !note.trim()) { toast.error('Add an annotation note first'); return }
    const res = await review.run(active.id, action, note || active.note)
    if (res) {
      toast.success(`Venue ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'annotated'}`)
      setActive(null); setNote(''); reload()
    }
  }

  const columns: Column<Venue>[] = [
    { header: 'Venue', cell: (v) => <div><strong>{v.name}</strong><div className="faint">{v.address}</div></div> },
    { header: 'City', cell: (v) => v.city },
    { header: 'Capacity', align: 'right', cell: (v) => num(v.capacity) },
    { header: 'Docs', align: 'right', cell: (v) => v.documents.length },
    { header: 'Prev. cycle', cell: (v) => v.usedLastCycle ? <span className="pill">Reused</span> : <span className="faint">New</span> },
    { header: 'Status', cell: (v) => <StatusBadge status={v.status} /> },
  ]

  const pending = venues.filter((v) => v.status === 'pending').length

  return (
    <div className="page">
      <PageHeader title="Venue Review Queue" subtitle="Approve, annotate or reject submitted venues" />
      <AsyncBoundary loading={loading} error={error}>
        <div className="stat-row">
          <Stat label="Pending review" value={pending} tone="warning" />
          <Stat label="Approved" value={venues.filter((v) => v.status === 'approved').length} tone="success" />
          <Stat label="Annotated" value={venues.filter((v) => v.status === 'annotated').length} tone="info" />
          <Stat label="Rejected" value={venues.filter((v) => v.status === 'rejected').length} tone="danger" />
        </div>
        <DataTable columns={columns} rows={venues} rowKey={(v) => v.id} onRowClick={(v) => { setActive(v); setNote(v.note ?? '') }} />
      </AsyncBoundary>

      <Modal
        open={!!active}
        title={active?.name ?? ''}
        onClose={() => { setActive(null); setNote('') }}
        wide
        footer={active && (
          <>
            <button className="btn btn-secondary" onClick={() => act('annotate')} disabled={review.busy}>Annotate</button>
            <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={() => act('reject')} disabled={review.busy}>Reject</button>
            <button className="btn btn-primary" onClick={() => act('approve')} disabled={review.busy}>Approve</button>
          </>
        )}
      >
        {active && (
          <>
            <dl className="kv">
              <dt>Address</dt><dd>{active.address}, {active.city}, {active.state}</dd>
              <dt>Capacity</dt><dd>{num(active.capacity)} candidates</dd>
              <dt>Submitted by</dt><dd>{active.submittedBy}</dd>
              <dt>Status</dt><dd><StatusBadge status={active.status} /></dd>
            </dl>
            <h4 className="section-title">Documents</h4>
            <ul className="file-list">
              {active.documents.map((d) => (
                <li key={d.id}><span className="badge badge-neutral">{d.kind}</span><span className="file-name">{d.name}</span><span className="faint">{d.sizeKb} KB</span></li>
              ))}
            </ul>
            <div style={{ marginTop: '1rem' }}>
              <Field label="Annotation / rejection note">
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the coordinator…" />
              </Field>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
