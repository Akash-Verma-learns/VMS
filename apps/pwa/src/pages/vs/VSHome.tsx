import { useQuery } from "@tanstack/react-query"
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
  const { data: surveys } = useQuery({ queryKey: ["my-surveys"], queryFn: () => api.get("/api/surveys/my").then((r) => r.data) })

  const pendingSurveys = (surveys ?? []).filter((s: any) => !s.responses?.length).length

  const tasks: Task[] = [
    { label: "Venue readiness checklist", done: false, route: "/vs/readiness", mandatory: true },
    { label: "Material tracking (scan QR / PIN)", done: false, route: "/vs/material" },
    { label: `${pendingSurveys} survey(s) need response`, done: pendingSurveys === 0, route: "/vs/survey" },
  ]

  return (
    <>
      <PWALayout title="VS Dashboard">
        <div className="p-4 space-y-4">
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

        </div>
      </PWALayout>
      <BottomNav items={VS_NAV} />
    </>
  )
}
