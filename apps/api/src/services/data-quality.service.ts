import prisma from '../lib/prisma'

// MOD-13 GAP: Data Completeness & Consistency Check
//
// Every MIS report and cockpit metric is a read-model built on top of records
// entered by field staff (VS/IO/CS) over hours or days. A missing readiness
// submission, a jammer never confirmed, or a checkpoint with pwbdCount >
// totalAttendance doesn't throw — it just silently renders as a plausible-looking
// zero or a wrong percentage in a report an officer trusts. This module scans
// an exam's underlying records for exactly those two failure modes —
// INCOMPLETE (a record that should exist doesn't, or is missing required data)
// and INCONSISTENT (two records disagree, or a record contradicts its own
// status) — and reports them with a pointer to which downstream report they
// would have distorted, so officers can fix the source data instead of
// misreading the output.

export type IssueSeverity = 'ERROR' | 'WARNING'
export type IssueKind = 'INCOMPLETE' | 'INCONSISTENT'

export interface DataQualityIssue {
  ruleId: string
  severity: IssueSeverity
  kind: IssueKind
  category: string
  message: string
  entityType: string
  entityId: string
  entityLabel: string
  affectedReports: string[]
}

interface Rule {
  id: string
  category: string
  run: (b: DataBundle) => DataQualityIssue[]
}

type DataBundle = NonNullable<Awaited<ReturnType<typeof loadBundle>>>

async function loadBundle(examId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } })
  if (!exam) return null

  const [centres, assignments, readiness, fals, bills, materialPins, checkpoints, inspections, jammerStatuses, approvalRequests] =
    await Promise.all([
      prisma.centre.findMany({ where: { examId } }),
      prisma.venueAssignment.findMany({ where: { examId }, include: { venue: true } }),
      prisma.venueReadiness.findMany({ where: { examId } }),
      prisma.fAL.findMany({ where: { examId } }),
      prisma.bill.findMany({ where: { examId } }),
      prisma.materialPin.findMany({ where: { examId }, include: { trackingEvents: true, venue: true } }),
      prisma.checkpointSubmission.findMany({ where: { examId } }),
      prisma.inspection.findMany({ where: { examId }, include: { venue: true } }),
      prisma.jammerStatus.findMany({ where: { examId } }),
      prisma.approvalRequest.findMany({ where: { examId }, include: { auditEntries: true } }),
    ])

  return { exam, centres, assignments, readiness, fals, bills, materialPins, checkpoints, inspections, jammerStatuses, approvalRequests }
}

function venueLabel(v: any): string {
  return v ? `${v.name} (${v.cityName})` : 'Unknown venue'
}

