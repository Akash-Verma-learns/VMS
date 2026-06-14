import { api } from '../../lib/api'
import { useApi, useMutation } from '../../lib/hooks'
import { useToast } from '../../components/Toast'
import type { Fal } from '../../lib/domain'
import { money, formatDate, relativeDays } from '../../lib/format'
import { PageHeader, StatusBadge, AsyncBoundary, Stat } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'

export function FalAckPage() {
  const toast = useToast()
  const { data, loading, error, reload } = useApi(() => api.get<Fal[]>('/fal'))
  const fals = data ?? []
  const ack = useMutation((id: string) => api.patch<Fal>(`/fal/${id}/acknowledge`))

  // CS only needs to act on sanctioned/overdue FALs awaiting acknowledgement.
  const pending = fals.filter((f) => f.status === 'sanctioned' || f.status === 'overdue')

  async function doAck(f: Fal) {
    if (await ack.run(f.id)) { toast.success(`Acknowledged ${f.ref}`); reload() }
  }

  const columns: Column<Fal>[] = [
    { header: 'Reference', cell: (f) => <strong>{f.ref}</strong> },
    { header: 'Centre', cell: (f) => <div>{f.centre}<div className="faint">{f.examName}</div></div> },
    { header: 'Amount', align: 'right', cell: (f) => money(f.amount) },
    { header: 'Due', cell: (f) => {
      const d = relativeDays(f.dueDate)
      return <div>{formatDate(f.dueDate)}{d !== null && d < 0 && <div className="faint" style={{ color: 'var(--danger)' }}>{Math.abs(d)}d overdue</div>}</div>
    } },
    { header: 'Status', cell: (f) => <StatusBadge status={f.status} /> },
    { header: '', align: 'right', cell: (f) => (
      (f.status === 'sanctioned' || f.status === 'overdue')
        ? <button className="btn btn-primary" onClick={() => doAck(f)} disabled={ack.busy}>Acknowledge</button>
        : <span className="badge badge-success">✓ Acknowledged</span>
    ) },
  ]

  return (
    <div className="page">
      <PageHeader title="FAL Acknowledgement" subtitle="Acknowledge receipt of sanctioned Facility Authorisation Letters" />
      <AsyncBoundary loading={loading} error={error}>
        <div className="stat-row">
          <Stat label="Awaiting acknowledgement" value={pending.length} tone="warning" />
          <Stat label="Overdue" value={fals.filter((f) => f.status === 'overdue').length} tone="danger" />
          <Stat label="Acknowledged" value={fals.filter((f) => f.status === 'acknowledged').length} tone="success" />
        </div>
        <DataTable columns={columns} rows={fals} rowKey={(f) => f.id} />
      </AsyncBoundary>
    </div>
  )
}
