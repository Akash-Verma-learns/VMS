import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useApi } from '../../lib/hooks'
import type { Exam } from '../../lib/domain'
import { formatDate, num } from '../../lib/format'
import { PageHeader, StatusBadge, AsyncBoundary, Stat } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import type { Centre } from '../../lib/domain'

export function ExamDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: exam, loading, error } = useApi(() => api.get<Exam>(`/exams/${id}`), [id])

  const columns: Column<Centre>[] = [
    { header: 'City', cell: (c) => <strong>{c.city}</strong> },
    { header: 'State', cell: (c) => <span className="muted">{c.state}</span> },
    { header: 'Suggested', align: 'right', cell: (c) => num(c.suggestedCapacity) },
    { header: 'Final', align: 'right', cell: (c) => num(c.finalCapacity) },
    { header: 'Venues needed', align: 'right', cell: (c) => c.venuesNeeded },
    { header: 'Status', cell: (c) => <StatusBadge status={c.status} /> },
  ]

  return (
    <div className="page">
      <button className="link-btn" onClick={() => navigate('/exams')} style={{ marginBottom: '0.75rem' }}>← Back to exams</button>
      <AsyncBoundary loading={loading} error={error}>
        {exam && (
          <>
            <PageHeader
              title={exam.name}
              subtitle={`${exam.type} · created by ${exam.createdBy}`}
              actions={<StatusBadge status={exam.status} />}
            />
            <div className="stat-row">
              <Stat label="Exam date" value={formatDate(exam.examDate)} />
              <Stat label="Centres" value={exam.centres.length} />
              <Stat label="Total capacity" value={num(exam.centres.reduce((s, c) => s + c.finalCapacity, 0))} />
              <Stat label="Venues needed" value={exam.centres.reduce((s, c) => s + c.venuesNeeded, 0)} />
            </div>
            <h3 className="section-title">Centres</h3>
            <DataTable columns={columns} rows={exam.centres} rowKey={(c) => c.id} empty="No centres yet — add cities to this exam." />
          </>
        )}
      </AsyncBoundary>
    </div>
  )
}
