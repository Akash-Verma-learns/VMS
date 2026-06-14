import { api } from '../../lib/api'
import { useApi, useMutation } from '../../lib/hooks'
import { useToast } from '../../components/Toast'
import type { Assignment, Supervisor } from '../../lib/domain'
import { PageHeader, StatusBadge, AsyncBoundary, Stat, Select } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'

export function AssignmentsPage() {
  const toast = useToast()
  const a = useApi(() => api.get<Assignment[]>('/assignments'))
  const s = useApi(() => api.get<Supervisor[]>('/supervisors'))
  const assignments = a.data ?? []
  const supervisors = s.data ?? []
  const assign = useMutation((id: string, vsId: string | null) => api.patch<Assignment>(`/assignments/${id}`, { vsId }))

  async function setVs(row: Assignment, vsId: string) {
    const res = await assign.run(row.id, vsId || null)
    if (res) { toast.success(vsId ? 'Supervisor assigned' : 'Assignment cleared'); a.reload() }
  }

  const columns: Column<Assignment>[] = [
    { header: 'Venue', cell: (r) => <div><strong>{r.venue}</strong><div className="faint">{r.city}</div></div> },
    { header: 'Assigned supervisor', width: '240px', cell: (r) => (
      <Select value={r.vsId ?? ''} onChange={(e) => setVs(r, e.target.value)} disabled={r.status === 'submitted'}>
        <option value="">— Unassigned —</option>
        {supervisors.map((sup) => (
          <option key={sup.id} value={sup.id} disabled={!sup.available && sup.id !== r.vsId}>
            {sup.name}{!sup.available ? ' (busy)' : ''}
          </option>
        ))}
      </Select>
    ) },
    { header: 'Previous cycle', cell: (r) => r.previousVsName ?? <span className="faint">—</span> },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
  ]

  const assigned = assignments.filter((x) => x.vsId).length

  return (
    <div className="page">
      <PageHeader title="VS Assignment" subtitle="Assign venue supervisors from the supervisor pool" />
      <AsyncBoundary loading={a.loading || s.loading} error={a.error || s.error}>
        <div className="stat-row">
          <Stat label="Venues" value={assignments.length} />
          <Stat label="Assigned" value={assigned} tone="success" />
          <Stat label="Unassigned" value={assignments.length - assigned} tone="warning" />
          <Stat label="Pool available" value={supervisors.filter((x) => x.available).length} />
        </div>
        <DataTable columns={columns} rows={assignments} rowKey={(r) => r.id} />
      </AsyncBoundary>
    </div>
  )
}
