import { api } from '../../lib/api'
import { useApi, useMutation } from '../../lib/hooks'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toast'
import type { Bill } from '../../lib/domain'
import { money, formatDate } from '../../lib/format'
import { PageHeader, StatusBadge, AsyncBoundary, Stat } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'

export function BillsPage() {
  const { role } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useApi(() => api.get<Bill[]>('/finance/bills'))
  const bills = data ?? []

  const verify = useMutation((id: string) => api.patch<Bill>(`/finance/bills/${id}/verify`))
  const approve = useMutation((id: string, action?: string) => api.patch<Bill>(`/finance/bills/${id}/approve`, { action }))

  const canVerify = role === 'US'
  const canApprove = role === 'DS' || role === 'JS'

  async function doVerify(b: Bill) { if (await verify.run(b.id)) { toast.success(`${b.ref} verified`); reload() } }
  async function doApprove(b: Bill, action?: string) {
    if (await approve.run(b.id, action)) { toast.success(`${b.ref} ${action === 'reject' ? 'rejected' : 'approved'}`); reload() }
  }

  const columns: Column<Bill>[] = [
    { header: 'Bill', cell: (b) => <div><strong>{b.ref}</strong><div className="faint">{b.venue}</div></div> },
    { header: 'Exam', cell: (b) => <span className="muted">{b.examName}</span> },
    { header: 'Submitted by', cell: (b) => <div>{b.submittedBy}<div className="faint">{formatDate(b.submittedAt)}</div></div> },
    { header: 'Amount', align: 'right', cell: (b) => money(b.amount) },
    { header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
    { header: '', align: 'right', cell: (b) => (
      <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
        {canVerify && b.status === 'submitted' && <button className="btn btn-primary" onClick={() => doVerify(b)} disabled={verify.busy}>Verify</button>}
        {canApprove && b.status === 'verified' && (
          <>
            <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={() => doApprove(b, 'reject')} disabled={approve.busy}>Reject</button>
            <button className="btn btn-primary" onClick={() => doApprove(b)} disabled={approve.busy}>Approve</button>
          </>
        )}
      </div>
    ) },
  ]

  return (
    <div className="page">
      <PageHeader title="Bill Verification" subtitle="Verify and approve submitted bills" />
      <AsyncBoundary loading={loading} error={error}>
        <div className="stat-row">
          <Stat label="Submitted" value={bills.filter((b) => b.status === 'submitted').length} tone="warning" />
          <Stat label="Verified" value={bills.filter((b) => b.status === 'verified').length} tone="info" />
          <Stat label="Approved" value={bills.filter((b) => b.status === 'approved').length} tone="success" />
          <Stat label="Total value" value={money(bills.reduce((s, b) => s + b.amount, 0))} />
        </div>
        <DataTable columns={columns} rows={bills} rowKey={(b) => b.id} />
      </AsyncBoundary>
    </div>
  )
}
