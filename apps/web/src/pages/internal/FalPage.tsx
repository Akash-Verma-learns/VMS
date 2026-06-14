import { useState } from 'react'
import { api } from '../../lib/api'
import { useApi, useMutation } from '../../lib/hooks'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toast'
import type { Fal } from '../../lib/domain'
import { money, formatDate, relativeDays } from '../../lib/format'
import { PageHeader, StatusBadge, AsyncBoundary, Stat, Field, TextInput } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'

export function FalPage() {
  const { role } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useApi(() => api.get<Fal[]>('/fal'))
  const fals = data ?? []
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ examName: '', centre: '', amount: '', dueDate: '' })

  const create = useMutation((p: unknown) => api.post<Fal>('/fal', p))
  const sanction = useMutation((id: string) => api.patch<Fal>(`/fal/${id}/sanction`))
  const remind = useMutation((id: string) => api.post<Fal>(`/fal/${id}/reminder`))

  const canCreate = role === 'ASO' || role === 'SO'
  const canSanction = role === 'DS'
  const canRemind = role === 'ASO' || role === 'SO' || role === 'US'
  const overdue = fals.filter((f) => f.status === 'overdue')

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    const res = await create.run({ ...form, amount: Number(form.amount) })
    if (res) {
      toast.success('FAL created')
      setShowCreate(false); setForm({ examName: '', centre: '', amount: '', dueDate: '' }); reload()
    }
  }
  async function doSanction(f: Fal) { if (await sanction.run(f.id)) { toast.success(`${f.ref} sanctioned`); reload() } }
  async function doRemind(f: Fal) { if (await remind.run(f.id)) { toast.info(`Reminder sent for ${f.ref}`); reload() } }

  const columns: Column<Fal>[] = [
    { header: 'Reference', cell: (f) => <strong>{f.ref}</strong> },
    { header: 'Centre', cell: (f) => <div>{f.centre}<div className="faint">{f.examName}</div></div> },
    { header: 'Amount', align: 'right', cell: (f) => money(f.amount) },
    { header: 'Due', cell: (f) => {
      const d = relativeDays(f.dueDate)
      return <div>{formatDate(f.dueDate)}{d !== null && d < 0 && <div className="faint" style={{ color: 'var(--danger)' }}>{Math.abs(d)}d overdue</div>}</div>
    } },
    { header: 'Reminders', align: 'center', cell: (f) => f.reminders || '—' },
    { header: 'Status', cell: (f) => <StatusBadge status={f.status} /> },
    { header: '', align: 'right', cell: (f) => (
      <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
        {canSanction && f.status === 'created' && <button className="btn btn-primary" onClick={() => doSanction(f)} disabled={sanction.busy}>Sanction</button>}
        {canRemind && (f.status === 'sanctioned' || f.status === 'overdue') && <button className="btn btn-secondary" onClick={() => doRemind(f)} disabled={remind.busy}>Remind</button>}
      </div>
    ) },
  ]

  return (
    <div className="page">
      <PageHeader
        title="FAL Management"
        subtitle="Facility Authorisation Letters — create, sanction and track acknowledgements"
        actions={canCreate && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Create FAL</button>}
      />

      {overdue.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
          <strong>{overdue.length} FAL{overdue.length > 1 ? 's' : ''} overdue</strong> — acknowledgement pending past due date: {overdue.map((f) => f.ref).join(', ')}
        </div>
      )}

      <AsyncBoundary loading={loading} error={error}>
        <div className="stat-row">
          <Stat label="Total FALs" value={fals.length} />
          <Stat label="Awaiting sanction" value={fals.filter((f) => f.status === 'created').length} tone="warning" />
          <Stat label="Acknowledged" value={fals.filter((f) => f.status === 'acknowledged').length} tone="success" />
          <Stat label="Overdue" value={overdue.length} tone="danger" />
        </div>
        <DataTable columns={columns} rows={fals} rowKey={(f) => f.id} />
      </AsyncBoundary>

      <Modal
        open={showCreate}
        title="Create FAL"
        onClose={() => setShowCreate(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="btn btn-primary" form="fal-form" disabled={create.busy}>{create.busy ? 'Creating…' : 'Create'}</button></>}
      >
        <form id="fal-form" onSubmit={submitCreate}>
          <Field label="Examination"><TextInput value={form.examName} onChange={(e) => setForm({ ...form, examName: e.target.value })} required placeholder="Civil Services Examination 2026" /></Field>
          <Field label="Centre"><TextInput value={form.centre} onChange={(e) => setForm({ ...form, centre: e.target.value })} required placeholder="New Delhi" /></Field>
          <div className="cols-2">
            <Field label="Amount (₹)"><TextInput type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
            <Field label="Due date"><TextInput type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></Field>
          </div>
        </form>
      </Modal>
    </div>
  )
}
