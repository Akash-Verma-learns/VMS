import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import api from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import { FileText, CheckSquare, Banknote, BarChart2, XCircle, Clock, Building2, AlertTriangle } from "lucide-react"

function labelIcon(label: string) {
  if (/assignment/i.test(label)) return CheckSquare
  if (/fal/i.test(label)) return Banknote
  if (/bill/i.test(label)) return BarChart2
  if (/exam|release/i.test(label)) return FileText
  if (/venue/i.test(label)) return Building2
  if (/overdue/i.test(label)) return AlertTriangle
  return Clock
}

function MetricCard({ label, count, urgent }: { label: string; count: number; urgent: boolean }) {
  const Icon = labelIcon(label)
  const bg = urgent && count > 0 ? "bg-red-500" : count > 0 ? "bg-amber-500" : "bg-green-500"
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${bg}`}><Icon size={22} className="text-white" /></div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{count}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  )
}

const QUICK_ACTIONS: Record<string, { label: string; to: string }[]> = {
  ASO: [{ label: "Create New Exam", to: "/exams/create" }, { label: "Draft FAL", to: "/fal" }],
  SO:  [{ label: "Create New Exam", to: "/exams/create" }, { label: "Review Approvals", to: "/approvals" }],
  US:  [{ label: "Review Approvals", to: "/approvals" }, { label: "View Cockpit", to: "/cockpit" }],
  DS:  [{ label: "Review Approvals", to: "/approvals" }, { label: "View Cockpit", to: "/cockpit" }],
  JS:  [{ label: "Review Approvals", to: "/approvals" }, { label: "View Cockpit", to: "/cockpit" }],
  CS:  [{ label: "Submit Venue List", to: "/cs/venues" }, { label: "Upload Bills", to: "/cs/bills" }],
  VS:  [{ label: "View My Checklist", to: "/vs/dashboard" }, { label: "Confirm Materials", to: "/vs/dashboard" }],
  IO:  [],
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const role = user?.role ?? ""

  const canViewWorkload = ["SO", "US", "DS", "JS", "ASO"].includes(role)
  const canSeeRejectedApprovals = ["ASO", "SO"].includes(role)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["workload"],
    queryFn: () => api.get("/api/cockpit/team-workload").then((r) => r.data),
    enabled: canViewWorkload,
  })

  const { data: rejectedApprovals } = useQuery({
    queryKey: ["my-rejected-approvals"],
    queryFn: () => api.get("/api/approvals/mine/rejected").then((r) => r.data),
    enabled: canSeeRejectedApprovals,
  })

  const metrics: { label: string; count: number; urgent: boolean }[] = data?.metrics ?? []

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="text-gray-500 text-sm">Role: {role} | UPSC Venue Management System</p>
        </div>

        {isLoading && canViewWorkload && <LoadingSpinner message="Loading dashboard…" />}
        {error && canViewWorkload && <ErrorMessage message="Could not load summary" onRetry={refetch} />}

        {!isLoading && !error && metrics.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <MetricCard key={m.label} label={m.label} count={m.count} urgent={m.urgent} />
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {(QUICK_ACTIONS[role] ?? []).length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              {(QUICK_ACTIONS[role] ?? []).map((a) => (
                <button key={a.label} onClick={() => navigate(a.to)}
                  className="px-4 py-2 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy-light transition-colors">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Returned/rejected approvals */}
        {canSeeRejectedApprovals && (rejectedApprovals ?? []).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <XCircle size={18} className="text-red-600 shrink-0" />
              <h2 className="text-sm font-semibold text-red-800">
                {(rejectedApprovals ?? []).length} approval request{(rejectedApprovals ?? []).length > 1 ? "s" : ""} returned — review and resubmit
              </h2>
            </div>
            {(rejectedApprovals ?? []).map((a: any) => {
              const lastAudit = a.auditEntries?.[0]
              return (
                <div key={a.id} className="bg-white border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">
                    {a.type?.replace(/_/g, " ")}
                    <span className="text-gray-400 text-xs ml-2">· {a.exam?.examCode}</span>
                  </p>
                  {lastAudit?.remarks && (
                    <p className="text-xs text-red-600 mt-0.5">
                      Returned by {lastAudit.actor?.name} ({lastAudit.actor?.role}): "{lastAudit.remarks}"
                    </p>
                  )}
                  <a href="/approvals" className="text-xs text-navy underline mt-1 inline-block">Go to Approvals →</a>
                </div>
              )
            })}
          </div>
        )}

        {/* System summary table */}
        {!isLoading && !error && metrics.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Action Summary</h2>
            <div className="space-y-0">
              {metrics.map((m, i) => (
                <div key={m.label} className={`flex justify-between py-2 text-sm text-gray-700 ${i < metrics.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <span>{m.label}</span>
                  <span className={`font-medium ${m.urgent && m.count > 0 ? "text-red-600" : m.count > 0 ? "text-amber-600" : "text-green-600"}`}>
                    {m.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
