import { useQuery } from "@tanstack/react-query"
import api from "../../lib/api"
import PWALayout from "../../components/PWALayout"
import BottomNav from "../../components/BottomNav"
import TaskList from "../../components/TaskList"
import { Home, ClipboardCheck, ClipboardList, Package, FileText, Fingerprint } from "lucide-react"

const VS_NAV = [
  { label: "Home", icon: Home, path: "/vs/home" },
  { label: "Readiness", icon: ClipboardCheck, path: "/vs/readiness" },
  { label: "Exam Day", icon: ClipboardList, path: "/vs/exam-day" },
  { label: "Material", icon: Package, path: "/vs/material" },
  { label: "Survey", icon: FileText, path: "/vs/survey" },
  { label: "Gate", icon: Fingerprint, path: "/gate/terminal" },
]

interface Task { label: string; done: boolean; route: string; mandatory?: boolean }

export default function VSHome() {
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
          <TaskList title="Action items" tasks={tasks} />

        </div>
      </PWALayout>
      <BottomNav items={VS_NAV} />
    </>
  )
}
