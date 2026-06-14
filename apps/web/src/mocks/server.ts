// In-memory mock backend. Mirrors apps/api response shapes and persists
// mutations in `store` for the session. Toggled by VITE_USE_MOCKS (api.ts).
import type { HttpMethod } from '../lib/api'
import type { Approval, Exam, Fal, Venue } from '../lib/domain'
import { DEMO_OTP, findDemoUserByEmail, findDemoUserById } from './data'
import { store, uid } from './db'

export interface MockResponse {
  status: number
  data: unknown
}

function tokenForUser(userId: string): string { return `mock.${userId}` }
function userIdFromToken(token: string | null): string | null {
  if (!token || !token.startsWith('mock.')) return null
  return token.slice('mock.'.length)
}
function delay<T>(value: T, ms = 180): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
function ok(data: unknown): MockResponse { return { status: 200, data } }
function created(data: unknown): MockResponse { return { status: 201, data } }
function notFound(): MockResponse { return { status: 404, data: { error: 'Not found' } } }

// Match '/a/:x/b/:y' against a concrete path; returns params or null.
function match(pattern: string, path: string): Record<string, string> | null {
  const pp = pattern.split('/').filter(Boolean)
  const cp = path.split('/').filter(Boolean)
  if (pp.length !== cp.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(cp[i])
    else if (pp[i] !== cp[i]) return null
  }
  return params
}

