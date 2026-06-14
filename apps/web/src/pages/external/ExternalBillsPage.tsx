import { useState } from 'react'
import { api } from '../../lib/api'
import { useApi, useMutation } from '../../lib/hooks'
import { useToast } from '../../components/Toast'
import type { Bill, VenueDocument } from '../../lib/domain'
import { money, formatDate } from '../../lib/format'
import { PageHeader, StatusBadge, AsyncBoundary, Field, TextInput } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { FileDrop } from '../../components/FileDrop'

const emptyForm = { examName: '', venue: '', amount: '' }

export function ExternalBillsPage() {
  const toast = useToast()
  const { data, loading, error, reload } = useApi(() => api.get<Bill[]>('/finance/bills'))
  const bills = data ?? []
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [docs, setDocs] = useState<VenueDocument[]>([])
  const create = useMutation((p: unknown) => api.post<Bill>('/finance/bills', p))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (docs.length === 0) { toast.error('Attach the voucher/bill document'); return }
    const res = await create.run({ ...form, amount: Number(form.amount), documents: docs })
    if (res) { toast.success('Bill submitted'); setShowAdd(false); setForm(emptyForm); setDocs([]); reload() }
  }

  const columns: Column<Bill>[] = [
    { header: 'Bill', cell: (b) => <strong>{b.ref}</strong> },
    { header: 'Venue', cell: (b) => <div>{b.venue}<div className="faint">{b.examName}</div></div> },
    { header: 'Amount', align: 'right', cell: (b) => money(b.amount) },
    { header: 'Submitted', cell: (b) => formatDate(b.submittedAt) },
    { header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Bills & Vouchers"
        subtitle="Upload bills and vouchers for verification"
        actions={<button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Upload bill</button>}
      />
      <AsyncBoundary loading={loading} error={error}>
        <DataTable columns={columns} rows={bills} rowKey={(b) => b.id} />
      </AsyncBoundary>

      <Modal
        open={showAdd}
        title="Upload bill / voucher"
        onClose={() => setShowAdd(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary" form="bill-form" disabled={create.busy}>{create.busy ? 'Submitting…' : 'Submit bill'}</button></>}
      >
        <form id="bill-form" onSubmit={submit}>
          <Field label="Examination"><TextInput value={form.examName} onChange={(e) => setForm({ ...form, examName: e.target.value })} required /></Field>
          <Field label="Venue"><TextInput value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} required /></Field>
          <Field label="Amount (₹)"><TextInput type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
          <Field label="Voucher / bill document"><FileDrop files={docs} onChange={setDocs} /></Field>
        </form>
      </Modal>
    </div>
  )
}