const RULES: Rule[] = [
  {
    id: 'EXAM_RELEASED_NO_APPROVED_VENUES',
    category: 'Venue Assignment',
    run: (b) => {
      if (b.exam.status !== 'RELEASED') return []
      const approved = b.assignments.filter((a) => a.status === 'APPROVED')
      if (approved.length > 0) return []
      return [{
        ruleId: 'EXAM_RELEASED_NO_APPROVED_VENUES', severity: 'ERROR', kind: 'INCOMPLETE',
        category: 'Venue Assignment',
        message: `Exam "${b.exam.name}" is RELEASED but has no APPROVED venue assignments`,
        entityType: 'Exam', entityId: b.exam.id, entityLabel: b.exam.name,
        affectedReports: ['Venue Status Report', 'Jammer Status Report', 'PwBD Candidates Report'],
      }]
    },
  },
  {
    id: 'APPROVED_VENUE_MISSING_SEATS',
    category: 'Venue Assignment',
    run: (b) => b.assignments
      .filter((a) => a.status === 'APPROVED' && a.seatsAllocated == null)
      .map((a) => ({
        ruleId: 'APPROVED_VENUE_MISSING_SEATS', severity: 'WARNING' as const, kind: 'INCOMPLETE' as const,
        category: 'Venue Assignment',
        message: `Venue "${venueLabel(a.venue)}" is APPROVED but has no seatsAllocated value`,
        entityType: 'VenueAssignment', entityId: a.id, entityLabel: venueLabel(a.venue),
        affectedReports: ['PwBD Candidates Report', 'Finance Summary'],
      })),
  },
  {
    id: 'VENUE_INVALID_CAPACITY',
    category: 'Venue Assignment',
    run: (b) => {
      const seen = new Set<string>()
      const out: DataQualityIssue[] = []
      for (const a of b.assignments) {
        if (!a.venue || seen.has(a.venue.id) || a.venue.capacity > 0) continue
        seen.add(a.venue.id)
        out.push({
          ruleId: 'VENUE_INVALID_CAPACITY', severity: 'ERROR', kind: 'INCONSISTENT',
          category: 'Venue Assignment',
          message: `Venue "${venueLabel(a.venue)}" has capacity ${a.venue.capacity} — cannot host an exam`,
          entityType: 'Venue', entityId: a.venue.id, entityLabel: venueLabel(a.venue),
          affectedReports: ['Venue Status Report'],
        })
      }
      return out
    },
  },
  {
    id: 'APPROVED_VENUE_NO_VS',
    category: 'Venue Assignment',
    run: (b) => b.assignments
      .filter((a) => a.status === 'APPROVED' && !a.vsId)
      .map((a) => ({
        ruleId: 'APPROVED_VENUE_NO_VS', severity: 'ERROR' as const, kind: 'INCOMPLETE' as const,
        category: 'Venue Assignment',
        message: `Venue "${venueLabel(a.venue)}" is APPROVED but has no Venue Superintendent assigned`,
        entityType: 'VenueAssignment', entityId: a.id, entityLabel: venueLabel(a.venue),
        affectedReports: ['Venue Status Report', 'Exam Day Checkpoints'],
      })),
  },
  {
    id: 'APPROVED_VENUE_NO_READINESS_RECORD',
    category: 'Readiness',
    run: (b) => {
      const withReadiness = new Set(b.readiness.map((r) => r.venueId))
      return b.assignments
        .filter((a) => a.status === 'APPROVED' && !withReadiness.has(a.venueId))
        .map((a) => ({
          ruleId: 'APPROVED_VENUE_NO_READINESS_RECORD', severity: 'ERROR' as const, kind: 'INCOMPLETE' as const,
          category: 'Readiness',
          message: `Venue "${venueLabel(a.venue)}" is APPROVED but never started a readiness checklist`,
          entityType: 'VenueAssignment', entityId: a.id, entityLabel: venueLabel(a.venue),
          affectedReports: ['Venue Status Report'],
        }))
    },
  },
  {
    id: 'READINESS_STATUS_DATA_MISMATCH',
    category: 'Readiness',
    run: (b) => b.readiness
      .filter((r) => (r.status === 'SUBMITTED' || r.status === 'REVIEWED') && !r.checklistData)
      .map((r) => ({
        ruleId: 'READINESS_STATUS_DATA_MISMATCH', severity: 'WARNING' as const, kind: 'INCONSISTENT' as const,
        category: 'Readiness',
        message: `Readiness record is marked ${r.status} but has no checklist data`,
        entityType: 'VenueReadiness', entityId: r.id, entityLabel: r.venueId,
        affectedReports: ['Venue Status Report'],
      })),
  },
  {
    id: 'FAL_INVALID_AMOUNT',
    category: 'FAL & Finance',
    run: (b) => b.fals
      .filter((f) => f.status !== 'DRAFT' && f.advanceAmount <= 0n)
      .map((f) => ({
        ruleId: 'FAL_INVALID_AMOUNT', severity: 'ERROR' as const, kind: 'INCONSISTENT' as const,
        category: 'FAL & Finance',
        message: `FAL ${f.falNumber} is ${f.status} with a non-positive advance amount`,
        entityType: 'FAL', entityId: f.id, entityLabel: f.falNumber,
        affectedReports: ['FAL Status Report', 'Finance Summary'],
      })),
  },
  {
    id: 'FAL_ISSUED_NO_TIMESTAMP',
    category: 'FAL & Finance',
    run: (b) => b.fals
      .filter((f) => f.status === 'ISSUED' && !f.issuedAt)
      .map((f) => ({
        ruleId: 'FAL_ISSUED_NO_TIMESTAMP', severity: 'WARNING' as const, kind: 'INCOMPLETE' as const,
        category: 'FAL & Finance',
        message: `FAL ${f.falNumber} is ISSUED but has no issuedAt timestamp`,
        entityType: 'FAL', entityId: f.id, entityLabel: f.falNumber,
        affectedReports: ['FAL Status Report'],
      })),
  },
  {
    id: 'FAL_ACK_BEFORE_ISSUE',
    category: 'FAL & Finance',
    run: (b) => b.fals
      .filter((f) => f.acknowledgedAt && f.issuedAt && f.acknowledgedAt.getTime() < f.issuedAt.getTime())
      .map((f) => ({
        ruleId: 'FAL_ACK_BEFORE_ISSUE', severity: 'ERROR' as const, kind: 'INCONSISTENT' as const,
        category: 'FAL & Finance',
        message: `FAL ${f.falNumber} shows acknowledgedAt before issuedAt — impossible timeline`,
        entityType: 'FAL', entityId: f.id, entityLabel: f.falNumber,
        affectedReports: ['FAL Status Report'],
      })),
  },
  {
    id: 'BILL_APPROVED_NOT_VERIFIED',
    category: 'FAL & Finance',
    run: (b) => b.bills
      .filter((bill) => bill.status === 'APPROVED' && (!bill.verifiedBy || !bill.verifiedAt))
      .map((bill) => ({
        ruleId: 'BILL_APPROVED_NOT_VERIFIED', severity: 'ERROR' as const, kind: 'INCONSISTENT' as const,
        category: 'FAL & Finance',
        message: `Bill ${bill.id.slice(0, 8)} is APPROVED but has no verifier recorded`,
        entityType: 'Bill', entityId: bill.id, entityLabel: `Bill ${bill.id.slice(0, 8)} (${bill.type})`,
        affectedReports: ['Finance Summary'],
      })),
  },
  {
    id: 'MATERIAL_CONFIRMED_NOT_RECEIVED',
    category: 'Material Tracking',
    run: (b) => b.materialPins
      .filter((p) => {
        const events: any[] = p.trackingEvents
        return events.some((e) => e.eventType === 'CONFIRMED') && !events.some((e) => e.eventType === 'RECEIVED')
      })
      .map((p) => ({
        ruleId: 'MATERIAL_CONFIRMED_NOT_RECEIVED', severity: 'ERROR' as const, kind: 'INCONSISTENT' as const,
        category: 'Material Tracking',
        message: `Material PIN ${p.pin} was CONFIRMED without a prior RECEIVED event — chain of custody gap`,
        entityType: 'MaterialPin', entityId: p.id, entityLabel: `PIN ${p.pin} (${venueLabel(p.venue)})`,
        affectedReports: ['Material Status Report'],
      })),
  },
  {
    id: 'MATERIAL_DISCREPANCY_NO_REMARKS',
    category: 'Material Tracking',
    run: (b) => {
      const out: DataQualityIssue[] = []
      for (const p of b.materialPins) {
        for (const e of p.trackingEvents as any[]) {
          if (e.discrepancy && !e.remarks?.trim()) {
            out.push({
              ruleId: 'MATERIAL_DISCREPANCY_NO_REMARKS', severity: 'WARNING', kind: 'INCOMPLETE',
              category: 'Material Tracking',
              message: `Discrepancy flagged on PIN ${p.pin} (${e.eventType}) with no explanatory remarks`,
              entityType: 'MaterialTracking', entityId: e.id, entityLabel: `PIN ${p.pin} (${venueLabel(p.venue)})`,
              affectedReports: ['Material Status Report'],
            })
          }
        }
      }
      return out
    },
  },
  {
    id: 'ATTENDANCE_PWBD_EXCEEDS_TOTAL',
    category: 'Attendance / PwBD',
    run: (b) => b.checkpoints
      .filter((c) => c.type === 'EXAM_DAY_ATTENDANCE')
      .filter((c) => {
        const d = c.data as any
        return typeof d?.pwbdCount === 'number' && typeof d?.totalAttendance === 'number' && d.pwbdCount > d.totalAttendance
      })
      .map((c) => ({
        ruleId: 'ATTENDANCE_PWBD_EXCEEDS_TOTAL', severity: 'ERROR' as const, kind: 'INCONSISTENT' as const,
        category: 'Attendance / PwBD',
        message: `Attendance checkpoint reports pwbdCount (${(c.data as any).pwbdCount}) greater than totalAttendance (${(c.data as any).totalAttendance})`,
        entityType: 'CheckpointSubmission', entityId: c.id, entityLabel: c.venueId,
        affectedReports: ['PwBD Candidates Report'],
      })),
  },
  {
    id: 'ATTENDANCE_MISSING_FIELDS',
    category: 'Attendance / PwBD',
    run: (b) => b.checkpoints
      .filter((c) => c.type === 'EXAM_DAY_ATTENDANCE')
      .filter((c) => {
        const d = c.data as any
        return d?.pwbdCount == null || d?.totalAttendance == null
      })
      .map((c) => ({
        ruleId: 'ATTENDANCE_MISSING_FIELDS', severity: 'WARNING' as const, kind: 'INCOMPLETE' as const,
        category: 'Attendance / PwBD',
        message: `Attendance checkpoint is missing pwbdCount or totalAttendance`,
        entityType: 'CheckpointSubmission', entityId: c.id, entityLabel: c.venueId,
        affectedReports: ['PwBD Candidates Report'],
      })),
  },
  {
    id: 'INSPECTION_REMEDIATION_FLAG_MISMATCH',
    category: 'Inspection',
    run: (b) => b.inspections
      .filter((i) => i.requiresRemediation && i.status !== 'REMEDIATION_REQUIRED')
      .map((i) => ({
        ruleId: 'INSPECTION_REMEDIATION_FLAG_MISMATCH', severity: 'WARNING' as const, kind: 'INCONSISTENT' as const,
        category: 'Inspection',
        message: `Inspection at "${venueLabel(i.venue)}" has requiresRemediation=true but status is ${i.status}`,
        entityType: 'Inspection', entityId: i.id, entityLabel: venueLabel(i.venue),
        affectedReports: ['Inspections Report'],
      })),
  },
  {
    id: 'INSPECTION_REMEDIATION_NO_FINDINGS',
    category: 'Inspection',
    run: (b) => b.inspections
      .filter((i) => i.status === 'REMEDIATION_REQUIRED' && !i.findings?.trim())
      .map((i) => ({
        ruleId: 'INSPECTION_REMEDIATION_NO_FINDINGS', severity: 'WARNING' as const, kind: 'INCOMPLETE' as const,
        category: 'Inspection',
        message: `Inspection at "${venueLabel(i.venue)}" requires remediation but has no findings recorded`,
        entityType: 'Inspection', entityId: i.id, entityLabel: venueLabel(i.venue),
        affectedReports: ['Inspections Report'],
      })),
  },
  {
    id: 'JAMMER_MISSING_FOR_APPROVED_VENUE',
    category: 'Jammer',
    run: (b) => {
      const withJammer = new Set(b.jammerStatuses.map((j) => j.venueId))
      return b.assignments
        .filter((a) => a.status === 'APPROVED' && !withJammer.has(a.venueId))
        .map((a) => ({
          ruleId: 'JAMMER_MISSING_FOR_APPROVED_VENUE', severity: 'WARNING' as const, kind: 'INCOMPLETE' as const,
          category: 'Jammer',
          message: `Venue "${venueLabel(a.venue)}" is APPROVED but has no jammer status confirmed`,
          entityType: 'VenueAssignment', entityId: a.id, entityLabel: venueLabel(a.venue),
          affectedReports: ['Jammer Status Report'],
        }))
    },
  },
  {
    id: 'APPROVAL_APPROVED_NO_AUDIT_TRAIL',
    category: 'Approvals',
    run: (b) => b.approvalRequests
      .filter((r) => r.status === 'APPROVED' && r.auditEntries.length === 0)
      .map((r) => ({
        ruleId: 'APPROVAL_APPROVED_NO_AUDIT_TRAIL', severity: 'WARNING' as const, kind: 'INCONSISTENT' as const,
        category: 'Approvals',
        message: `${r.type} approval request is APPROVED but has no audit trail explaining the decision`,
        entityType: 'ApprovalRequest', entityId: r.id, entityLabel: r.type,
        affectedReports: ['Approval History'],
      })),
  },
  {
    id: 'CENTRE_RELEASED_NO_FINAL_CAPACITY',
    category: 'Venue Assignment',
    run: (b) => b.centres
      .filter((c) => c.isReleased && c.finalCapacity == null)
      .map((c) => ({
        ruleId: 'CENTRE_RELEASED_NO_FINAL_CAPACITY', severity: 'ERROR' as const, kind: 'INCONSISTENT' as const,
        category: 'Venue Assignment',
        message: `Centre "${c.cityName}" is released but has no finalCapacity set`,
        entityType: 'Centre', entityId: c.id, entityLabel: c.cityName,
        affectedReports: ['Venue Status Report'],
      })),
  },
]

