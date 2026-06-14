import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import api from "../../lib/api"
import Layout from "../../components/Layout"
import StatusBadge from "../../components/StatusBadge"
import LoadingSpinner from "../../components/LoadingSpinner"
import ErrorMessage from "../../components/ErrorMessage"
import { ClipboardList, Package, CheckSquare, ArrowRight } from "lucide-react"

interface Task { id: string; label: string; done: boolean; route?: string }

export default function VSDashboard() {
  const navigate = useNavigate()

  const { data: matData, isLoading: mLoading, error: mError, refetch: mRefetch } = useQuery({
    queryKey: ["vs-material"],
    queryFn: () => api.get("/api/material/my").then((r) => r.data),
  })
  const { data: readiness } = useQuery({
    queryKey: ["vs-readiness"],
    queryFn: () => api.get("/api/readiness/my").then((r) => r.data),
  })
  const { data: surveys } = useQuery({
    queryKey: ["my-surveys"],
    queryFn: () => api.get("/api/surveys/my").then((r) => r.data),
  })
  const { data: checkpoints } = useQuery({
    queryKey: ["vs-checkpoints"],
    queryFn: () => api.get("/api/field/my-checkpoints").then((r) => r.data),
  })

  const material = matData?.material
  const pendingSurveys = (surveys ?? []).filter((s: any) => !s.responses?.length)
  const readinessItems: any[] = readiness?.items ?? []
  const mandatoryPending = readinessItems.filter((i) => i.mandatory && !i.completed).length

  const tasks: Task[] = [
    { id: "readiness", label: `Readiness checklist (${mandatoryPending} mandatory items pending)`, done: mandatoryPending === 0, route: "/vs/readiness" },
    { id: "material", label: `Material tracking — ${material?.status ?? "PENDING"}`, done: material?.status === "RECEIVED", route: "/vs/material" },
    { id: "survey", label: `${pendingSurveys.length} survey(s) pending response`, done: pendingSurveys.length === 0, route: "/vs/surveys" },
  ]

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <h1 className="text-xl font-bold text-gray-900">Venue Superintendent Dashboard</h1>

        {/* Material status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package size={16} className="text-navy" />
            <h2 className="font-semibold text-sm">Material Status</h2>
          </div>
          {mLoading ? <LoadingSpinner /> : mError ? <ErrorMessage message="Failed to load material" onRetry={mRefetch} /> : (
            material ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center"><div className="text-lg font-bold">{material.omrCount}</div><div className="text-xs text-gray-500">OMR Sheets</div></div>
                <div className="text-center"><div className="text-lg font-bold">{material.salCount}</div><div className="text-xs text-gray-500">SAL Sets</div></div>
                <div className="text-center"><div className="text-lg font-bold">{material.stationeryCount}</div><div className="text-xs text-gray-500">Stationery</div></div>
                <div className="col-span-3 flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
                  <span className="text-sm text-gray-500">Status</span>
                  <StatusBadge status={material.status} />
                </div>
              </div>
            ) : <p className="text-gray-400 text-sm py-4 text-center">No material assignment yet.</p>
          )}
        </div>

        {/* Task list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare size={16} className="text-navy" />
            <h2 className="font-semibold text-sm">Action Items</h2>
          </div>
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => t.route && navigate(t.route)}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${t.done ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
                  {t.done && <span className="text-white text-xs">✓</span>}
                </div>
                <span className={`text-sm flex-1 ${t.done ? "line-through text-gray-400" : "text-gray-700"}`}>{t.label}</span>
                {!t.done && t.route && <ArrowRight size={14} className="text-gray-400" />}
              </div>
            ))}
          </div>
        </div>

        {/* Recent checkpoints */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={16} className="text-navy" />
            <h2 className="font-semibold text-sm">Recent Checkpoints</h2>
          </div>
          {(checkpoints?.submissions ?? []).length === 0
            ? <p className="text-gray-400 text-sm py-4 text-center">No checkpoints submitted yet.</p>
            : <div className="space-y-2">
              {(checkpoints?.submissions ?? []).slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{c.type?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(c.submittedAt), { addSuffix: true })}</p>
                  </div>
                  <StatusBadge status={c.status ?? "SUBMITTED"} />
                </div>
              ))}
            </div>}
        </div>
      </div>
    </Layout>
  )
}
