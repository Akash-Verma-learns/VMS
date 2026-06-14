import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download } from "lucide-react"
import api, { formatMoney } from "../lib/api"
import Layout from "../components/Layout"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import StatusBadge from "../components/StatusBadge"
import clsx from "clsx"

type ReportKey = "pwbd" | "fal-status" | "jammer-status" | "team-workload" | "material-status" | "inspections" | "survey-summary" | "finance-summary" | "audit-log"

interface ReportConfig { label: string; endpoint: (examId: string) => string; needsExam: boolean; roles: string[] }

const REPORTS: Record<ReportKey, ReportConfig> = {
  "pwbd": { label: "PwBD Candidates Report", endpoint: (id) => `/api/reports/pwbd/${id}`, needsExam: true, roles: ["JS", "DS", "US", "SO"] },
  "fal-status": { label: "FAL Status Report", endpoint: (id) => `/api/reports/fal-status/${id}`, needsExam: true, roles: ["JS", "DS", "US"] },
  "jammer-status": { label: "Jammer Status Report", endpoint: (id) => `/api/reports/jammer-status/${id}`, needsExam: true, roles: ["JS", "DS", "US"] },
  "team-workload": { label: "Team Workload", endpoint: () => `/api/cockpit/team-workload`, needsExam: false, roles: ["JS", "DS", "US", "SO"] },
  "material-status": { label: "Material Status", endpoint: (id) => `/api/material/${id}`, needsExam: true, roles: ["DS", "US", "SO"] },
  "inspections": { label: "Inspections Report", endpoint: (id) => `/api/inspections/${id}`, needsExam: true, roles: ["JS", "DS", "US", "SO"] },
  "survey-summary": { label: "Survey Summary", endpoint: () => `/api/surveys`, needsExam: false, roles: ["US", "SO"] },
  "finance-summary": { label: "Finance Summary", endpoint: (id) => `/api/finance/bills/${id}`, needsExam: true, roles: ["JS", "DS", "US"] },
  "audit-log": { label: "Audit Log", endpoint: () => `/api/audit`, needsExam: false, roles: ["JS", "DS", "US"] },
}

function JsonTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) return <p className="text-gray-400 text-sm py-6 text-center">No data to display.</p>
  const keys = Object.keys(data[0])
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
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
                      : typeof v === "boolean" ? (v ? "✓" : "✗")
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
  const [activeReport, setActiveReport] = useState<ReportKey>("team-workload")
  const [examId, setExamId] = useState("")

  const config = REPORTS[activeReport]
  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get("/api/exams").then((r) => r.data) })
  const enabled = config.needsExam ? !!examId : true
  const endpoint = config.endpoint(examId)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["report", activeReport, examId],
    queryFn: () => api.get(endpoint).then((r) => r.data),
    enabled,
  })

  function downloadCSV() {
    const rows = Array.isArray(data) ? data : (data?.records ?? data?.calculations ?? data?.venues ?? [])
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
        <h1 className="text-xl font-bold text-gray-900">MIS Reports</h1>

        <div className="flex gap-4 items-start">
          {/* Sidebar */}
          <div className="w-60 shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {(Object.keys(REPORTS) as ReportKey[]).map((key) => (
                <button key={key} onClick={() => { setActiveReport(key); setExamId("") }}
                  className={clsx("w-full text-left px-4 py-3 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors",
                    activeReport === key ? "bg-navy/5 text-navy font-medium border-l-2 border-l-navy" : "text-gray-700")}>
                  {REPORTS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">{config.label}</h2>
                <button onClick={downloadCSV} disabled={!tableData?.length}
                  className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40">
                  <Download size={14} /> CSV
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

              {!enabled && <p className="text-gray-400 text-sm py-8 text-center">Select an exam to generate this report.</p>}
              {isLoading && <LoadingSpinner />}
              {error && <ErrorMessage message="Failed to load report" onRetry={refetch} />}
              {!isLoading && !error && enabled && <JsonTable data={tableData} />}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
