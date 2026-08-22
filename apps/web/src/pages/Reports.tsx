import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronRight, Download, Printer, Shield, ShieldAlert, ShieldCheck, X, XCircle } from "lucide-react"
import { format } from "date-fns"
import api, { formatMoney } from "../lib/api"
import Layout from "../components/Layout"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import StatusBadge from "../components/StatusBadge"
import { useAuthStore } from "../store/auth"
import clsx from "clsx"

type ReportKey = "data-quality" | "clearance-certificate" | "pwbd" | "fal-status" | "jammer-status" | "team-workload" | "material-status" | "inspections" | "survey-summary" | "finance-summary"

interface ReportConfig { label: string; endpoint: (examId: string) => string; needsExam: boolean; roles: string[] }

const REPORTS: Record<ReportKey, ReportConfig> = {
  "data-quality": { label: "Data Completeness Check", endpoint: (id) => `/api/reports/data-quality/${id}`, needsExam: true, roles: ["JS", "DS", "US", "SO"] },
  "clearance-certificate": { label: "Exam Clearance Certificate", endpoint: (id) => `/api/reports/clearance-certificate/${id}`, needsExam: true, roles: ["JS", "DS", "US", "SO"] },
  "pwbd": { label: "PwBD Candidates Report", endpoint: (id) => `/api/reports/pwbd/${id}`, needsExam: true, roles: ["JS", "DS", "US", "SO"] },
  "fal-status": { label: "FAL Status Report", endpoint: (id) => `/api/reports/fal-status/${id}`, needsExam: true, roles: ["JS", "DS", "US"] },
  "jammer-status": { label: "Jammer Status Report", endpoint: (id) => `/api/reports/jammer-status/${id}`, needsExam: true, roles: ["JS", "DS", "US"] },
  "team-workload": { label: "Team Workload", endpoint: () => `/api/cockpit/team-workload`, needsExam: false, roles: ["JS", "DS", "US", "SO"] },
  "material-status": { label: "Material Status", endpoint: (id) => `/api/reports/material-tracking/${id}`, needsExam: true, roles: ["DS", "US", "SO"] },
  "inspections": { label: "Inspections Report", endpoint: (id) => `/api/inspections/${id}`, needsExam: true, roles: ["JS", "DS", "US", "SO"] },
  "survey-summary": { label: "Survey Summary", endpoint: () => `/api/surveys`, needsExam: false, roles: ["US", "SO"] },
  "finance-summary": { label: "Finance Summary", endpoint: (id) => `/api/finance/bills/${id}`, needsExam: true, roles: ["JS", "DS", "US"] },
}

interface DataQualityIssue {
  ruleId: string
  severity: "ERROR" | "WARNING"
  kind: "INCOMPLETE" | "INCONSISTENT"
  category: string
  message: string
  entityType: string
  entityId: string
  entityLabel: string
  affectedReports: string[]
}