export interface DataQualityReport {
  examId: string
  examName: string
  examCode: string
  generatedAt: string
  recordsScanned: number
  completenessScore: number
  summary: { errors: number; warnings: number; incomplete: number; inconsistent: number }
  byCategory: Record<string, { errors: number; warnings: number }>
  issues: DataQualityIssue[]
}

// ─── Exam Clearance Certificate ───────────────────────────────────────────────
//
// The data quality report is a diagnostic tool for people who already know
// what a "rule category" is. An officer deciding whether an exam can be
// conducted needs a single yes/no with the blast radius attached — how many
// candidates sit at venues with unresolved errors — not a table of rule ids.
// This turns the same issue list into that decision document.

export interface ClearanceChecklistItem {
  label: string
  status: 'PASS' | 'FAIL' | 'WARN'
  detail: string
  category: string
}

export interface ClearanceCertificate {
  examId: string
  examName: string
  examCode: string
  generatedAt: string
  generatedBy: string
  status: 'CLEARED' | 'BLOCKED'
  completenessScore: number
  totalVenues: number
  clearedVenues: number
  blockedVenues: number
  candidatesAtRisk: number
  totalCandidates: number
  errorCount: number
  warningCount: number
  issues: DataQualityIssue[]
  checklistItems: ClearanceChecklistItem[]
}

