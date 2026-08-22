import { useQuery } from "@tanstack/react-query"
import api from "../../lib/api"
import PWALayout from "../../components/PWALayout"
import { useAuthStore } from "../../store/auth"
import BottomNav from "../../components/BottomNav"
import { navFor } from "../gate/GateNav"
import TaskList from "../../components/TaskList"



interface Task { label: string; done: boolean; route: string; mandatory?: boolean }

export default function VSHome() {
  const { user } = useAuthStore()
  const { data: surveys } = useQuery({ queryKey: ["my-surveys"], queryFn: () => api.get("/api/surveys/my").then((r) => r.data) })

  const pendingSurveys = (surveys ?? []).filter((s: any) => !s.responses?.length).length

  // Every VS screen is reachable from here. The exam-day report used to live
  // only on the bottom bar; when that shrank to three tabs it became
  // unreachable, which is the risk of navigation that is not hub-and-spoke.
  const tasks: Task[] = [
    { label: "Venue readiness", done: false, route: "/vs/readiness", mandatory: true },
    { label: "Material tracking", done: false, route: "/vs/material" },
    { label: "Exam-day report", done: false, route: "/vs/exam-day", mandatory: true },
    {
      label: pendingSurveys === 0
        ? "Surveys"
        : `${pendingSurveys} survey${pendingSurveys === 1 ? "" : "s"} to answer`,
      done: pendingSurveys === 0,
      route: "/vs/survey",
    },
  ]

  return (
    <>
      <PWALayout title="VS Dashboard">
        <div className="p-4 space-y-4">
          <TaskList title="Action items" tasks={tasks} />

        </div>
      </PWALayout>
      <BottomNav items={navFor(user?.role)} />
    </>
  )
}
