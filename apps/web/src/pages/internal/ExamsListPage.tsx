import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useApi } from '../../lib/hooks'
import { useAuth } from '../../auth/AuthContext'
import type { Exam } from '../../lib/domain'
import { formatDate, num } from '../../lib/format'
import { PageHeader, StatusBadge, AsyncBoundary } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'

export function ExamsListPage() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const { data, loading, error } = useApi(() => api.get<Exam[]>('/exams'))
  const exams = data ?? []

  const columns: Column<Exam>[] = [
    { header: 'Examination', cell: (e) => <strong>{e.name}</strong> },
    { header: 'Type', cell: (e) => <span className="muted">{e.type}</span> },
    { header: 'Exam date', cell: (e) => formatDate(e.examDate) },
    { header: 'Centres', align: 'right', cell: (e) => e.centres.length },
    { header: 'Capacity', align: 'right', cell: (e) => num(e.centres.reduce((s, c) => s + c.finalCapacity, 0)) },
    { header: 'Status', cell: (e) => <StatusBadge status={e.status} /> },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Examinations"
        subtitle="All exams in the current cycle"
        actions={
          (role === 'ASO' || role === 'SO') && (
            <button className="btn btn-primary" onClick={() => navigate('/exams/new')}>+ Create Exam</button>
          )
        }
      />
      <AsyncBoundary loading={loading} error={error}>
        <DataTable
          columns={columns}
          rows={exams}
          rowKey={(e) => e.id}
          onRowClick={(e) => navigate(`/exams/${e.id}`)}
          empty="No examinations created yet."
        />
      </AsyncBoundary>
    </div>
  )
}