// One row per rule category — plain-English framing for a non-technical officer,
// plus whether the row's pass/fail should be expressed as a venue fraction.
const CLEARANCE_CATEGORY_META: Record<string, { label: string; venueScoped: boolean }> = {
  'Venue Assignment': { label: 'All venues are properly assigned with valid capacity and staffing', venueScoped: true },
  'Readiness': { label: 'All venues have completed pre-exam readiness checklists', venueScoped: true },
  'Jammer': { label: 'All venues have confirmed jammer status', venueScoped: true },
  'FAL & Finance': { label: 'Financial Advance Letters and bills are complete and consistent', venueScoped: false },
  'Material Tracking': { label: 'Exam material chain of custody is complete and unbroken', venueScoped: false },
  'Attendance / PwBD': { label: 'Exam-day attendance and PwBD figures are consistent', venueScoped: false },
  'Inspection': { label: 'Venue inspections are complete with recorded findings', venueScoped: false },
  'Approvals': { label: 'Approval decisions have a recorded audit trail', venueScoped: false },
}

export async function generateClearanceCertificate(examId: string, generatedBy: string): Promise<ClearanceCertificate | null> {
  const qualityReport = await runDataQualityChecks(examId)
  if (!qualityReport) return null

  const approvedAssignments = await prisma.venueAssignment.findMany({
    where: { examId, status: 'APPROVED' },
    include: { venue: true },
  })

  const errorIssues = qualityReport.issues.filter((i) => i.severity === 'ERROR')

  function hasErrorIssue(a: (typeof approvedAssignments)[number]): boolean {
    const label = venueLabel(a.venue)
    return errorIssues.some((issue) =>
      issue.entityId === a.venueId ||
      issue.entityId === a.id ||
      issue.entityId === a.venue?.id ||
      issue.entityLabel === label
    )
  }

  function seatsOrCapacity(a: (typeof approvedAssignments)[number]): number {
    return a.seatsAllocated ?? a.venue?.capacity ?? 0
  }

  const blockedAssignments = approvedAssignments.filter(hasErrorIssue)
  const clearedAssignments = approvedAssignments.filter((a) => !hasErrorIssue(a))

  const totalVenues = approvedAssignments.length
  const blockedVenues = blockedAssignments.length
  const clearedVenues = clearedAssignments.length
  const candidatesAtRisk = blockedAssignments.reduce((sum, a) => sum + seatsOrCapacity(a), 0)
  const totalCandidates = approvedAssignments.reduce((sum, a) => sum + seatsOrCapacity(a), 0)

  const checklistItems: ClearanceChecklistItem[] = Object.entries(CLEARANCE_CATEGORY_META).map(([category, meta]) => {
    const stat = qualityReport.byCategory[category] ?? { errors: 0, warnings: 0 }
    const status: ClearanceChecklistItem['status'] = stat.errors > 0 ? 'FAIL' : stat.warnings > 0 ? 'WARN' : 'PASS'

    let detail: string
    if (meta.venueScoped) {
      const affected = new Set(
        qualityReport.issues.filter((i) => i.category === category).map((i) => i.entityLabel)
      ).size
      detail = affected > 0
        ? `${totalVenues - affected} of ${totalVenues} venues clear (${affected} flagged)`
        : totalVenues > 0 ? `All ${totalVenues} approved venues clear` : 'No approved venues yet'
    } else {
      const total = stat.errors + stat.warnings
      detail = total > 0
        ? `${stat.errors} error${stat.errors === 1 ? '' : 's'}, ${stat.warnings} warning${stat.warnings === 1 ? '' : 's'} found`
        : 'No issues found'
    }

    return { label: meta.label, status, detail, category }
  })

  return {
    examId,
    examName: qualityReport.examName,
    examCode: qualityReport.examCode,
    generatedAt: new Date().toISOString(),
    generatedBy,
    status: qualityReport.summary.errors === 0 ? 'CLEARED' : 'BLOCKED',
    completenessScore: qualityReport.completenessScore,
    totalVenues,
    clearedVenues,
    blockedVenues,
    candidatesAtRisk,
    totalCandidates,
    errorCount: qualityReport.summary.errors,
    warningCount: qualityReport.summary.warnings,
    issues: qualityReport.issues,
    checklistItems,
  }
}

