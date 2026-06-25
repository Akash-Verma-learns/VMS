import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { AlertTriangle, Bell, Activity, Users } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import api from "../lib/api"
import Layout from "../components/Layout"
import StatusBadge from "../components/StatusBadge"
import LoadingSpinner from "../components/LoadingSpinner"
import toast from "react-hot-toast"
import clsx from "clsx"

interface SSEVenueStatus { venueId: string; venueName: string; city: string; lastCheckpoint: string; checkpointTime: string; alert?: string }

export default function Cockpit() {
  const [examId, setExamId] = useState("")
  const [alerts, setAlerts] = useState<{ id: string; text: string; ts: string }[]>([])
  const [venueStatuses, setVenueStatuses] = useState<SSEVenueStatus[]>([])
  const [sseConnected, setSseConnected] = useState(false)
  const [notifyModal, setNotifyModal] = useState(false)
  const [notifyMsg, setNotifyMsg] = useState("")
  const [notifyUserId, setNotifyUserId] = useState("")
  const esRef = useRef<EventSource | null>(null)
  const token = localStorage.getItem("vms-auth") ? JSON.parse(localStorage.getItem("vms-auth")!).state?.token : null

  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get("/api/exams").then((r) => r.data) })
  const { data: workload, isLoading: wlLoading } = useQuery({
    queryKey: ["workload"],
    queryFn: () => api.get("/api/cockpit/team-workload").then((r) => r.data),
    refetchInterval: 15000,
  })
  const { data: pwbdData } = useQuery({
    queryKey: ["pwbd", examId],
    queryFn: () => api.get(`/api/reports/pwbd/${examId}`).then((r) => r.data),
    enabled: !!examId,
  })
  const { data: jammerData } = useQuery({
    queryKey: ["jammer", examId],
    queryFn: () => api.get(`/api/reports/jammer-status/${examId}`).then((r) => r.data),
    enabled: !!examId,
  })
  const notifyMut = useMutation({
    mutationFn: () => api.post("/api/cockpit/notify", { targetUserId: notifyUserId, message: notifyMsg, examId }),
    onSuccess: () => { toast.success("Notification sent"); setNotifyModal(false); setNotifyMsg(""); setNotifyUserId("") },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to send"),
  })

  useEffect(() => {
    if (!examId) { if (esRef.current) { esRef.current.close(); setSseConnected(false); setVenueStatuses([]) }; return }
    const es = new EventSource(`http://localhost:3001/api/cockpit/stream/${examId}?token=${token}`)
    esRef.current = es
    es.onopen = () => setSseConnected(true)
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === "heartbeat") return
        if (msg.type === "status") setVenueStatuses(msg.venues ?? [])
        if (msg.alert) setAlerts((prev) => [{ id: crypto.randomUUID(), text: msg.alert, ts: new Date().toISOString() }, ...prev.slice(0, 19)])
      } catch {}
    }
    es.onerror = () => setSseConnected(false)
    return () => { es.close(); setSseConnected(false) }
  }, [examId])

  const teamRows: any[] = workload?.pendingApprovalsByRole ?? []
  const overdueAlerts = alerts.filter((a) => a.text.toLowerCase().includes("overdue"))

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Exam War Room</h1>
            <span className={clsx("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", sseConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
              <span className={clsx("w-1.5 h-1.5 rounded-full", sseConnected ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
              {sseConnected ? "Live" : "Offline"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <select value={examId} onChange={(e) => setExamId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm max-w-xs">
              <option value="">— Select exam to monitor —</option>
              {(exams ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button onClick={() => setNotifyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg text-sm hover:bg-navy-light">
              <Bell size={14} /> Notify
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Main area */}
          <div className="col-span-8 space-y-4">
            {/* Live venue feed */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <Activity size={16} className="text-navy" />
                <h2 className="font-semibold text-sm">Live Venue Status</h2>
                {!examId && <span className="text-xs text-gray-400 ml-2">Select exam to monitor</span>}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {venueStatuses.length === 0 && !examId
                  ? <p className="text-gray-400 text-sm py-8 text-center">Select an exam above to start live monitoring.</p>
                  : venueStatuses.length === 0
                  ? <p className="text-gray-400 text-sm py-8 text-center">Waiting for venue updates…</p>
                  : venueStatuses.map((v) => (
                    <div key={v.venueId} className={clsx("flex items-center justify-between px-5 py-3 border-b border-gray-50 hover:bg-gray-50",
                      v.alert && "bg-red-50/30")}>
                      <div>
                        <p className="text-sm font-medium">{v.venueName}</p>
                        <p className="text-xs text-gray-400">{v.city}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={v.lastCheckpoint} />
                        <p className="text-xs text-gray-400 mt-0.5">{formatDistanceToNow(new Date(v.checkpointTime), { addSuffix: true })}</p>
                      </div>
                      {v.alert && <AlertTriangle size={14} className="text-red-500 ml-2" />}
                    </div>
                  ))}
              </div>
            </div>

            {/* PwBD Report */}
            {examId && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-sm">PwBD Candidate Status</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr>
                      {["Venue", "City", "PwBD Count", "Total Attendance", "%"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {(pwbdData?.centres ?? []).length === 0
                        ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-xs">No attendance data yet for this exam.</td></tr>
                        : (pwbdData?.centres ?? []).map((v: any) => (
                          <tr key={v.venueId} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{v.venue?.name ?? v.venueName}</td>
                            <td className="px-4 py-2 text-gray-500">{v.venue?.cityName ?? v.cityName}</td>
                            <td className="px-4 py-2">{v.pwbdCount}</td>
                            <td className="px-4 py-2">{v.totalAttendance}</td>
                            <td className="px-4 py-2">{v.totalAttendance ? ((v.pwbdCount / v.totalAttendance) * 100).toFixed(1) + "%" : "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Jammer Status */}
            {examId && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-sm">Jammer Status</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr>
                      {["Venue", "City", "Jammer ID", "Status", "Last Updated"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {(jammerData?.venues ?? []).length === 0
                        ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-xs">No jammer data for this exam.</td></tr>
                        : (jammerData?.venues ?? []).map((v: any) => (
                          <tr key={v.venueId} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{v.venue?.name ?? "—"}</td>
                            <td className="px-4 py-2 text-gray-500">{v.venue?.cityName ?? "—"}</td>
                            <td className="px-4 py-2 font-mono text-xs">{v.jammerId ?? "—"}</td>
                            <td className="px-4 py-2"><StatusBadge status={v.jammerConfirmed ? "CONFIRMED" : "PENDING"} /></td>
                            <td className="px-4 py-2 text-xs text-gray-400">{v.confirmedAt ? formatDistanceToNow(new Date(v.confirmedAt), { addSuffix: true }) : "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Team workload */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <Users size={16} className="text-navy" />
                <h2 className="font-semibold text-sm">Team Workload</h2>
              </div>
              {wlLoading ? <LoadingSpinner /> : (
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ["FALs Pending DS", workload?.pendingFALsForDS ?? 0, "text-amber-600"],
                      ["Bills for Verification", workload?.pendingBillsForVerification ?? 0, "text-blue-600"],
                      ["Overdue Approvals", workload?.overdueApprovals ?? 0, "text-red-600"],
                    ].map(([label, value, color]) => (
                      <div key={label as string} className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className={`text-2xl font-bold ${color as string}`}>{value as number}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{label as string}</div>
                      </div>
                    ))}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr>
                      {["Role", "Pending Approvals"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {teamRows.length === 0
                        ? <tr><td colSpan={2} className="px-4 py-4 text-center text-gray-400 text-xs">No pending approvals.</td></tr>
                        : teamRows.map((m: any) => (
                          <tr key={m.role} className="hover:bg-gray-50">
                            <td className="px-4 py-2"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{m.role}</span></td>
                            <td className="px-4 py-2 font-semibold text-amber-600">{m.count}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Alert sidebar */}
          <div className="col-span-4 space-y-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-fit sticky top-4">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" />
                <h2 className="font-semibold text-sm">Alerts</h2>
                {alerts.length > 0 && <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{alerts.length}</span>}
              </div>
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto divide-y divide-gray-50">
                {alerts.length === 0
                  ? <p className="px-4 py-8 text-center text-gray-400 text-xs">No alerts. System normal.</p>
                  : alerts.map((a) => (
                    <div key={a.id} className={clsx("px-4 py-3", overdueAlerts.some((x) => x.id === a.id) ? "bg-red-50/50" : "")}>
                      <p className="text-xs font-medium text-gray-800">{a.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDistanceToNow(new Date(a.ts), { addSuffix: true })}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notify Modal */}
      {notifyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-4">Send Notification</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient User ID *</label>
                <input value={notifyUserId} onChange={(e) => setNotifyUserId(e.target.value)}
                  placeholder="Paste the user's UUID…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
                <p className="text-xs text-gray-400 mt-1">Find user IDs in Prisma Studio → User table.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea value={notifyMsg} onChange={(e) => setNotifyMsg(e.target.value)} rows={4}
                  placeholder="Enter notification message…" className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setNotifyModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => notifyMut.mutate()} disabled={!notifyMsg || !notifyUserId || notifyMut.isPending}
                className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-50">
                {notifyMut.isPending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
