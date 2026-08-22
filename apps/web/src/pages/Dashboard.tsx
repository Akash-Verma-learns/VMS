import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import api from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import { FileText, CheckSquare, Banknote, BarChart2, XCircle, Clock, Building2, AlertTriangle, ChevronRight } from "lucide-react"

function labelIcon(label: string) {
  if (/assignment/i.test(label)) return CheckSquare
  if (/fal/i.test(label)) return Banknote
  if (/bill/i.test(label)) return BarChart2
  if (/exam|release/i.test(label)) return FileText
  if (/venue/i.test(label)) return Building2
  if (/overdue/i.test(label)) return AlertTriangle
  return Clock
}

/**
 * One row per thing waiting on this officer.
 *
 * This replaced a grid of metric tiles that sat above a list repeating the
 * same four numbers. The count is not the point — whether anything is waiting
 * is — so a settled row says so in words and a waiting row is clickable.
 */
function WorkRow({ label, count, urgent, to }: {
  label: string; count: number; urgent: boolean; to: string
}) {
  const navigate = useNavigate()
  const Icon = labelIcon(label)
  const waiting = count > 0
  const fg = !waiting ? "var(--ux4g-color-green-700)"
    : urgent ? "var(--ux4g-color-red-700)" : "var(--ux4g-color-orange-800)"
  const bg = !waiting ? "var(--ux4g-color-green-50)"
    : urgent ? "var(--ux4g-color-red-50)" : "var(--ux4g-color-orange-50)"

  return (
    <button
      onClick={() => waiting && navigate(to)}
      disabled={!waiting}
      className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-t first:border-t-0
                 enabled:hover:bg-black/[0.02] transition-colors disabled:cursor-default"
      style={{ borderColor: "var(--ux4g-color-neutral-200)" }}
    >
      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: bg, color: fg }}>
        <Icon size={18} strokeWidth={2} aria-hidden />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block ux4g-label-m-strong">{label}</span>
        <span className="ux4g-label-s-default" style={{ color: fg }}>
          {waiting ? `${count} waiting` : "Nothing waiting"}
        </span>
      </span>
      {waiting && <ChevronRight size={18} className="shrink-0 opacity-40" aria-hidden />}
    </button>
  )
}

/** Where each queue lives, so a row can be acted on rather than only read. */
const ROUTE_FOR = (label: string) =>
  /assignment|venue/i.test(label) ? "/approvals"
  : /fal|bill/i.test(label) ? "/fal"
  : /exam|release/i.test(label) ? "/exams"
  : "/approvals"

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
          <h1 className="ux4g-label-xl-strong text-2xl">Welcome, {user?.name}</h1>
          <p className="ux4g-label-m-default" style={{ color: "var(--ux4g-color-neutral-600)" }}>
            {role} · UPSC Venue Management System
          </p>
        </div>

        {isLoading && canViewWorkload && <LoadingSpinner message="Loading dashboard…" />}
        {error && canViewWorkload && <ErrorMessage message="Could not load summary" onRetry={refetch} />}

        {!isLoading && !error && metrics.length > 0 && (
          <section className="ux4g-card ux4g-card-solid overflow-hidden">
            <h2 className="ux4g-label-s-strong uppercase tracking-wide opacity-70 px-4 pt-4 pb-2">
              Waiting on you
            </h2>
            {metrics.map((m) => (
              <WorkRow key={m.label} label={m.label} count={m.count}
                       urgent={m.urgent} to={ROUTE_FOR(m.label)} />
            ))}
          </section>
        )}

        {/* Quick Actions */}
        {(QUICK_ACTIONS[role] ?? []).length > 0 && (
          <div className="ux4g-card ux4g-card-solid p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              {(QUICK_ACTIONS[role] ?? []).map((a) => (
                <button key={a.label} onClick={() => navigate(a.to)}
                  className="ux4g-btn ux4g-btn-primary ux4g-btn-md">
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
                    <span className="text-neutral-600 text-xs ml-2">· {a.exam?.examCode}</span>
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
      </div>
    </Layout>
  )
}
