import { useState } from 'react'
import { api } from '../../lib/api'
import { useApi, useMutation } from '../../lib/hooks'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toast'
import type { Approval, ApprovalStep } from '../../lib/domain'
import { formatDateTime } from '../../lib/format'
import { PageHeader, StatusBadge, AsyncBoundary, Field, Textarea } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'

function ChainView({ steps }: { steps: ApprovalStep[] }) {
  return (
    <div className="chain">
      {steps.map((s, i) => (
        <div className="chain-step" key={i}>
          <div className="chain-rail">
            <div className={`chain-dot ${s.state}`}>{s.state === 'done' ? '✓' : i + 1}</div>
            <div className="chain-line" />
          </div>
          <div className="chain-body">
            <strong>{s.label}</strong>
            <div className="meta">
              {s.actor ? `${s.actor} · ${formatDateTime(s.actedAt)}` : s.state === 'current' ? 'Awaiting action' : 'Pending'}
            </div>
            {s.comment && <div className="comment">{s.comment}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ApprovalsPage() {
  const { role } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useApi(() => api.get<Approval[]>('/approvals'))
  const approvals = data ?? []
  const [active, setActive] = useState<Approval | null>(null)
  const [comment, setComment] = useState('')
  const action = useMutation((id: string, act: string, c: string) =>
    api.patch<Approval>(`/approvals/${id}/action`, { action: act, comment: c, role }))

  const canAct = active && active.status === 'pending' && active.currentRole === role

  async function act(kind: 'approve' | 'reject') {
    if (!active) return
    const res = await action.run(active.id, kind, comment)
    if (res) {
      toast.success(kind === 'approve' ? 'Approved' : 'Rejected')
      setActive(null); setComment(''); reload()
    }
  }

  const columns: Column<Approval>[] = [
    { header: 'Approval', cell: (a) => <div><strong>{a.title}</strong><div className="faint">{a.examName}</div></div> },
    { header: 'Type', cell: (a) => <span className="pill">{a.type}</span> },
    { header: 'Raised by', cell: (a) => a.raisedBy },
    { header: 'With', cell: (a) => a.status === 'pending' ? <span className="badge badge-info">{a.currentRole}</span> : <span className="faint">—</span> },
    { header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
  ]

  return (
    <div className="page">
      <PageHeader title="Approvals" subtitle="Maker-checker chain across approval types" />
      <AsyncBoundary loading={loading} error={error}>
        <DataTable columns={columns} rows={approvals} rowKey={(a) => a.id} onRowClick={(a) => { setActive(a); setComment('') }} />
      </AsyncBoundary>

      <Modal
        open={!!active}
        title={active?.title ?? ''}
        onClose={() => { setActive(null); setComment('') }}
        wide
        footer={canAct ? (
          <>
            <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={() => act('reject')} disabled={action.busy}>Reject</button>
            <button className="btn btn-primary" onClick={() => act('approve')} disabled={action.busy}>Approve &amp; forward</button>
          </>
        ) : (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {active?.status !== 'pending' ? 'This approval is closed.' : `Awaiting ${active?.currentRole} — you can’t act at this stage.`}
          </span>
        )}
      >
        {active && (
          <>
            <dl className="kv" style={{ marginBottom: '1.25rem' }}>
              <dt>Exam</dt><dd>{active.examName}</dd>
              <dt>Type</dt><dd>{active.type}</dd>
              <dt>Raised</dt><dd>{active.raisedBy} · {formatDateTime(active.raisedAt)}</dd>
            </dl>
            <h4 className="section-title" style={{ marginTop: 0 }}>Approval chain</h4>
            <ChainView steps={active.chain} />
            {canAct && (
              <div style={{ marginTop: '1rem' }}>
                <Field label="Comment (optional)">
                  <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note…" />
                </Field>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
