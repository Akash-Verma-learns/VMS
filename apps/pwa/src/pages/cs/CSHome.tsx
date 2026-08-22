import { useQuery } from "@tanstack/react-query"
import api from "../../lib/api"
import PWALayout from "../../components/PWALayout"
import BottomNav from "../../components/BottomNav"
import clsx from "clsx"
import { LayoutDashboard, Building2, FileText, Wallet, ClipboardList, Fingerprint } from "lucide-react"

const CS_NAV = [
  { label: "Overview", icon: LayoutDashboard, path: "/cs/home" },
  { label: "Venues", icon: Building2, path: "/cs/venues" },
  { label: "Surveys", icon: FileText, path: "/cs/surveys" },
  { label: "Bills", icon: Wallet, path: "/cs/bills" },
  { label: "Gate", icon: Fingerprint, path: "/gate/terminal" },
]

export default function CSHome() {
  const { data: venues } = useQuery({ queryKey: ["cs-venues"], queryFn: () => api.get("/api/venues").then((r) => r.data) })
  const { data: surveys } = useQuery({ queryKey: ["my-surveys"], queryFn: () => api.get("/api/surveys/my").then((r) => r.data) })

  const venueList: any[] = venues ?? []
  const pendingSurveys = (surveys ?? []).filter((s: any) => !s.responses?.length)
  const readyCount = venueList.filter((v) => v.status === "APPROVED").length

  const actions = [
    ...(pendingSurveys.length > 0 ? [{ text: `${pendingSurveys.length} survey(s) pending response`, color: "border-red-200 bg-red-50", icon: ClipboardList }] : []),
  ]

  return (
    <>
      <PWALayout title="CS Overview">
        <div className="p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[["Venues", venueList.length, "text-navy"], ["Ready", readyCount, "text-green-600"], ["Pending", venueList.length - readyCount, "text-amber-600"]].map(([l, v, c]) => (
              <div key={l as string} className="ux4g-card ux4g-card-solid p-3 text-center">
                <div className={`text-2xl font-bold ${c}`}>{v as number}</div>
                <div className="text-xs text-gray-500">{l as string}</div>
              </div>
            ))}
          </div>

          {/* Action required */}
          {actions.length > 0 && (
            <div className="space-y-2">
              <h2 className="ux4g-title-s-strong">Action Required</h2>
              {actions.map((a, i) => (
                <div key={i} className={clsx("rounded-xl border p-3 flex items-center gap-2 text-sm", a.color)}>
                  <a.icon size={16} />
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* VS Readiness Status */}
          <div className="ux4g-card ux4g-card-solid">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">VS Readiness Status</div>
            <div className="divide-y divide-gray-50">
              {venueList.length === 0
                ? <p className="px-4 py-6 text-center text-xs text-neutral-600">No venues assigned.</p>
                : venueList.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{v.name}</p>
                      <p className="text-xs text-neutral-600">{v.vs?.name ?? "No VS assigned"}</p>
                    </div>
                    <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full",
                      v.readinessStatus === "SUBMITTED" ? "bg-green-100 text-green-700"
                      : v.readinessStatus === "INCOMPLETE" ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-500")}>
                      {v.readinessStatus ?? "Pending"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </PWALayout>
      <BottomNav items={CS_NAV} />
    </>
  )
}