export async function runDataQualityChecks(examId: string): Promise<DataQualityReport | null> {
  const bundle = await loadBundle(examId)
  if (!bundle) return null

  const issues = RULES.flatMap((rule) => rule.run(bundle))

  const recordsScanned =
    bundle.centres.length + bundle.assignments.length + bundle.readiness.length + bundle.fals.length +
    bundle.bills.length + bundle.materialPins.length + bundle.checkpoints.length + bundle.inspections.length +
    bundle.jammerStatuses.length + bundle.approvalRequests.length

  const errors = issues.filter((i) => i.severity === 'ERROR').length
  const warnings = issues.filter((i) => i.severity === 'WARNING').length
  const incomplete = issues.filter((i) => i.kind === 'INCOMPLETE').length
  const inconsistent = issues.filter((i) => i.kind === 'INCONSISTENT').length

  const byCategory: Record<string, { errors: number; warnings: number }> = {}
  for (const issue of issues) {
    if (!byCategory[issue.category]) byCategory[issue.category] = { errors: 0, warnings: 0 }
    if (issue.severity === 'ERROR') byCategory[issue.category].errors++
    else byCategory[issue.category].warnings++
  }

  // Errors sink the score harder than warnings — an ERROR means a report
  // would show something actively wrong, not merely thin.
  const penalty = errors * 6 + warnings * 2
  const completenessScore = Math.max(0, Math.min(100, Math.round(100 - penalty)))

  return {
    examId,
    examName: bundle.exam.name,
    examCode: bundle.exam.examCode,
    generatedAt: new Date().toISOString(),
    recordsScanned,
    completenessScore,
    summary: { errors, warnings, incomplete, inconsistent },
    byCategory,
    issues: issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'ERROR' ? -1 : 1)),
  }
}
