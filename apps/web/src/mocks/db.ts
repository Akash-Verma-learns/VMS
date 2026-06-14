// In-memory stateful store for the mock backend. Mutations persist for the
// session so screens behave like a real app (create exam -> shows in list, etc).
import type {
  AdvanceCalc,
  Approval,
  Assignment,
  Bill,
  Exam,
  Fal,
  ManagedUser,
  Supervisor,
  Venue,
} from '../lib/domain'
import { DEMO_USERS } from './data'

function iso(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}
function dateOnly(daysFromNow: number): string {
  return iso(daysFromNow).slice(0, 10)
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

interface Store {
  exams: Exam[]
  venues: Venue[]
  approvals: Approval[]
  fals: Fal[]
  advances: AdvanceCalc[]
  bills: Bill[]
  assignments: Assignment[]
  users: ManagedUser[]
  supervisors: Supervisor[]
}

function seed(): Store {
  const exams: Exam[] = [
    {
      id: 'ex-cse-2026',
      name: 'Civil Services Examination 2026',
      year: 2026,
      type: 'Civil Services (Prelims)',
      examDate: dateOnly(38),
      status: 'capacity_review',
      createdBy: 'Aarav Mehta',
      createdAt: iso(-12),
      centres: [
        { id: 'c1', examId: 'ex-cse-2026', city: 'New Delhi', state: 'Delhi', suggestedCapacity: 42000, finalCapacity: 42000, status: 'suggested', venuesNeeded: 70 },
        { id: 'c2', examId: 'ex-cse-2026', city: 'Mumbai', state: 'Maharashtra', suggestedCapacity: 31000, finalCapacity: 31000, status: 'suggested', venuesNeeded: 52 },
        { id: 'c3', examId: 'ex-cse-2026', city: 'Lucknow', state: 'Uttar Pradesh', suggestedCapacity: 24000, finalCapacity: 26000, status: 'overridden', venuesNeeded: 44 },
        { id: 'c4', examId: 'ex-cse-2026', city: 'Chennai', state: 'Tamil Nadu', suggestedCapacity: 19000, finalCapacity: 19000, status: 'suggested', venuesNeeded: 32 },
      ],
    },
    {
      id: 'ex-ese-2026',
      name: 'Engineering Services Examination 2026',
      year: 2026,
      type: 'Engineering Services',
      examDate: dateOnly(72),
      status: 'released',
      createdBy: 'Sneha Iyer',
      createdAt: iso(-30),
      centres: [
        { id: 'c5', examId: 'ex-ese-2026', city: 'New Delhi', state: 'Delhi', suggestedCapacity: 8000, finalCapacity: 8000, status: 'released', venuesNeeded: 14 },
        { id: 'c6', examId: 'ex-ese-2026', city: 'Hyderabad', state: 'Telangana', suggestedCapacity: 6000, finalCapacity: 6000, status: 'released', venuesNeeded: 11 },
      ],
    },
    {
      id: 'ex-cds-2026',
      name: 'Combined Defence Services II 2026',
      year: 2026,
      type: 'CDS',
      examDate: dateOnly(110),
      status: 'draft',
      createdBy: 'Aarav Mehta',
      createdAt: iso(-2),
      centres: [],
    },
  ]

  const venues: Venue[] = [
    { id: 'v1', name: 'Delhi Public School, R.K. Puram', city: 'New Delhi', state: 'Delhi', address: 'Sector 12, R.K. Puram', capacity: 1200, status: 'pending', documents: [{ id: 'd1', name: 'Affiliation.pdf', kind: 'PDF', sizeKb: 240 }, { id: 'd2', name: 'SeatingPlan.pdf', kind: 'PDF', sizeKb: 180 }], submittedBy: 'Anjali Gupta', usedLastCycle: true },
    { id: 'v2', name: 'Kendriya Vidyalaya, Andrews Ganj', city: 'New Delhi', state: 'Delhi', address: 'Andrews Ganj', capacity: 800, status: 'pending', documents: [{ id: 'd3', name: 'Affiliation.pdf', kind: 'PDF', sizeKb: 210 }], submittedBy: 'Anjali Gupta', usedLastCycle: true },
    { id: 'v3', name: 'St. Xavier’s College', city: 'Mumbai', state: 'Maharashtra', address: 'Mahapalika Marg', capacity: 1500, status: 'approved', documents: [{ id: 'd4', name: 'Affiliation.pdf', kind: 'PDF', sizeKb: 260 }], submittedBy: 'Anjali Gupta', usedLastCycle: false },
    { id: 'v4', name: 'City Montessori School', city: 'Lucknow', state: 'Uttar Pradesh', address: 'Gomti Nagar', capacity: 2000, status: 'annotated', note: 'Confirm fire-safety certificate validity.', documents: [{ id: 'd5', name: 'Affiliation.pdf', kind: 'PDF', sizeKb: 300 }], submittedBy: 'Anjali Gupta', usedLastCycle: true },
    { id: 'v5', name: 'Loyola College', city: 'Chennai', state: 'Tamil Nadu', address: 'Sterling Road, Nungambakkam', capacity: 1100, status: 'pending', documents: [{ id: 'd6', name: 'Affiliation.pdf', kind: 'PDF', sizeKb: 220 }, { id: 'd7', name: 'Layout.pdf', kind: 'PDF', sizeKb: 190 }], submittedBy: 'Anjali Gupta', usedLastCycle: false },
  ]

  const approvals: Approval[] = [
    {
      id: 'ap1', type: 'Capacity Override', title: 'Lucknow capacity raised to 26,000', examName: 'Civil Services Examination 2026',
      raisedBy: 'Sneha Iyer', raisedAt: iso(-3), status: 'pending', currentRole: 'US',
      chain: [
        { role: 'SO', label: 'Raised by SO', state: 'done', actor: 'Sneha Iyer', actedAt: iso(-3) },
        { role: 'US', label: 'Under Secretary review', state: 'current' },
        { role: 'DS', label: 'Deputy Secretary approval', state: 'upcoming' },
      ],
    },
    {
      id: 'ap2', type: 'Venue List', title: 'Mumbai venue list (52 venues)', examName: 'Civil Services Examination 2026',
      raisedBy: 'Sneha Iyer', raisedAt: iso(-5), status: 'pending', currentRole: 'DS',
      chain: [
        { role: 'SO', label: 'Raised by SO', state: 'done', actor: 'Sneha Iyer', actedAt: iso(-5) },
        { role: 'US', label: 'Under Secretary review', state: 'done', actor: 'Rahul Verma', actedAt: iso(-4), comment: 'Verified against bank.' },
        { role: 'DS', label: 'Deputy Secretary approval', state: 'current' },
      ],
    },
    {
      id: 'ap3', type: 'FAL Sanction', title: 'FAL sanction — New Delhi cluster', examName: 'Engineering Services Examination 2026',
      raisedBy: 'Aarav Mehta', raisedAt: iso(-9), status: 'approved', currentRole: 'DS',
      chain: [
        { role: 'SO', label: 'Raised by SO', state: 'done', actor: 'Aarav Mehta', actedAt: iso(-9) },
        { role: 'US', label: 'Under Secretary review', state: 'done', actor: 'Rahul Verma', actedAt: iso(-8) },
        { role: 'DS', label: 'Deputy Secretary approval', state: 'done', actor: 'Priya Nair', actedAt: iso(-7), comment: 'Sanctioned.' },
      ],
    },
  ]

  const fals: Fal[] = [
    { id: 'f1', ref: 'FAL/2026/0012', examName: 'Civil Services Examination 2026', centre: 'New Delhi', amount: 1850000, status: 'sanctioned', createdAt: iso(-10), dueDate: dateOnly(4), sanctionedAt: iso(-6), reminders: 1 },
    { id: 'f2', ref: 'FAL/2026/0013', examName: 'Civil Services Examination 2026', centre: 'Mumbai', amount: 1420000, status: 'created', createdAt: iso(-2), dueDate: dateOnly(9), reminders: 0 },
    { id: 'f3', ref: 'FAL/2026/0009', examName: 'Engineering Services Examination 2026', centre: 'Hyderabad', amount: 760000, status: 'overdue', createdAt: iso(-22), dueDate: dateOnly(-3), sanctionedAt: iso(-18), reminders: 3 },
    { id: 'f4', ref: 'FAL/2026/0007', examName: 'Engineering Services Examination 2026', centre: 'New Delhi', amount: 980000, status: 'acknowledged', createdAt: iso(-25), dueDate: dateOnly(-10), sanctionedAt: iso(-20), acknowledgedAt: iso(-15), reminders: 0 },
  ]

  const advances: AdvanceCalc[] = [
    {
      id: 'adv1', examName: 'Civil Services Examination 2026', centre: 'New Delhi', candidates: 42000,
      lines: [
        { label: 'Invigilation staff', qty: 2100, rate: 600 },
        { label: 'Centre superintendent honorarium', qty: 70, rate: 2500 },
        { label: 'Stationery & logistics', qty: 42000, rate: 18 },
        { label: 'Contingency', qty: 1, rate: 150000 },
      ],
      total: 0,
    },
    {
      id: 'adv2', examName: 'Civil Services Examination 2026', centre: 'Mumbai', candidates: 31000,
      lines: [
        { label: 'Invigilation staff', qty: 1550, rate: 600 },
        { label: 'Centre superintendent honorarium', qty: 52, rate: 2500 },
        { label: 'Stationery & logistics', qty: 31000, rate: 18 },
        { label: 'Contingency', qty: 1, rate: 120000 },
      ],
      total: 0,
    },
  ]
  advances.forEach((a) => { a.total = a.lines.reduce((s, l) => s + l.qty * l.rate, 0) })

  const bills: Bill[] = [
    { id: 'b1', ref: 'BILL/2026/0451', examName: 'Engineering Services Examination 2026', venue: 'St. Xavier’s College', submittedBy: 'Imran Khan', submittedAt: iso(-4), amount: 248000, status: 'submitted', documents: [{ id: 'bd1', name: 'Voucher-451.pdf', kind: 'PDF', sizeKb: 320 }] },
    { id: 'b2', ref: 'BILL/2026/0452', examName: 'Engineering Services Examination 2026', venue: 'KV Andrews Ganj', submittedBy: 'Imran Khan', submittedAt: iso(-6), amount: 132000, status: 'verified', documents: [{ id: 'bd2', name: 'Voucher-452.pdf', kind: 'PDF', sizeKb: 280 }] },
    { id: 'b3', ref: 'BILL/2026/0448', examName: 'Engineering Services Examination 2026', venue: 'Loyola College', submittedBy: 'Anjali Gupta', submittedAt: iso(-11), amount: 196500, status: 'approved', documents: [{ id: 'bd3', name: 'Voucher-448.pdf', kind: 'PDF', sizeKb: 300 }] },
  ]

  const assignments: Assignment[] = [
    { id: 'as1', examName: 'Civil Services Examination 2026', venue: 'Delhi Public School, R.K. Puram', city: 'New Delhi', vsId: 'sup1', vsName: 'Imran Khan', previousVsName: 'Imran Khan', status: 'assigned' },
    { id: 'as2', examName: 'Civil Services Examination 2026', venue: 'Kendriya Vidyalaya, Andrews Ganj', city: 'New Delhi', vsId: 'sup2', vsName: 'Ravi Shankar', previousVsName: 'Meena Joshi', status: 'assigned' },
    { id: 'as3', examName: 'Civil Services Examination 2026', venue: 'St. Xavier’s College', city: 'Mumbai', vsId: null, vsName: null, previousVsName: 'Sunita Patil', status: 'draft' },
  ]

  const supervisors: Supervisor[] = [
    { id: 'sup1', name: 'Imran Khan', phone: '+91 98100 11223', available: true },
    { id: 'sup2', name: 'Ravi Shankar', phone: '+91 98201 44556', available: true },
    { id: 'sup3', name: 'Meena Joshi', phone: '+91 99300 77889', available: false },
    { id: 'sup4', name: 'Sunita Patil', phone: '+91 90040 33221', available: true },
    { id: 'sup5', name: 'Arjun Nair', phone: '+91 90880 55667', available: true },
  ]

  const users: ManagedUser[] = DEMO_USERS.map((u, i) => ({
    id: u.id, name: u.name, email: u.email, role: u.role, isActive: true, createdAt: iso(-40 + i),
  }))

  return { exams, venues, approvals, fals, advances, bills, assignments, users, supervisors }
}

export const store: Store = seed()
