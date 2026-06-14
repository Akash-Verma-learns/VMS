import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

// ---------- Page header ----------
export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row gap-sm">{actions}</div>}
    </div>
  )
}

// ---------- Status badge ----------
type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const STATUS_TONE: Record<string, Tone> = {
  // exam / centre
  draft: 'neutral', capacity_review: 'warning', released: 'success',
  suggested: 'neutral', overridden: 'info',
  // venue
  pending: 'warning', approved: 'success', annotated: 'info', rejected: 'danger',
  // approval
  // fal
  created: 'neutral', sanctioned: 'info', acknowledged: 'success', overdue: 'danger',
  // bill
  submitted: 'neutral', verified: 'info',
  // assignment
  assigned: 'info',
  // generic
  active: 'success', inactive: 'neutral',
}

const STATUS_LABEL: Record<string, string> = {
  capacity_review: 'Capacity review',
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral'
  const label = STATUS_LABEL[status] ?? status.replace(/_/g, ' ')
  return <span className={`badge badge-${tone}`}>{label}</span>
}

// ---------- Empty state ----------
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {hint && <p className="muted">{hint}</p>}
    </div>
  )
}

// ---------- Stat card ----------
export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="stat card">
      <span className="stat-label">{label}</span>
      <span className={`stat-value${tone ? ` tone-${tone}` : ''}`}>{value}</span>
    </div>
  )
}

// ---------- Spinner / loaders ----------
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="loader"><span className="spinner" />{label}</div>
}

export function AsyncBoundary({
  loading, error, empty, children,
}: { loading: boolean; error: string | null; empty?: boolean; children: ReactNode }) {
  if (loading) return <Spinner />
  if (error) return <div className="alert alert-error">{error}</div>
  if (empty) return <EmptyState title="Nothing here yet" />
  return <>{children}</>
}

// ---------- Form fields ----------
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="faint" style={{ fontSize: '0.76rem' }}>{hint}</span>}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input ${props.className ?? ''}`} />
}
