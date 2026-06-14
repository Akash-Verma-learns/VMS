import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import api from "../../lib/api"
import PWALayout from "../../components/PWALayout"
import BottomNav from "../../components/BottomNav"
import { useNavigate } from "react-router-dom"
import clsx from "clsx"

const VS_NAV = [
  { label: "Home", icon: "🏠", path: "/vs/home" },
  { label: "Readiness", icon: "✅", path: "/vs/readiness" },
  { label: "Exam Day", icon: "📋", path: "/vs/exam-day" },
  { label: "Material", icon: "📦", path: "/vs/material" },
  { label: "Survey", icon: "📝", path: "/vs/survey" },
]

interface Task { label: string; done: boolean; route: string; mandatory?: boolean }

export default function VSHome() {
  const navigate = useNavigate()
  const { data: material } = useQuery({ queryKey: ["vs-material"], queryFn: () => api.get("/api/material/my").then((r) => r.data) })
  const { data: readiness } = useQuery({ queryKey: ["vs-readiness"], queryFn: () => api.get("/api/readiness/my").then((r) => r.data) })
  const { data: surveys } = useQuery({ queryKey: ["my-surveys"], queryFn: () => api.get("/api/surveys/my").then((r) => r.data) })
  const { data: checkpoints } = useQuery({ queryKey: ["vs-checkpoints"], queryFn: () => api.get("/api/field/my-checkpoints").then((r) => r.data) })

  const mat = material?.material
  const mandatoryPending = (readiness?.items ?? []).filter((i: any) => i.mandatory && !i.completed).length
  const pendingSurveys = (surveys ?? []).filter((s: any) => !s.responses?.length).length

  const tasks: Task[] = [
    { label: `Venue readiness checklist (${mandatoryPending} items remaining)`, done: mandatoryPending === 0, route: "/vs/readiness", mandatory: true },
    { label: `Material: ${mat?.status ?? "awaiting assignment"}`, done: mat?.status === "RECEIVED", route: "/vs/material" },
    { label: `${pendingSurveys} survey(s) need response`, done: pendingSurveys === 0, route: "/vs/survey" },
  ]

  const lastCp = (checkpoints?.submissions ?? [])[0]

  return (
    <>
      <PWALayout title="VS Dashboard">
        <div className="p-4 space-y-4">
          {/* Material card */}
          <div className={clsx("rounded-xl p-4 border", mat?.status === "RECEIVED" ? "bg-green-50 border-green-200" : "bg-white border-gray-200 shadow-sm")}>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">📦 Material Status</h2>
            {mat ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-bold text-navy">{mat.omrCount}</div><div className="text-xs text-gray-500">OMR</div></div>
                <div><div className="text-lg font-bold text-navy">{mat.salCount}</div><div className="text-xs text-gray-500">SAL</div></div>
                <div><div className="text-lg font-bold text-navy">{mat.stationeryCount}</div><div className="text-xs text-gray-500">Stationery</div></div>
                <div className="col-span-3 text-xs font-medium mt-1" style={{ color: mat.status === "RECEIVED" ? "#16a34a" : "#d97706" }}>
                  {mat.status?.replace(/_/g, " ")}
                </div>
              </div>
            ) : <p className="text-sm text-gray-400">No material assigned yet.</p>}
          </div>

          {/* Task list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">Action Items</div>
            {tasks.map((t) => (
              <button key={t.label} onClick={() => navigate(t.route)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 last:border-0 text-left">
                <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                  t.done ? "bg-green-500 border-green-500" : t.mandatory ? "border-red-400" : "border-gray-300")}>
                  {t.done && <span className="text-white text-xs">✓</span>}
                </div>
                <span className={clsx("text-sm flex-1", t.done ? "line-through text-gray-400" : "text-gray-700")}>{t.label}</span>
                {!t.done && <span className="text-gray-300">›</span>}
              </button>
            ))}
          </div>

          {/* Last checkpoint */}
          {lastCp && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Last Checkpoint</h2>
              <p className="text-sm font-medium text-navy">{lastCp.type?.replace(/_/g, " ")}</p>
              <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(lastCp.submittedAt), { addSuffix: true })}</p>
            </div>
          )}
        </div>
      </PWALayout>
      <BottomNav items={VS_NAV} />
    </>
  )
}
