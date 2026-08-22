import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import toast from "react-hot-toast"
import PWALayout from "../../components/PWALayout"
import { useAuthStore } from "../../store/auth"
import BottomNav from "../../components/BottomNav"
import { GATE_NAV, roleHome } from "./GateNav"
import { MapPin } from "lucide-react"
import { Button, Card, Dot, Field, Row, ago, inputClass } from "./ui"
import {
  fetchState, startEnrolment, runSelfTest, cancelCommand,
  fetchExams, fetchVenues, searchCandidates, saveContext,
  gatewayUrl, setGatewayUrl,
  type Candidate,
} from "../../lib/gateway"

const POLL_MS = 1500

export default function GateTerminal() {
  const { user } = useAuthStore()
  const [seat, setSeat] = useState("")
  const [passes, setPasses] = useState(3)
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<Candidate | null>(null)
  const [preferManual, setPreferManual] = useState(false)
  const [editContext, setEditContext] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [urlDraft, setUrlDraft] = useState(gatewayUrl())

  const { data, error, refetch } = useQuery({
    queryKey: ["gate-state"], queryFn: fetchState,
    refetchInterval: POLL_MS, retry: false,
  })

  const device = data?.device
  const command = data?.command
  const ctx = data?.context
  const busy = command?.state === "QUEUED" || command?.state === "RUNNING"
  const online = !!device?.online
  const boundToVenue = !!ctx?.venueId

  // Candidate lookup comes from the VMS via the gateway. If no token is
  // configured it fails, and we fall back to typing a roll number by hand
  // rather than blocking enrolment entirely.
  // Stays enabled even after a failure. An earlier version latched into manual
  // mode on the first error and disabled the query, so one cancelled request
  // (a reload is enough) permanently killed the picker until a full reload.
  const { data: candidates, error: candErr, isFetching: candLoading } = useQuery({
    queryKey: ["gate-candidates", ctx?.examId, ctx?.venueId, query],
    queryFn: () => searchCandidates(ctx!.examId, ctx?.venueId ?? "", query),
    enabled: !!ctx?.examId,
    retry: 1,
  })

  // Manual entry is either the operator's choice, or forced by the list being
  // unavailable — and it reverts on its own the moment the list works again.
  const listUnavailable = !!candErr
  const manual = preferManual || listUnavailable

  const shortlist = useMemo(() => (candidates ?? []).slice(0, 6), [candidates])
  const roll = picked?.roll ?? (manual ? query.trim() : "")

  async function onEnrol() {
    if (!roll) { toast.error("Choose a candidate first"); return }
    try {
      await startEnrolment({
        roll, name: picked?.name ?? "", seat: seat.trim(), passes,
        venueId: ctx?.venueId, venue: ctx?.venueName, city: ctx?.cityName,
      })
      toast.success("Ask the candidate to place their finger")
      setPicked(null); setQuery(""); setSeat("")
      refetch()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <>
      <PWALayout title="Gate Terminal" back={roleHome(user?.role)}>
        <div className="p-3.5 space-y-3.5">

          {/* ---------------- status strip ---------------- */}
          <Card>
            {error ? (
              <>
                <div className="flex items-center gap-2">
                  <Dot ok={false} />
                  <span className="text-sm font-semibold text-red-600">Gateway unreachable</span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 break-all">
                  No answer from {gatewayUrl()}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Dot ok={online} />
                    <span className={`text-sm font-semibold ${online ? "text-gray-900" : "text-red-600"}`}>
                      {online ? "Terminal connected" : "Terminal offline"}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-600">{device?.version}</span>
                </div>
                <div className="mt-2">
                  <Row label="Prints on sensor" value={device?.templates ?? "—"} mono />
                  <Row label="Last seen"
                       value={ago(device?.last_seen_ago)} />
                </div>
                {!online && (
                  <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                    Power the ESP32 and put it on this network — it registers itself.
                  </p>
                )}
              </>
            )}
          </Card>

          {/* ---------------- posting ---------------- */}
          {/* The venue leads; the action sits beside it. Putting the button in
              the card's title slot left it stranded on its own line above the
              venue, where it read as the heading. */}
          <Card>
            {boundToVenue && !editContext ? (
              <div className="flex items-start gap-3">
                <MapPin size={18} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0"
                        style={{ color: "var(--ux4g-color-primary-700)" }} />
                <div className="min-w-0">
                  <h2 className="ux4g-title-s-strong">{ctx?.venueName}</h2>
                  <p className="ux4g-body-s-default opacity-75">
                    {ctx?.cityName} · this gate
                  </p>
                  <p className="ux4g-body-xs-default opacity-60 mt-0.5">
                    {ctx?.examCode || ctx?.examName}
                  </p>
                </div>
                <button onClick={() => setEditContext(true)}
                  className="ml-auto shrink-0 inline-flex items-center min-h-[44px] px-3 -mr-2 rounded-lg
                             ux4g-label-l-strong active:bg-black/[0.04]"
                  style={{ color: "var(--ux4g-color-primary-700)" }}>
                  Change
                </button>
              </div>
            ) : editContext ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="ux4g-title-s-strong">Which gate is this?</h2>
                  <button onClick={() => setEditContext(false)}
                    className="inline-flex items-center min-h-[44px] px-3 -mr-2 rounded-lg
                               ux4g-label-l-strong active:bg-black/[0.04]"
                    style={{ color: "var(--ux4g-color-primary-700)" }}>
                    Done
                  </button>
                </div>
                <ContextPicker onDone={() => { setEditContext(false); refetch() }} />
              </>
            ) : (
              <>
                <p className="ux4g-body-s-default">
                  This terminal is not bound to a venue, so entries are logged
                  against the gateway's default — which may be the wrong hall.
                </p>
                <button onClick={() => setEditContext(true)}
                  className="ux4g-btn ux4g-btn-primary ux4g-btn-lg w-full mt-3">
                  Choose exam and venue
                </button>
              </>
            )}
          </Card>

          {/* ---------------- live enrolment ---------------- */}
          {busy && (
            <div className="bg-navy text-white rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-wider text-blue-200">
                {command?.cmd === "ENROLL"
                  ? `Enrolling ${command?.roll}${command?.seat ? ` · seat ${command.seat}` : ""}`
                  : command?.cmd}
              </div>
              <div className="text-lg font-semibold mt-1 leading-snug">{command?.message}</div>
              <p className="text-xs text-blue-200/90 mt-2">
                Press flat and firm, cover the whole window. A poor press is
                retried — it will not cancel the enrolment.
              </p>
              <button onClick={async () => { await cancelCommand(); refetch() }}
                className="inline-flex items-center min-h-[44px] px-3 -mx-1 mt-2 rounded-lg
                           ux4g-label-m-strong text-white/90 active:bg-white/10">Cancel</button>
            </div>
          )}

          {/* ---------------- enrol ---------------- */}
          <Card title="Add a fingerprint">
            <div className="space-y-3.5">
              {picked ? (
                <div className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl px-3.5 py-3">
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-gray-900">{picked.roll}</div>
                    <div className="text-sm text-gray-600 truncate">{picked.name || "—"}</div>
                    {picked.seat && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Seat {picked.seat}{picked.venue ? ` · ${picked.venue}` : ""}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setPicked(null)}
                    className="inline-flex items-center min-h-[44px] px-3 -mx-1 rounded-lg ux4g-label-m-strong active:bg-black/[0.04] shrink-0"
                    style={{ color: "var(--ux4g-color-primary-700)" }}>Change</button>
                </div>
              ) : (
                <Field
                  label="Candidate"
                  hint={listUnavailable
                    ? "Candidate list unavailable right now — type the roll number; it will reconnect on its own."
                    : manual
                      ? "Typing the roll number manually."
                      : "Candidates with a released admit card for this venue."}
                >
                  <input value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder={manual ? "0001234" : "Search roll or name"}
                    inputMode={manual ? "numeric" : "text"} className={inputClass} />
                  {!manual && shortlist.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                      {shortlist.map((c) => (
                        <button key={c.roll}
                          onClick={() => { setPicked(c); setQuery(""); if (c.seat) setSeat(c.seat) }}
                          className="w-full text-left px-3.5 py-2.5 active:bg-gray-50 flex items-baseline gap-2">
                          <span className="font-mono font-medium text-gray-900">{c.roll}</span>
                          <span className="text-sm text-gray-500 truncate flex-1">{c.name}</span>
                          {c.seat && (
                            <span className="font-mono text-xs text-neutral-600 shrink-0">
                              seat {c.seat}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {!manual && query && shortlist.length === 0 && !candLoading && (
                    <p className="text-xs text-neutral-600 mt-2">
                      No candidate matches.{" "}
                      <button className="text-blue-600 underline"
                        onClick={() => setPreferManual(true)}>Enter manually</button>
                    </p>
                  )}
                  {preferManual && !listUnavailable && (
                    <button className="inline-flex items-center min-h-[44px] px-3 -mx-1 rounded-lg ux4g-label-m-strong active:bg-black/[0.04] mt-1"
                      style={{ color: "var(--ux4g-color-primary-700)" }}
                      onClick={() => setPreferManual(false)}>Use the candidate list</button>
                  )}
                </Field>
              )}

              <Field label="Seat number"
                     hint={picked?.seat
                       ? "From the released admit card. Override only if the candidate was moved."
                       : "No admit card seat found — enter it manually."}>
                <input value={seat} onChange={(e) => setSeat(e.target.value)}
                  placeholder="e.g. A-14" className={inputClass} />
              </Field>

              <Field label="Positions to capture"
                     hint="Each position is stored as its own print against the same roll.">
                <select value={passes} onChange={(e) => setPasses(Number(e.target.value))}
                  className={inputClass}>
                  <option value={1}>1 — fastest, least reliable</option>
                  <option value={3}>3 — flat, left, right (recommended)</option>
                  <option value={5}>5 — adds tip and lower pad</option>
                </select>
              </Field>

              <Button onClick={onEnrol} disabled={busy || !online || !roll}>
                Start enrolment
              </Button>
            </div>
          </Card>

          {/* ---------------- diagnostics ---------------- */}
          <Card title="Diagnostics" action={
            <button onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center min-h-[44px] px-3 -mx-1 rounded-lg ux4g-label-m-strong active:bg-black/[0.04]"
              aria-expanded={showAdvanced}
              style={{ color: "var(--ux4g-color-primary-700)" }}>
              {showAdvanced ? "Hide" : "Show"}
            </button>
          }>
            <Button variant="ghost" onClick={async () => {
              try { await runSelfTest(); toast("Take everything off the sensor"); refetch() }
              catch (e: any) { toast.error(e.message) }
            }} disabled={busy || !online}>Test sensor</Button>

            {showAdvanced && data?.vms && (
              <div className="mt-3">
                <Row label="VMS logging"
                  value={data.vms.offline_mode ? "Offline mode"
                    : data.vms.logging_enabled ? "On" : "Not configured"}
                  tone={data.vms.logging_enabled ? "normal" : "warn"} />
                <Row label="Token expires in"
                  value={data.vms.token_expires_in_hours != null
                    ? `${data.vms.token_expires_in_hours}h` : "—"}
                  tone={data.vms.token_expires_in_hours != null
                    && data.vms.token_expires_in_hours <= 1 ? "bad" : "normal"} mono />
                <div className="mt-3">
                  <Field label="Gateway address">
                    <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)}
                      className={inputClass + " font-mono text-[13px]"} />
                  </Field>
                  <Button variant="ghost" className="mt-2"
                    onClick={() => { setGatewayUrl(urlDraft); toast.success("Saved"); refetch() }}>
                    Save address
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </PWALayout>
      <BottomNav items={GATE_NAV} />
    </>
  )
}

/* ---- exam + venue picker, shown only while setting the posting ---- */
function ContextPicker({ onDone }: { onDone: () => void }) {
  const [examId, setExamId] = useState("")

  const { data: exams, error: examErr } = useQuery({
    queryKey: ["gate-exams"], queryFn: fetchExams, retry: false,
  })
  const { data: venues } = useQuery({
    queryKey: ["gate-venues", examId], queryFn: () => fetchVenues(examId),
    enabled: !!examId, retry: false,
  })

  if (examErr) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
        Cannot read the exam list — the gateway has no valid VMS token. Set
        <span className="font-mono"> VMS_JWT</span> in the gateway's .env, or
        leave the terminal on its default venue.
      </p>
    )
  }

  const exam = (exams ?? []).find((e) => e.id === examId)

  return (
    <div className="space-y-3">
      <Field label="Exam">
        <select value={examId} onChange={(e) => setExamId(e.target.value)} className={inputClass}>
          <option value="">— choose —</option>
          {(exams ?? []).map((e) => (
            <option key={e.id} value={e.id}>{e.examCode} · {e.name}</option>
          ))}
        </select>
      </Field>

      {examId && (
        <Field label="Venue" hint={venues?.length ? undefined : "No venues assigned to this exam yet."}>
          <div className="space-y-2">
            {(venues ?? []).map((v) => (
              <button key={v.venueId}
                onClick={async () => {
                  await saveContext({
                    examId, examName: exam?.name ?? "", examCode: exam?.examCode ?? "",
                    venueId: v.venueId, venueName: v.name, cityName: v.city,
                  })
                  toast.success(`Serving ${v.name}`)
                  onDone()
                }}
                className="w-full text-left border border-gray-200 rounded-xl px-3.5 py-3 active:bg-gray-50">
                <div className="font-medium text-gray-900">{v.name}</div>
                <div className="text-xs text-gray-500">
                  {v.city}{v.seats ? ` · ${v.seats} seats` : ""}
                </div>
              </button>
            ))}
          </div>
        </Field>
      )}
    </div>
  )
}
