import { useQuery } from "@tanstack/react-query"
import PWALayout from "../../components/PWALayout"
import BottomNav from "../../components/BottomNav"
import { useAuthStore } from "../../store/auth"
import { GATE_NAV, roleHome } from "./GateNav"
import { Card, Empty } from "./ui"
import { fetchGateCheck, type GateFinding } from "../../lib/gateway"

// Pre-flight for the gate. Everything here is invisible to the VMS, because
// fingerprints live on the sensor and the roll mapping lives on the gateway.

const TONE: Record<string, { chip: string; bar: string }> = {
  BLOCKER: { chip: "bg-red-100 text-red-700",     bar: "bg-red-500" },
  WARNING: { chip: "bg-amber-100 text-amber-800", bar: "bg-amber-500" },
  INFO:    { chip: "bg-blue-100 text-blue-800",   bar: "bg-blue-500" },
}

function FindingCard({ f }: { f: GateFinding }) {
  const tone = TONE[f.severity] ?? TONE.INFO
  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden flex">
      <div className={`w-1 shrink-0 ${tone.bar}`} />
      <div className="flex-1 min-w-0 p-4">
        <div className="flex items-start gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${tone.chip}`}>
            {f.severity}
          </span>
          <h3 className="text-sm font-semibold text-gray-900 flex-1">{f.title}</h3>
        </div>
        <p className="text-xs text-gray-600 mt-1.5">{f.detail}</p>

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
              <span key={s} className="font-mono text-[11px] bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">
                {s}
              </span>
            ))}
            {f.count > f.samples.length && (
              <span className="text-[11px] text-gray-400 self-center">
                +{f.count - f.samples.length} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
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
