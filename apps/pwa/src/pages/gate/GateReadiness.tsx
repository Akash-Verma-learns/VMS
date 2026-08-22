import { useQuery } from "@tanstack/react-query"
import PWALayout from "../../components/PWALayout"
import BottomNav from "../../components/BottomNav"
import { useAuthStore } from "../../store/auth"
import { GATE_NAV, roleHome } from "./GateNav"
import { Card, Empty, GatewayDown } from "./ui"
import { AlertOctagon, AlertTriangle, Info } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { fetchGateCheck, gatewayUrl, type GateFinding } from "../../lib/gateway"

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
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
            What this breaks later
          </div>
          <p className="text-xs text-gray-700 mt-0.5">{f.consequence}</p>
        </div>

        <div className="mt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
            How to fix
          </div>
          <p className="text-xs text-gray-700 mt-0.5">{f.fix}</p>
        </div>

        {f.samples.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {f.samples.map((s) => (
              <span key={s} className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap" style={{ background: "var(--ux4g-color-neutral-100)", color: "var(--ux4g-color-neutral-700)" }}>{s}</span>
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
  const { data, error, refetch } = useQuery({
    queryKey: ["gate-check"], queryFn: fetchGateCheck,
    refetchInterval: 5000, retry: false,
  })

  const i = data?.inspected

  return (
    <>
      <PWALayout title="Gate Readiness" back={roleHome(user?.role)}>
        <div className="p-3.5 space-y-3.5">
          {error && (
            <GatewayDown url={gatewayUrl()} onRetry={() => refetch()} />
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

              {/* Three big numbers said nothing on their own — the gap between
                  them is the finding. It reads as a sentence, with the shortfall
                  called out because that is the number someone has to act on. */}
              <Card title="Enrolment coverage">
                {(() => {
                  const expected = i?.expectedCandidates ?? 0
                  const enrolled = i?.enrolledPrints ?? 0
                  const onSensor = i?.printsOnSensor
                  const missing = Math.max(0, expected - enrolled)
                  return (
                    <>
                      <p className="ux4g-label-l-strong">
                        {enrolled} of {expected} candidates enrolled
                      </p>
                      {missing > 0 ? (
                        <p className="ux4g-label-m-default mt-0.5"
                           style={{ color: "var(--ux4g-color-orange-800)" }}>
                          {missing} still to enrol before exam day
                        </p>
                      ) : (
                        <p className="ux4g-label-m-default mt-0.5"
                           style={{ color: "var(--ux4g-color-green-800)" }}>
                          Everyone expected at this venue can be matched
                        </p>
                      )}
                      {onSensor !== null && onSensor !== undefined && onSensor !== enrolled && (
                        <p className="ux4g-label-s-default mt-2 opacity-75">
                          The sensor holds {onSensor} print{onSensor === 1 ? "" : "s"}, so{" "}
                          {Math.abs(onSensor - enrolled)} {onSensor > enrolled ? "is unmapped" : "is missing from the sensor"}.
                        </p>
                      )}
                    </>
                  )
                })()}
                {!data.vmsReachable && (
                  <p className="ux4g-alert ux4g-alert-warning mt-3 text-xs">
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
