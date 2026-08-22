import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import api from "../../lib/api"
import PWALayout from "../../components/PWALayout"
import BottomNav from "../../components/BottomNav"
import clsx from "clsx"
import { ClipboardList, Search, Fingerprint } from "lucide-react"

const IO_NAV = [
  { label: "Assignments", icon: ClipboardList, path: "/io/home" },
  { label: "Inspect", icon: Search, path: "/io/inspect" },
  { label: "Gate", icon: Fingerprint, path: "/gate/terminal" },
]

export default function IOHome() {
  const navigate = useNavigate()
  const { data: inspections, isLoading } = useQuery({
    queryKey: ["io-inspections"],
    queryFn: () => api.get("/api/inspections/my").then((r) => r.data),
  })

  const list: any[] = inspections ?? []
  const pending = list.filter((i) => i.status !== "SUBMITTED")
  const done = list.filter((i) => i.status === "SUBMITTED")

  return (
    <>
      <PWALayout title="IO Assignments">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 text-center">
              <div className="text-2xl font-bold text-navy">{pending.length}</div>
              <div className="text-xs text-gray-500">Pending</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{done.length}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
          </div>

          {isLoading && <p className="text-center text-gray-400 text-sm py-8">Loading assignments…</p>}

          {!isLoading && list.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Search size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No inspection assignments yet.</p>
            </div>
          )}

          {list.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">All Assignments</h2>
              {list.map((insp: any) => (
                <div key={insp.id} className={clsx("bg-white rounded-xl border shadow-sm p-4",
                  insp.status === "SUBMITTED" ? "border-green-200" : "border-gray-200")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm text-navy">{insp.venue?.name}</p>
                      <p className="text-xs text-gray-400">{insp.venue?.cityName}</p>
                      {insp.scheduledFor && <p className="text-xs text-gray-500 mt-1">Scheduled: {format(new Date(insp.scheduledFor), "dd MMM yyyy")}</p>}
                    </div>
                    <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium",
                      insp.status === "SUBMITTED" ? "bg-green-100 text-green-700"
                      : insp.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600")}>
                      {insp.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                  {insp.status !== "SUBMITTED" && (
                    <button onClick={() => navigate("/io/inspect", { state: { inspectionId: insp.id } })}
                      className="mt-3 w-full py-2 bg-navy text-white rounded-lg text-sm font-medium">
                      {insp.status === "IN_PROGRESS" ? "Continue Inspection" : "Start Inspection"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PWALayout>
      <BottomNav items={IO_NAV} />
    </>
  )
}
