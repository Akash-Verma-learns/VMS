import { useState } from 'react'
import { api } from '../../lib/api'
import { useApi, useMutation } from '../../lib/hooks'
import { useToast } from '../../components/Toast'
import type { ManagedUser } from '../../lib/domain'
import type { Role } from '../../lib/types'
import { ROLES } from '../../lib/types'
import { formatDate } from '../../lib/format'
import { PageHeader, StatusBadge, AsyncBoundary, Field, TextInput, Select } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'

const ALL_ROLES = Object.keys(ROLES) as Role[]

export function UserManagementPage() {
  const toast = useToast()
  const { data, loading, error, reload } = useApi(() => api.get<ManagedUser[]>('/users'))
  const users = data ?? []
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'ASO' as Role })

  const create = useMutation((p: unknown) => api.post<ManagedUser>('/users', p))
  const update = useMutation((id: string, patch: unknown) => api.patch<ManagedUser>(`/users/${id}`, patch))

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    const res = await create.run(form)
    if (res) { toast.success('User created'); setShowCreate(false); setForm({ name: '', email: '', role: 'ASO' }); reload() }
  }
  async function toggleActive(u: ManagedUser) {
    if (await update.run(u.id, { isActive: !u.isActive })) { toast.success(`${u.name} ${u.isActive ? 'deactivated' : 'activated'}`); reload() }
  }
  async function changeRole(u: ManagedUser, role: Role) {
    if (await update.run(u.id, { role })) { toast.success(`${u.name} is now ${role}`); reload() }
  }

  const columns: Column<ManagedUser>[] = [
    { header: 'Name', cell: (u) => <div><strong>{u.name}</strong><div className="faint">{u.email}</div></div> },
    { header: 'Role', cell: (u) => (
      <Select value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)} style={{ maxWidth: 110 }}>
        {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </Select>
    ) },
    { header: 'Designation', cell: (u) => <span className="muted">{ROLES[u.role].label}</span> },
    { header: 'Created', cell: (u) => formatDate(u.createdAt) },
    { header: 'Status', cell: (u) => <StatusBadge status={u.isActive ? 'active' : 'inactive'} /> },
    { header: '', align: 'right', cell: (u) => (
      <button className="btn btn-secondary" onClick={() => toggleActive(u)} disabled={update.busy}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
    ) },
  ]

  return (
    <div className="page">
      <PageHeader
        title="User Management"
        subtitle="Create users and assign roles"
        actions={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Add user</button>}
      />
      <AsyncBoundary loading={loading} error={error}>
        <DataTable columns={columns} rows={users} rowKey={(u) => u.id} />
      </AsyncBoundary>

      <Modal
        open={showCreate}
        title="Add user"
        onClose={() => setShowCreate(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="btn btn-primary" form="user-form" disabled={create.busy}>{create.busy ? 'Creating…' : 'Create user'}</button></>}
      >
        <form id="user-form" onSubmit={submitCreate}>
          <Field label="Full name"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Official email"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r} — {ROLES[r].label}</option>)}
            </Select>
          </Field>
        </form>
      </Modal>
    </div>
  )
}
