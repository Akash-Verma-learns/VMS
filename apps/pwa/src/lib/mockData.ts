// Mock field-user accounts and assigned context for the PWA. Frontend-only:
// the engine (Dexie outbox + sync) is real; data here stands in for the API.

export type FieldRole = 'VS' | 'CS' | 'IO'

export interface FieldUser {
  id: string
  name: string
  email: string
  role: FieldRole
}

export const DEMO_OTP = '123456'

export const FIELD_USERS: FieldUser[] = [
  { id: 'u-vs', name: 'Imran Khan', email: 'vs@centre.gov.in', role: 'VS' },
  { id: 'u-cs', name: 'Anjali Gupta', email: 'cs@centre.gov.in', role: 'CS' },
  { id: 'u-io', name: 'Deepa Menon', email: 'io@upsc.gov.in', role: 'IO' },
]

export function findFieldUser(email: string): FieldUser | undefined {
  const e = email.trim().toLowerCase()
  return FIELD_USERS.find((u) => u.email.toLowerCase() === e)
}
export function findFieldUserById(id: string): FieldUser | undefined {
  return FIELD_USERS.find((u) => u.id === id)
}

// ---- Assigned exam context (shared across roles for the demo) ----
export const EXAM_CONTEXT = {
  examName: 'Civil Services Examination 2026',
  examDate: '2026-07-22',
  session: 'Forenoon (09:30 – 11:30)',
}

export interface VenueInfo {
  id: string
  name: string
  code: string
  city: string
  capacity: number
}

// VS is assigned one venue.
export const VS_VENUE: VenueInfo = {
  id: 'V-DPS-RKP', name: 'Delhi Public School, R.K. Puram', code: 'DL-014', city: 'New Delhi', capacity: 1200,
}

// CS oversees a centre (city) with several venues + live readiness.
export interface VenueReadiness {
  venue: VenueInfo
  readiness: number // 0-100
  vs: string
  lastReport: string
}
export const CS_VENUES: VenueReadiness[] = [
  { venue: { id: 'V-DPS-RKP', name: 'Delhi Public School, R.K. Puram', code: 'DL-014', city: 'New Delhi', capacity: 1200 }, readiness: 100, vs: 'Imran Khan', lastReport: 'Attendance submitted' },
  { venue: { id: 'V-KV-AG', name: 'Kendriya Vidyalaya, Andrews Ganj', code: 'DL-021', city: 'New Delhi', capacity: 800 }, readiness: 60, vs: 'Ravi Shankar', lastReport: 'Jammer confirmed' },
  { venue: { id: 'V-MNV', name: 'Mount Carmel School', code: 'DL-033', city: 'New Delhi', capacity: 950 }, readiness: 20, vs: 'Arjun Nair', lastReport: 'Gate closure pending' },
]

// IO inspects a route of venues.
export const IO_VENUES: VenueInfo[] = [
  { id: 'V-DPS-RKP', name: 'Delhi Public School, R.K. Puram', code: 'DL-014', city: 'New Delhi', capacity: 1200 },
  { id: 'V-KV-AG', name: 'Kendriya Vidyalaya, Andrews Ganj', code: 'DL-021', city: 'New Delhi', capacity: 800 },
  { id: 'V-MNV', name: 'Mount Carmel School', code: 'DL-033', city: 'New Delhi', capacity: 950 },
]
