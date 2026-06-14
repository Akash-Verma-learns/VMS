import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import api from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import { FileText, CheckSquare, Banknote, BarChart2 } from "lucide-react"

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}><Icon size={22} className="text-white" /></div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value ?? "—"}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  )
}

const QUICK_ACTIONS: Record<string, { label: string; to: string }[]> = {
  ASO: [{ label: "Create New Exam", to: "/exams/create" }, { label: "Draft FAL", to: "/fal" }],
  SO: [{ label: "Create New Exam", to: "/exams/create" }, { label: "Review Approvals", to: "/approvals" }],
  US: [{ label: "Review Approvals", to: "/approvals" }, { label: "View Cockpit", to: "/cockpit" }],
  DS: [{ label: "Review Approvals", to: "/approvals" }, { label: "View Cockpit", to: "/cockpit" }],
  JS: [{ label: "Review Approvals", to: "/approvals" }, { label: "View Cockpit", to: "/cockpit" }],
  CS: [{ label: "Submit Venue List", to: "/cs/venues" }, { label: "Upload Bills", to: "/cs/bills" }],
  VS: [{ label: "View My Checklist", to: "/vs/dashboard" }, { label: "Confirm Materials", to: "/vs/dashboard" }],
  IO: [],
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const role = user?.role ?? ""

  const canViewWorkload = ["SO", "US", "DS", "JS"].includes(role)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["workload"],
    queryFn: () => api.get("/api/cockpit/team-workload").then((r) => r.data),
    enabled: canViewWorkload,
  })

  const pending = data?.pendingApprovalsByRole?.reduce((s: number, r: any) => s + r.count, 0) ?? 0
  const falPending = data?.pendingFALsForDS ?? 0
  const bills = data?.pendingBillsForVerification ?? 0

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="text-gray-500 text-sm">Role: {role} | UPSC Venue Management System</p>
        </div>

        {isLoading && <LoadingSpinner message="Loading dashboard…" />}
        {error && canViewWorkload && <ErrorMessage message="Could not load summary" onRetry={refetch} />}

        {!isLoading && !error && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Pending Approvals" value={pending} icon={CheckSquare} color={pending > 0 ? "bg-amber-500" : "bg-green-500"} />
            <MetricCard label="FALs Awaiting DS" value={falPending} icon={Banknote} color={falPending > 0 ? "bg-red-500" : "bg-teal"} />
            <MetricCard label="Bills Pending" value={bills} icon={BarChart2} color="bg-indigo-500" />
            <MetricCard label="Overdue Approvals" value={data?.overdueApprovals ?? 0} icon={FileText} color={data?.overdueApprovals > 0 ? "bg-red-600" : "bg-gray-400"} />
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

        {/* Skeleton skeleton placeholder for recent activity */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">System Summary</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span>Pending Approvals</span>
              <span className="font-medium text-amber-600">{pending}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span>FALs Awaiting Sanction (DS)</span>
              <span className="font-medium">{falPending}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span>Bills Pending Verification</span>
              <span className="font-medium">{bills}</span>
            </div>
            <div className="flex justify-between py-2">
              <span>Overdue Approvals</span>
              <span className={`font-medium ${data?.overdueApprovals > 0 ? "text-red-600" : "text-green-600"}`}>
                {data?.overdueApprovals ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
