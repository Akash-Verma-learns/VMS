// Domain entity types for the VMS frontend (mirrors apps/api intent).
import type { Role } from './types'

export type ExamType =
  | 'Civil Services (Prelims)'
  | 'Civil Services (Mains)'
  | 'Engineering Services'
  | 'CDS'
  | 'NDA'
  | 'CAPF'

export type ExamStatus = 'draft' | 'capacity_review' | 'released'

export interface Centre {
  id: string
  examId: string
  city: string
  state: string
  suggestedCapacity: number
  finalCapacity: number
  status: 'suggested' | 'overridden' | 'released'
  venuesNeeded: number
}

export interface Exam {
  id: string
  name: string
  year: number
  type: ExamType
  examDate: string // ISO date
  status: ExamStatus
  createdBy: string
  createdAt: string
  centres: Centre[]
}

export type VenueStatus = 'pending' | 'approved' | 'annotated' | 'rejected'

export interface VenueDocument {
  id: string
  name: string
  kind: string
  sizeKb: number
}

export interface Venue {
  id: string
  name: string
  city: string
  state: string
  address: string
  capacity: number
  status: VenueStatus
  documents: VenueDocument[]
  submittedBy: string
  note?: string
  usedLastCycle: boolean
}

export type ApprovalType = 'Venue List' | 'Capacity Override' | 'FAL Sanction' | 'Bill' | 'Advance'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface ApprovalStep {
  role: Role
  label: string
  state: 'done' | 'current' | 'upcoming'
  actor?: string
  actedAt?: string
  comment?: string
}

export interface Approval {
  id: string
  type: ApprovalType
  title: string
  examName: string
  raisedBy: string
  raisedAt: string
  status: ApprovalStatus
  currentRole: Role
  chain: ApprovalStep[]
}

export type FalStatus = 'created' | 'sanctioned' | 'acknowledged' | 'overdue'

export interface Fal {
  id: string
  ref: string
  examName: string
  centre: string
  amount: number
  status: FalStatus
  createdAt: string
  dueDate: string
  sanctionedAt?: string
  acknowledgedAt?: string
  reminders: number
}

export interface AdvanceLine {
  label: string
  qty: number
  rate: number
}

export interface AdvanceCalc {
  id: string
  examName: string
  centre: string
  candidates: number
  lines: AdvanceLine[]
  total: number
}

export type BillStatus = 'submitted' | 'verified' | 'approved' | 'rejected'

export interface Bill {
  id: string
  ref: string
  examName: string
  venue: string
  submittedBy: string
  submittedAt: string
  amount: number
  status: BillStatus
  documents: VenueDocument[]
}

export type AssignmentStatus = 'draft' | 'assigned' | 'submitted'

export interface Assignment {
  id: string
  examName: string
  venue: string
  city: string
  vsId: string | null
  vsName: string | null
  previousVsName: string | null
  status: AssignmentStatus
}

export interface ManagedUser {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: string
}

export interface Supervisor {
  id: string
  name: string
  phone: string
  available: boolean
}

// ---- Field / exam-day (PWA) ----
export interface ChecklistStep {
  id: string
  label: string
  done: boolean
  at?: string
  requiresPhoto?: boolean
}

export interface MoneyFmtOptions {
  compact?: boolean
}