interface DataQualityReport {
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

interface ClearanceChecklistItem {
  label: string
  status: "PASS" | "FAIL" | "WARN"
  detail: string
  category: string
}

interface ClearanceCertificate {
  examId: string
  examName: string
  examCode: string
  generatedAt: string
  generatedBy: string
  status: "CLEARED" | "BLOCKED"
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

function scoreColor(score: number) {
  if (score >= 90) return "text-green-600"
  if (score >= 70) return "text-amber-600"
  return "text-red-600"
}

function IssuesTable({ issues }: { issues: DataQualityIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-green-700">
        <ShieldCheck size={18} />
        <p className="text-sm font-medium">No completeness or consistency issues found for this exam.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto border border-gray-100 rounded-lg">
      <table className="ux4g-table w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {["Severity", "Category", "Record", "Issue", "Would affect"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {issues.map((issue, i) => (
            <tr key={`${issue.ruleId}-${issue.entityId}-${i}`} className="hover:bg-gray-50 align-top">
              <td className="px-3 py-2">
                <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                  issue.severity === "ERROR" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800")}>
                  {issue.severity === "ERROR" ? <ShieldAlert size={11} /> : <AlertTriangle size={11} />}
                  {issue.kind === "INCONSISTENT" ? "Inconsistent" : "Incomplete"}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{issue.category}</td>
              <td className="px-3 py-2 text-gray-700 font-medium whitespace-nowrap">{issue.entityLabel}</td>
              <td className="px-3 py-2 text-gray-700">{issue.message}</td>
              <td className="px-3 py-2 text-neutral-600 text-xs">{issue.affectedReports.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DataQualityView({ data }: { data: DataQualityReport }) {
  const { summary, byCategory, issues, completenessScore, recordsScanned } = data
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-4 text-center col-span-1">
          <div className={clsx("text-3xl font-bold", scoreColor(completenessScore))}>{completenessScore}</div>
          <div className="text-xs text-gray-500 mt-1">Completeness Score</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
          <div className="text-xs text-gray-500 mt-1">Errors (inconsistent)</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{summary.warnings}</div>
          <div className="text-xs text-gray-500 mt-1">Warnings (incomplete)</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-700">{recordsScanned}</div>
          <div className="text-xs text-gray-500 mt-1">Records Scanned</div>
        </div>
      </div>

      {Object.keys(byCategory).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byCategory).map(([cat, c]) => (
            <span key={cat} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-full text-xs text-gray-600">
              {cat}
              {c.errors > 0 && <span className="text-red-600 font-semibold">{c.errors} err</span>}
              {c.warnings > 0 && <span className="text-amber-600 font-semibold">{c.warnings} warn</span>}
            </span>
          ))}
        </div>
      )}

      <IssuesTable issues={issues} />
    </div>
  )
}

function ClearanceCertificateView({ data }: { data: ClearanceCertificate }) {
  const [showIssues, setShowIssues] = useState(false)
  const cleared = data.status === "CLEARED"

  const grouped = data.checklistItems.reduce<Record<string, ClearanceChecklistItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item)
    return acc
  }, {})

  return (
    <div className="vms-certificate space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .vms-certificate, .vms-certificate * { visibility: visible; }
          .vms-certificate { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .vms-certificate .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-100 pb-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-navy/5 flex items-center justify-center shrink-0">
            <Shield className="text-navy" size={28} />
          </div>
          <div>
            <h2 className="ux4g-title-m-strong">Exam Clearance Certificate</h2>
            <p className="text-sm text-gray-500">Pre-Conduct Verification Report</p>
            <div className="mt-2 text-xs text-gray-500 space-y-0.5">
              <p><span className="font-medium text-gray-700">{data.examName}</span> · {data.examCode}</p>
              <p>Generated {format(new Date(data.generatedAt), "d MMM yyyy, h:mm a")} by {data.generatedBy}</p>
            </div>
          </div>
        </div>
        <button onClick={() => window.print()}
          className="no-print flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 shrink-0">
          <Printer size={14} /> Print / Download PDF
        </button>
      </div>

      {/* Status banner */}
      <div className={clsx("rounded-xl p-6 text-center border-2",
        cleared ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
        <div className="flex items-center justify-center gap-3">
          {cleared ? <CheckCircle2 className="text-green-600" size={32} /> : <XCircle className="text-red-600" size={32} />}
          <p className={clsx("text-xl font-bold tracking-tight", cleared ? "text-green-700" : "text-red-700")}>
            {cleared ? "THIS EXAM IS CLEARED FOR CONDUCT" : "THIS EXAM CANNOT BE CONDUCTED — UNRESOLVED ISSUES REMAIN"}
          </p>
        </div>
        {!cleared && (
          <p className="mt-3 text-2xl font-bold text-red-600">
            {data.candidatesAtRisk.toLocaleString("en-IN")} candidates at risk
          </p>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-700">{data.totalVenues}</div>
          <div className="text-xs text-gray-500 mt-1">Total Venues</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{data.clearedVenues}</div>
          <div className="text-xs text-gray-500 mt-1">Cleared Venues</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{data.blockedVenues}</div>
          <div className="text-xs text-gray-500 mt-1">Blocked Venues</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className={clsx("text-2xl font-bold", scoreColor(data.completenessScore))}>{data.completenessScore}</div>
          <div className="text-xs text-gray-500 mt-1">Completeness Score</div>
        </div>
      </div>

      {/* Checklist */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Pre-Conduct Verification Checklist</h3>
        <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="px-4 py-3">
              <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-2">{category}</p>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">
                      {item.status === "PASS"
                        ? <CheckCircle2 size={16} aria-label="Pass" style={{ color: "var(--ux4g-color-green-700)" }} />
                        : item.status === "FAIL"
                          ? <XCircle size={16} aria-label="Fail" style={{ color: "var(--ux4g-color-red-700)" }} />
                          : <AlertTriangle size={16} aria-label="Warning" style={{ color: "var(--ux4g-color-orange-700)" }} />}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full issue log */}
      <div className="no-print">
        <button onClick={() => setShowIssues((v) => !v)}
          className="flex items-center gap-2 font-semibold text-gray-900 mb-3 hover:text-navy transition-colors">
          {showIssues ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Full Issue Log ({data.issues.length})
        </button>
        {showIssues && <IssuesTable issues={data.issues} />}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 pt-4 text-xs text-neutral-600 space-y-1">
        <p>This certificate was generated automatically by the UPSC Venue Management System.</p>
        <p>It reflects the state of records as at {format(new Date(data.generatedAt), "d MMM yyyy, h:mm a")}.</p>
        <p>This document does not constitute official clearance unless countersigned by a designated authority.</p>
      </div>
    </div>
  )
}

function JsonTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) return <p className="text-neutral-600 text-sm py-6 text-center">No data to display.</p>
  const keys = Object.keys(data[0])
  return (
    <div className="overflow-x-auto">
      <table className="ux4g-table w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>{keys.map((k) => <th key={k} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{k.replace(/([A-Z])/g, " $1")}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {keys.map((k) => {
                const v = row[k]
                return (
                  <td key={k} className="px-3 py-2 text-gray-700">
                    {v === null || v === undefined ? "—"
                      : typeof v === "boolean"
                        ? (v ? <Check size={15} strokeWidth={2.5} aria-label="Yes" style={{ color: "var(--ux4g-color-green-700)" }} />
                             : <X size={15} strokeWidth={2.5} aria-label="No" style={{ color: "var(--ux4g-color-red-700)" }} />)
                      : k === "status" ? <StatusBadge status={v} />
                      : k.toLowerCase().includes("amount") || k.toLowerCase().includes("total") || k.toLowerCase().includes("honorarium")
                        ? formatMoney(v)
                      : typeof v === "object" ? JSON.stringify(v)
                      : String(v)
                    }
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Reports() {
  const [searchParams] = useSearchParams()
  // Supports deep-linking from other pages (e.g. Cockpit's "View Clearance Certificate")
  // with an exam and tab pre-selected via ?exam=<id>&tab=<reportKey>.
  const [activeReport, setActiveReport] = useState<ReportKey>(() => {
    const tab = searchParams.get("tab")
    return tab && tab in REPORTS ? (tab as ReportKey) : "team-workload"
  })
  const [examId, setExamId] = useState(() => searchParams.get("exam") ?? "")
  const user = useAuthStore((s) => s.user)

  const config = REPORTS[activeReport]
  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get("/api/exams").then((r) => r.data) })
  const enabled = config.needsExam ? !!examId : true
  const endpoint = activeReport === "clearance-certificate"
    ? `${config.endpoint(examId)}?officerName=${encodeURIComponent(user?.name ?? user?.role ?? "Officer")}`
    : config.endpoint(examId)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["report", activeReport, examId],
    queryFn: () => api.get(endpoint).then((r) => r.data),
    enabled,
  })

  // Cross-report data quality banner: runs independently of the active tab so switching
  // between reports doesn't hide known gaps in the underlying records for this exam.
  const { data: dq } = useQuery<DataQualityReport>({
    queryKey: ["report", "data-quality", examId],
    queryFn: () => api.get(`/api/reports/data-quality/${examId}`).then((r) => r.data),
    enabled: !!examId && activeReport !== "data-quality",
  })

  function downloadCSV() {
    const rows = Array.isArray(data) ? data : (data?.records ?? data?.calculations ?? data?.venues ?? data?.issues ?? [])
    if (!rows.length) return
    const keys = Object.keys(rows[0])
    const csv = [keys.join(","), ...rows.map((r: any) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${activeReport}.csv`; a.click()
  }

  const tableData = Array.isArray(data) ? data
    : data?.calculations ?? data?.records ?? data?.venues ?? data?.inspections ?? data?.surveys
    ?? (data && typeof data === "object" ? [data] : [])

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-4">
        <h1 className="ux4g-heading-xl-strong">MIS Reports</h1>

        <div className="flex gap-4 items-start">
          {/* Sidebar */}
          <div className="w-60 shrink-0">
            <div className="ux4g-card ux4g-card-solid overflow-hidden">
              {(Object.keys(REPORTS) as ReportKey[]).map((key) => (
                <button key={key} onClick={() => setActiveReport(key)}
                  className={clsx("w-full text-left px-4 py-3 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors",
                    activeReport === key ? "bg-navy/10 text-navy font-semibold" : "text-gray-700")}>
                  {REPORTS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            <div className="ux4g-card ux4g-card-solid p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">{config.label}</h2>
                <button onClick={downloadCSV} disabled={!tableData?.length}
                  aria-label="Download this report as CSV"
                  className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-sm min-h-[36px] inline-flex items-center gap-2">
                  <Download size={15} strokeWidth={2} aria-hidden /> CSV
                </button>
              </div>

              {config.needsExam && (
                <div className="flex gap-3 items-center mb-4">
                  <label className="text-sm text-gray-600 shrink-0">Exam:</label>
                  <select value={examId} onChange={(e) => setExamId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                    <option value="">— Select exam —</option>
                    {(exams ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.examCode})</option>)}
                  </select>
                </div>
              )}

              {activeReport !== "data-quality" && dq && (dq.summary.errors > 0 || dq.summary.warnings > 0) && (
                <button onClick={() => setActiveReport("data-quality")}
                  className="w-full flex items-center gap-2 mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-left hover:bg-amber-100 transition-colors">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 flex-1">
                    <span className="font-semibold">{dq.summary.errors + dq.summary.warnings} data quality issue{dq.summary.errors + dq.summary.warnings === 1 ? "" : "s"}</span>
                    {" "}found in this exam's underlying records ({dq.summary.errors} error{dq.summary.errors === 1 ? "" : "s"}, {dq.summary.warnings} warning{dq.summary.warnings === 1 ? "" : "s"}) — numbers below may be incomplete.
                  </p>
                  <ChevronRight size={14} className="text-amber-600 shrink-0" />
                </button>
              )}

              {!enabled && <p className="text-neutral-600 text-sm py-8 text-center">Select an exam to generate this report.</p>}
              {isLoading && <LoadingSpinner />}
              {error && <ErrorMessage message="Failed to load report" onRetry={refetch} />}
              {!isLoading && !error && enabled && (
                activeReport === "data-quality" ? <DataQualityView data={data} />
                : activeReport === "clearance-certificate" ? <ClearanceCertificateView data={data} />
                : <JsonTable data={tableData} />
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
