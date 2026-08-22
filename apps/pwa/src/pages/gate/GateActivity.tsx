import { useQuery } from "@tanstack/react-query"
import PWALayout from "../../components/PWALayout"
import { useAuthStore } from "../../store/auth"
import BottomNav from "../../components/BottomNav"
import { GATE_TABS, navFor } from "./GateNav"
import SectionTabs from "../../components/SectionTabs"
import { Empty, GatewayDown } from "./ui"
import { fetchState, gatewayUrl } from "../../lib/gateway"

const TAG: Record<string, { bg: string; label: string }> = {
  allow:  { bg: "bg-green-100 text-green-800",  label: "ADMITTED" },
  deny:   { bg: "bg-red-100 text-red-700",      label: "REFUSED" },
  flag:   { bg: "bg-orange-100 text-orange-800",label: "FLAGGED" },
  enrol:  { bg: "bg-blue-100 text-blue-800",    label: "ENROL" },
  device: { bg: "bg-amber-100 text-amber-800",  label: "DEVICE" },
  vms:    { bg: "bg-amber-100 text-amber-800",  label: "VMS" },
  error:  { bg: "bg-red-100 text-red-700",      label: "ERROR" },
}

export default function GateActivity() {
  const { user } = useAuthStore()
  const { data, error, refetch } = useQuery({
    queryKey: ["gate-state"],
    queryFn: fetchState,
    refetchInterval: 1500,
    retry: false,
  })

  const events = data?.activity ?? []
  const ctx = data?.context
  const admitted = events.filter((e) => e.kind === "allow").length
  const refused = events.filter((e) => e.kind === "deny" || e.kind === "flag").length

  return (
    <>
      <PWALayout title="Gate Activity">
        <SectionTabs items={GATE_TABS} />
        <div className="p-3.5 space-y-3.5">
          {ctx?.venueName && (
            <p className="text-xs text-gray-500 px-1">
              {ctx.venueName}{ctx.cityName ? ` · ${ctx.cityName}` : ""}
              {ctx.examCode ? ` · ${ctx.examCode}` : ""}
            </p>
          )}
          {error && (
            <GatewayDown url={gatewayUrl()} onRetry={() => refetch()} />
          )}

          <div className="flex gap-3">
            <div className="flex-1 ux4g-card ux4g-card-solid px-4 py-3">
              <div className="text-3xl font-bold text-green-600 tabular-nums">{admitted}</div>
              <div className="text-xs text-gray-500 mt-0.5">Admitted</div>
            </div>
            <div className="flex-1 ux4g-card ux4g-card-solid px-4 py-3">
              <div className="text-3xl font-bold text-red-600 tabular-nums">{refused}</div>
              <div className="text-xs text-gray-500 mt-0.5">Refused / flagged</div>
            </div>
          </div>

          {events.length === 0 ? (
            <Empty>No scans yet. Place an enrolled finger on the terminal.</Empty>
          ) : (
            <div className="ux4g-card ux4g-card-solid divide-y divide-gray-100 overflow-hidden">
              {events.map((e, i) => {
                const tag = TAG[e.kind] ?? { bg: "bg-gray-100 text-gray-700", label: e.kind.toUpperCase() }
                return (
                  <div key={i} className="flex gap-3 px-4 py-2.5 items-start">
                    <span className="font-mono text-xs text-neutral-600 pt-0.5 shrink-0">{e.at}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${tag.bg}`}>
                      {tag.label}
                    </span>
                    <span className="text-sm text-gray-700 flex-1">{e.text}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </PWALayout>
      <BottomNav items={navFor(user?.role)} />
    </>
  )
}
