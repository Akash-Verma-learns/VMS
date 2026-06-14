import { useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useApi, useMutation } from '../../lib/hooks'
import { useToast } from '../../components/Toast'
import type { Venue, VenueDocument } from '../../lib/domain'
import { num } from '../../lib/format'
import { PageHeader, StatusBadge, AsyncBoundary, Field, TextInput } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { FileDrop } from '../../components/FileDrop'

const emptyForm = { name: '', city: '', state: '', address: '', capacity: '' }

export function VenueBankPage() {
  const toast = useToast()
  const { data, loading, error, reload } = useApi(() => api.get<Venue[]>('/venues'))
  const venues = data ?? []
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [docs, setDocs] = useState<VenueDocument[]>([])
  const create = useMutation((p: unknown) => api.post<Venue>('/venues', p))

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return venues.filter((v) => !q || v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q))
  }, [venues, query])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (docs.length === 0) { toast.error('Upload at least one supporting document'); return }
    const res = await create.run({ ...form, capacity: Number(form.capacity), documents: docs })
    if (res) {
      toast.success('Venue added to bank')
      setShowAdd(false); setForm(emptyForm); setDocs([]); reload()
    }
  }

  const columns: Column<Venue>[] = [
    { header: 'Venue', cell: (v) => <div><strong>{v.name}</strong><div className="faint">{v.address}</div></div> },
    { header: 'City', cell: (v) => `${v.city}, ${v.state}` },
    { header: 'Capacity', align: 'right', cell: (v) => num(v.capacity) },
    { header: 'Documents', align: 'right', cell: (v) => v.documents.length },
    { header: 'Status', cell: (v) => <StatusBadge status={v.status} /> },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Venue Bank"
        subtitle="Browse existing venues and add new ones with supporting documents"
        actions={<button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add venue</button>}
      />
      <div className="toolbar">
        <TextInput placeholder="Search by venue or city…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 320 }} />
        <span className="muted">{filtered.length} of {venues.length} venues</span>
      </div>
      <AsyncBoundary loading={loading} error={error}>
        <DataTable columns={columns} rows={filtered} rowKey={(v) => v.id} empty="No venues match your search." />
      </AsyncBoundary>

      <Modal
        open={showAdd}
        title="Add venue to bank"
        onClose={() => setShowAdd(false)}
        wide
        footer={<><button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary" form="venue-form" disabled={create.busy}>{create.busy ? 'Saving…' : 'Add venue'}</button></>}
      >
        <form id="venue-form" onSubmit={submit}>
          <Field label="Venue name"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Address"><TextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required /></Field>
          <div className="cols-2">
            <Field label="City"><TextInput value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></Field>
            <Field label="State"><TextInput value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required /></Field>
          </div>
          <Field label="Capacity"><TextInput type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required /></Field>
          <Field label="Supporting documents" hint="Affiliation certificate, seating plan, fire-safety certificate, etc.">
            <FileDrop files={docs} onChange={setDocs} />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
