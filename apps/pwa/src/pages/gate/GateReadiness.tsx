import { useQuery } from "@tanstack/react-query"
import PWALayout from "../../components/PWALayout"
import BottomNav from "../../components/BottomNav"
import { useAuthStore } from "../../store/auth"
import { GATE_NAV, roleHome } from "./GateNav"
import { Card, Empty } from "./ui"
import { AlertOctagon, AlertTriangle, Info } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { fetchGateCheck, type GateFinding } from "../../lib/gateway"

// Pre-flight for the gate. Everything here is invisible to the VMS, because
// fingerprints live on the sensor and the roll mapping lives on the gateway.

const TONE: Record<string, { fg: string; bg: string; icon: LucideIcon; label: string }> = {
  BLOCKER: { fg: "var(--ux4g-color-red-800)",     bg: "var(--ux4g-color-red-50)",     icon: AlertOctagon,  label: "Blocker" },
  WARNING: { fg: "var(--ux4g-color-orange-800)",  bg: "var(--ux4g-color-orange-50)",  icon: AlertTriangle, label: "Warning" },
  INFO:    { fg: "var(--ux4g-color-primary-800)", bg: "var(--ux4g-color-primary-50)", icon: Info,          label: "For information" },
}

function FindingCard({ f }: { f: GateFinding }) {
  const tone = TONE[f.severity] ?? TONE.INFO
  const Icon = tone.icon
  return (
    <Card>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: tone.bg, color: tone.fg }}>
            <Icon size={17} strokeWidth={2.25} aria-hidden />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="ux4g-label-m-strong">{f.title}</h3>
            <p className="ux4g-label-s-default" style={{ color: tone.fg }}>{tone.label}</p>
          </div>
        </div>
        <p className="ux4g-label-s-default opacity-75 mt-2">{f.detail}</p>

        <div className="mt-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            What this breaks later
          </div>
          <p className="text-xs text-gray-700 mt-0.5">{f.consequence}</p>
        </div>

        <div className="mt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            How to fix
          </div>
          <p className="text-xs text-gray-700 mt-0.5">{f.fix}</p>
        </div>

        {f.samples.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {f.samples.map((s) => (
              <span key={s} className="ux4g-badge font-mono">{s}</span>
            ))}
            {f.count > f.samples.length && (
              <span className="ux4g-label-s-default self-center opacity-60">
                +{f.count - f.samples.length} more
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

export default function GateReadiness() {
  const { user } = useAuthStore()
  const { data, error } = useQuery({
    queryKey: ["gate-check"], queryFn: fetchGateCheck,
    refetchInterval: 5000, retry: false,
  })

  const i = data?.inspected

  return (
    <>
      <PWALayout title="Gate Readiness" back={roleHome(user?.role)}>
        <div className="p-3.5 space-y-3.5">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 rounded-xl px-3.5 py-3">
              Gateway unreachable — check the Terminal tab.
            </p>
          )}

          {data && (
            <>
              <div className={`rounded-2xl px-4 py-3.5 border ${
                data.ok
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"}`}>
                <div className={`text-lg font-bold ${data.ok ? "text-green-700" : "text-red-700"}`}>
                  {data.ok ? "Ready for exam day" : `${data.blockers} blocker${data.blockers > 1 ? "s" : ""}`}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {data.warnings} warning{data.warnings === 1 ? "" : "s"}
                  {i?.venue ? ` · ${i.venue}` : ""}
                </div>
              </div>

              <Card title="Inspected">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xl font-bold text-gray-900">{i?.expectedCandidates ?? "—"}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">expected</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">{i?.enrolledPrints ?? "—"}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">enrolled</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">{i?.printsOnSensor ?? "—"}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">on sensor</div>
                  </div>
                </div>
                {!data.vmsReachable && (
                  <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-3">
                    Candidate list unavailable, so roll-level checks were skipped.
                    Bind the terminal to a venue and confirm the VMS token.
                  </p>
                )}
              </Card>

              {data.findings.length === 0
                ? <Empty>Nothing to fix. Every enrolled print maps to a candidate expected at this venue.</Empty>
                : data.findings.map((f) => <FindingCard key={f.id} f={f} />)}
            </>
          )}
        </div>
      </PWALayout>
      <BottomNav items={GATE_NAV} />
    </>
  )
}
