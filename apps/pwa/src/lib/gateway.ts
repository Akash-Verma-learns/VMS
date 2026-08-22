import axios from "axios"

/**
 * Client for the gate terminal gateway (the FastAPI service next to the ESP32).
 *
 * Deliberately a separate axios instance from `lib/api.ts`:
 *   - it must NOT carry the VMS JWT; the gateway is unauthenticated and on a
 *     different origin
 *   - it must NOT inherit that client's offline interceptor. The gateway lives
 *     on the same LAN as the phone, so it stays reachable during an exam even
 *     when the venue has no internet at all — which is exactly when the gate
 *     still has to work.
 */

const STORAGE_KEY = "gatewayUrl"

/** Where the gateway is, defaulting to :8000 on whatever host served the PWA. */
export function gatewayUrl(): string {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) return saved.replace(/\/+$/, "")
  // The PWA is served from the laptop over the LAN, so the same hostname is
  // almost always right and nobody has to type an IP.
  return `${window.location.protocol}//${window.location.hostname}:8000`
}

export function setGatewayUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, "")
  if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed)
  else localStorage.removeItem(STORAGE_KEY)
}

const gw = axios.create({ timeout: 6000 })

export type RosterEntry = {
  templateId: number
  roll: string
  name: string
  seat: string
  venue: string
  city: string
  venueId: string
}

export type TerminalContext = {
  examId: string
  examName: string
  examCode: string
  venueId: string
  venueName: string
  cityName: string
}

export type GateFinding = {
  id: string
  severity: "BLOCKER" | "WARNING" | "INFO"
  title: string
  detail: string
  consequence: string
  fix: string
  count: number
  samples: string[]
}

export type GateCheck = {
  ok: boolean
  blockers: number
  warnings: number
  vmsReachable: boolean
  findings: GateFinding[]
  inspected: {
    enrolledPrints: number
    printsOnSensor: number | null
    expectedCandidates: number
    venue: string | null
  }
}

export async function fetchGateCheck(): Promise<GateCheck> {
  try { return (await gw.get(`${gatewayUrl()}/admin/datacheck`)).data }
  catch (err) { throw new Error(detail(err)) }
}

export type Candidate = {
  roll: string; name: string
  /** Seat from the released admit card; empty when nothing is released yet. */
  seat: string; venue: string; city: string; released: boolean
}
export type VenueOption = { venueId: string; name: string; city: string; seats: number | null }
export type ExamOption = { id: string; name: string; examCode: string; status: string }

export type GateState = {
  device: {
    online: boolean
    ip: string | null
    mac: string | null
    version: string | null
    templates: number | null
    last_seen_ago: number | null
  }
  command: {
    cmd: string | null
    templateId: number | null
    roll: string | null
    name: string | null
    passes: number
    seat: string
    venueId: string
    venue: string
    city: string
    state: "IDLE" | "QUEUED" | "RUNNING" | "DONE" | "FAILED"
    message: string
    updated: number | null
  }
  roster: RosterEntry[]
  context: TerminalContext
  activity: { at: string; kind: string; text: string }[]
  vms: {
    base_url: string
    logging_enabled: boolean
    offline_mode: boolean
    token_role: string | null
    token_expires_in_hours: number | null
  }
}

function detail(err: any): string {
  return err?.response?.data?.detail ?? err?.message ?? "Gateway unreachable"
}

export async function fetchState(): Promise<GateState> {
  const r = await gw.get(`${gatewayUrl()}/admin/state`)
  return r.data
}

export async function startEnrolment(body: {
  roll: string; name?: string; seat?: string; passes: number
  venueId?: string; venue?: string; city?: string
}) {
  try {
    return (await gw.post(`${gatewayUrl()}/admin/enroll`, body)).data
  } catch (err) { throw new Error(detail(err)) }
}

/* ---- VMS read-through. These come from the real VMS via the gateway's ASO
   token, because the PWA's own VS/CS/IO roles cannot read those lists. ---- */

export async function fetchExams(): Promise<ExamOption[]> {
  try { return (await gw.get(`${gatewayUrl()}/vms/exams`)).data }
  catch (err) { throw new Error(detail(err)) }
}

export async function fetchVenues(examId: string): Promise<VenueOption[]> {
  try { return (await gw.get(`${gatewayUrl()}/vms/venues`, { params: { examId } })).data }
  catch (err) { throw new Error(detail(err)) }
}

export async function searchCandidates(
  examId: string, venueId: string, q: string,
): Promise<Candidate[]> {
  try {
    return (await gw.get(`${gatewayUrl()}/vms/candidates`,
      { params: { examId, venueId, q } })).data
  } catch (err) { throw new Error(detail(err)) }
}

export async function saveContext(ctx: Partial<TerminalContext>): Promise<TerminalContext> {
  try { return (await gw.post(`${gatewayUrl()}/admin/context`, ctx)).data }
  catch (err) { throw new Error(detail(err)) }
}

export async function deleteTemplate(templateId: number) {
  try {
    return (await gw.post(`${gatewayUrl()}/admin/delete`, { templateId })).data
  } catch (err) { throw new Error(detail(err)) }
}

export async function mapTemplate(templateId: number, roll: string, name: string) {
  try {
    return (await gw.post(`${gatewayUrl()}/admin/roster`, { templateId, roll, name })).data
  } catch (err) { throw new Error(detail(err)) }
}

export async function wipeSensor() {
  try { return (await gw.post(`${gatewayUrl()}/admin/empty`, {})).data }
  catch (err) { throw new Error(detail(err)) }
}

export async function runSelfTest() {
  try {
    return (await gw.post(`${gatewayUrl()}/admin/selftest`, {})).data
  } catch (err) { throw new Error(detail(err)) }
}

export async function cancelCommand() {
  try {
    return (await gw.post(`${gatewayUrl()}/admin/cancel`, {})).data
  } catch (err) { throw new Error(detail(err)) }
}

export type Person = {
  roll: string; name: string; seat: string; venue: string; city: string; ids: number[]
}

/** Groups the flat roster into one entry per candidate. */
export function groupRoster(roster: RosterEntry[]): Person[] {
  const byRoll = new Map<string, Person>()
  roster.forEach((r) => {
    if (!byRoll.has(r.roll)) {
      byRoll.set(r.roll, {
        roll: r.roll, name: r.name, seat: r.seat,
        venue: r.venue, city: r.city, ids: [],
      })
    }
    byRoll.get(r.roll)!.ids.push(r.templateId)
  })
  return [...byRoll.values()].sort((a, b) => a.roll.localeCompare(b.roll))
}