export async function handleMock(
  method: HttpMethod,
  rawPath: string,
  body: unknown,
  token: string | null,
): Promise<MockResponse> {
  const path = rawPath.split('?')[0]
  const b = (body ?? {}) as Record<string, any>
  const M = (p: string) => match(p, path)

  // -------- Auth (public) --------
  if (method === 'POST' && path === '/auth/request-otp') {
    return delay(ok({ message: 'If this email is registered, an OTP has been sent.' }))
  }
  if (method === 'POST' && path === '/auth/verify-otp') {
    const user = findDemoUserByEmail(String(b.email ?? ''))
    if (!user || String(b.otp ?? '') !== DEMO_OTP) {
      return delay({ status: 401, data: { error: 'Invalid or expired OTP.' } })
    }
    return delay(ok({ token: tokenForUser(user.id), user: { id: user.id, name: user.name, email: user.email, role: user.role } }))
  }
  if (method === 'POST' && path === '/auth/logout') return delay(ok({ message: 'Logged out successfully' }))

  // -------- Auth gate for everything below --------
  const currentId = userIdFromToken(token)
  const me = currentId ? findDemoUserById(currentId) : undefined
  if (!me) return delay({ status: 401, data: { error: 'Not authenticated' } })

  if (method === 'GET' && path === '/me') {
    return delay(ok({ id: me.id, name: me.name, email: me.email, role: me.role }))
  }

  // -------- Exams --------
  if (method === 'GET' && path === '/exams') return delay(ok(store.exams))
  let p = M('/exams/:id')
  if (method === 'GET' && p) {
    const exam = store.exams.find((e) => e.id === p!.id)
    return delay(exam ? ok(exam) : notFound())
  }
  if (method === 'POST' && path === '/exams') {
    const id = uid('ex')
    const cities = Array.isArray(b.cities) ? b.cities : []
    const exam: Exam = {
      id, name: b.name, year: Number(b.year), type: b.type, examDate: b.examDate,
      status: cities.length ? 'capacity_review' : 'draft',
      createdBy: me.name, createdAt: new Date().toISOString(),
      centres: cities.map((c: any) => ({
        id: uid('c'), examId: id, city: c.city, state: c.state ?? '',
        suggestedCapacity: Number(c.suggestedCapacity) || 0,
        finalCapacity: Number(c.suggestedCapacity) || 0,
        status: 'suggested' as const,
        venuesNeeded: Math.ceil((Number(c.suggestedCapacity) || 0) / 600),
      })),
    }
    store.exams.unshift(exam)
    return delay(created(exam))
  }
  p = M('/exams/:id/centre/:centreId')
  if (method === 'PATCH' && p) {
    const exam = store.exams.find((e) => e.id === p!.id)
    const centre = exam?.centres.find((c) => c.id === p!.centreId)
    if (!centre) return delay(notFound())
    centre.finalCapacity = Number(b.finalCapacity) || centre.finalCapacity
    centre.status = centre.finalCapacity !== centre.suggestedCapacity ? 'overridden' : 'suggested'
    centre.venuesNeeded = Math.ceil(centre.finalCapacity / 600)
    return delay(ok(centre))
  }
  p = M('/exams/:id/release')
  if (method === 'PATCH' && p) {
    const exam = store.exams.find((e) => e.id === p!.id)
    if (!exam) return delay(notFound())
    exam.centres.forEach((c) => { c.status = 'released' })
    exam.status = 'released'
    return delay(ok(exam))
  }

  // -------- Venues --------
  if (method === 'GET' && path === '/venues') return delay(ok(store.venues))
  if (method === 'POST' && path === '/venues') {
    const venue: Venue = {
      id: uid('v'), name: b.name, city: b.city, state: b.state ?? '', address: b.address ?? '',
      capacity: Number(b.capacity) || 0, status: 'pending', documents: b.documents ?? [],
      submittedBy: me.name, usedLastCycle: false,
    }
    store.venues.unshift(venue)
    return delay(created(venue))
  }
  p = M('/venues/:id/review')
  if (method === 'PATCH' && p) {
    const venue = store.venues.find((v) => v.id === p!.id)
    if (!venue) return delay(notFound())
    const action = String(b.action)
    venue.status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'annotated'
    if (b.note) venue.note = String(b.note)
    return delay(ok(venue))
  }

  // -------- Approvals --------
  if (method === 'GET' && path === '/approvals') return delay(ok(store.approvals))
  p = M('/approvals/:id/action')
  if (method === 'PATCH' && p) {
    const ap = store.approvals.find((a) => a.id === p!.id) as Approval | undefined
    if (!ap) return delay(notFound())
    const stepIdx = ap.chain.findIndex((s) => s.state === 'current')
    if (stepIdx >= 0) {
      const step = ap.chain[stepIdx]
      step.actor = me.name
      step.actedAt = new Date().toISOString()
      step.comment = b.comment
      if (b.action === 'reject') {
        step.state = 'done'
        ap.status = 'rejected'
      } else {
        step.state = 'done'
        const next = ap.chain[stepIdx + 1]
        if (next) { next.state = 'current'; ap.currentRole = next.role }
        else ap.status = 'approved'
      }
    }
    return delay(ok(ap))
  }

  // -------- FAL --------
  if (method === 'GET' && path === '/fal') return delay(ok(store.fals))
  if (method === 'POST' && path === '/fal') {
    const fal: Fal = {
      id: uid('f'), ref: `FAL/2026/${String(1000 + store.fals.length).slice(1)}`,
      examName: b.examName, centre: b.centre, amount: Number(b.amount) || 0,
      status: 'created', createdAt: new Date().toISOString(),
      dueDate: b.dueDate ?? new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), reminders: 0,
    }
    store.fals.unshift(fal)
    return delay(created(fal))
  }
  p = M('/fal/:id/sanction')
  if (method === 'PATCH' && p) {
    const fal = store.fals.find((f) => f.id === p!.id)
    if (!fal) return delay(notFound())
    fal.status = 'sanctioned'; fal.sanctionedAt = new Date().toISOString()
    return delay(ok(fal))
  }
  p = M('/fal/:id/acknowledge')
  if (method === 'PATCH' && p) {
    const fal = store.fals.find((f) => f.id === p!.id)
    if (!fal) return delay(notFound())
    fal.status = 'acknowledged'; fal.acknowledgedAt = new Date().toISOString()
    return delay(ok(fal))
  }
  p = M('/fal/:id/reminder')
  if (method === 'POST' && p) {
    const fal = store.fals.find((f) => f.id === p!.id)
    if (!fal) return delay(notFound())
    fal.reminders += 1
    return delay(ok(fal))
  }

  // -------- Finance --------
  if (method === 'GET' && path === '/finance/advances') return delay(ok(store.advances))
  if (method === 'GET' && path === '/finance/bills') return delay(ok(store.bills))
  if (method === 'POST' && path === '/finance/bills') {
    const bill = {
      id: uid('b'), ref: `BILL/2026/${String(1000 + store.bills.length).slice(1)}`,
      examName: b.examName, venue: b.venue, submittedBy: me.name,
      submittedAt: new Date().toISOString(), amount: Number(b.amount) || 0,
      status: 'submitted' as const, documents: b.documents ?? [],
    }
    store.bills.unshift(bill)
    return delay(created(bill))
  }
  p = M('/finance/bills/:id/verify')
  if (method === 'PATCH' && p) {
    const bill = store.bills.find((x) => x.id === p!.id)
    if (!bill) return delay(notFound())
    bill.status = 'verified'
    return delay(ok(bill))
  }
  p = M('/finance/bills/:id/approve')
  if (method === 'PATCH' && p) {
    const bill = store.bills.find((x) => x.id === p!.id)
    if (!bill) return delay(notFound())
    bill.status = String(b.action) === 'reject' ? 'rejected' : 'approved'
    return delay(ok(bill))
  }

  // -------- Assignments / supervisors --------
  if (method === 'GET' && path === '/assignments') return delay(ok(store.assignments))
  if (method === 'GET' && path === '/supervisors') return delay(ok(store.supervisors))
  p = M('/assignments/:id')
  if (method === 'PATCH' && p) {
    const a = store.assignments.find((x) => x.id === p!.id)
    if (!a) return delay(notFound())
    const sup = store.supervisors.find((s) => s.id === b.vsId)
    a.vsId = sup?.id ?? null
    a.vsName = sup?.name ?? null
    a.status = sup ? 'assigned' : 'draft'
    return delay(ok(a))
  }
  if (method === 'POST' && path === '/assignments/submit') {
    store.assignments.forEach((a) => { if (a.vsId) a.status = 'submitted' })
    return delay(ok({ submitted: store.assignments.filter((a) => a.status === 'submitted').length }))
  }

  // -------- Users --------
  if (method === 'GET' && path === '/users') return delay(ok(store.users))
  if (method === 'POST' && path === '/users') {
    const u = { id: uid('u'), name: b.name, email: b.email, role: b.role, isActive: true, createdAt: new Date().toISOString() }
    store.users.unshift(u)
    return delay(created(u))
  }
  p = M('/users/:id')
  if (method === 'PATCH' && p) {
    const u = store.users.find((x) => x.id === p!.id)
    if (!u) return delay(notFound())
    if (typeof b.isActive === 'boolean') u.isActive = b.isActive
    if (b.role) u.role = b.role
    return delay(ok(u))
  }

  // -------- fallback --------
  return delay(method === 'GET' ? ok([]) : ok({}))
}
