import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import api from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import StatusBadge from "../components/StatusBadge"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import toast from "react-hot-toast"

export default function Inspections() {
  const { user } = useAuthStore()
  const role = user?.role ?? ""
  const qc = useQueryClient()
  const [examId, setExamId] = useState("")
  const [assign, setAssign] = useState<any>(null)
  const [view, setView] = useState<any>(null)
  const [assignForm, setAssignForm] = useState({ ioId: "", scheduledFor: "", isExamDay: false })

  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get("/api/exams").then((r) => r.data) })
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["inspections", examId],
    queryFn: () => api.get(`/api/inspections/${examId}`).then((r) => r.data),
    enabled: !!examId,
  })

  const assignMut = useMutation({
    mutationFn: () => api.post("/api/inspections", { examId, venueId: assign?.venueId, ioId: assignForm.ioId, scheduledFor: assignForm.scheduledFor || undefined, isExamDay: assignForm.isExamDay }),
    onSuccess: () => { toast.success("Inspection assigned"); setAssign(null); qc.invalidateQueries({ queryKey: ["inspections"] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  })

  const flagMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/inspections/${id}/review`, { requiresRemediation: true }),
    onSuccess: () => { toast.success("Flagged for remediation"); qc.invalidateQueries({ queryKey: ["inspections"] }) },
  })

  const inspections: any[] = data ?? []
  const summary = {
    assigned: inspections.filter((i) => i.status === "ASSIGNED").length,
    inProgress: inspections.filter((i) => i.status === "IN_PROGRESS").length,
    submitted: inspections.filter((i) => i.status === "SUBMITTED").length,
    remediation: inspections.filter((i) => i.status === "REMEDIATION_REQUIRED" || i.requiresRemediation).length,
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Inspections</h1>

        <div className="flex gap-4 items-center">
          <label className="text-sm font-medium text-gray-700 shrink-0">Exam:</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm max-w-xs">
            <option value="">— Select exam —</option>
            {(exams ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        {examId && !isLoading && (
          <div className="grid grid-cols-4 gap-3">
            {[["Assigned", summary.assigned, "bg-gray-100 text-gray-700"], ["In Progress", summary.inProgress, "bg-blue-50 text-blue-700"],
              ["Submitted", summary.submitted, "bg-green-50 text-green-700"], ["Remediation", summary.remediation, "bg-red-50 text-red-700"]].map(([l, v, c]) => (
              <div key={l as string} className={`rounded-xl p-4 text-center ${c}`}>
                <div className="text-2xl font-bold">{v as number}</div>
                <div className="text-xs mt-0.5">{l as string}</div>
              </div>
            ))}
          </div>
        )}

        {!examId && <p className="text-gray-400 text-sm py-8 text-center">Select an exam to view inspections.</p>}
        {isLoading && <LoadingSpinner />}
        {error && <ErrorMessage message="Failed to load inspections" onRetry={refetch} />}

        {examId && !isLoading && !error && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{["Venue", "City", "IO Assigned", "Scheduled", "Exam Day", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {inspections.length === 0
                    ? <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No inspections for this exam. Assign IO to venues to begin.</td></tr>
                    : inspections.map((i: any) => (
                      <tr key={i.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{i.venue?.name ?? "—"}</td>
                        <td className="px-4 py-3">{i.venue?.cityName ?? "—"}</td>
                        <td className="px-4 py-3">{i.io?.name ?? <span className="text-red-400">Unassigned</span>}</td>
                        <td className="px-4 py-3 text-gray-500">{i.scheduledFor ? format(new Date(i.scheduledFor), "dd MMM") : "—"}</td>
                        <td className="px-4 py-3">{i.isExamDay ? "✓" : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {["SO", "US"].includes(role) && !i.ioId && (
                              <button onClick={() => { setAssign({ venueId: i.venueId }); setAssignForm({ ioId: "", scheduledFor: "", isExamDay: false }) }}
                                className="px-2 py-1 bg-navy text-white rounded text-xs">Assign IO</button>
                            )}
                            {i.status === "SUBMITTED" && (
                              <button onClick={() => setView(i)} className="px-2 py-1 border border-gray-200 rounded text-xs">View Report</button>
                            )}
                            {["SO", "US"].includes(role) && i.status === "SUBMITTED" && (
                              <button onClick={() => flagMut.mutate(i.id)}
                                className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded text-xs">Flag Remediation</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Assign modal */}
      {assign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-4">Assign Inspection Officer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IO User ID *</label>
                <input value={assignForm.ioId} onChange={(e) => setAssignForm({ ...assignForm, ioId: e.target.value })}
                  placeholder="IO user ID" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                <input type="date" value={assignForm.scheduledFor} onChange={(e) => setAssignForm({ ...assignForm, scheduledFor: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={assignForm.isExamDay} onChange={(e) => setAssignForm({ ...assignForm, isExamDay: e.target.checked })} />
                <span className="text-sm">Exam Day Visit</span>
              </label>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setAssign(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => assignMut.mutate()} disabled={!assignForm.ioId || assignMut.isPending}
                className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-50">
                {assignMut.isPending ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View report modal */}
      {view && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between">
              <h3 className="font-semibold">Inspection Report — {view.venue?.name}</h3>
              <button onClick={() => setView(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">IO:</span> <span className="font-medium">{view.io?.name}</span></div>
                <div><span className="text-gray-500">Status:</span> <StatusBadge status={view.status} /></div>
                <div><span className="text-gray-500">Remediation:</span> <span className={view.requiresRemediation ? "text-red-600 font-medium" : "text-green-600"}>{view.requiresRemediation ? "Required" : "Not required"}</span></div>
                {view.geoLat && <div><a href={`https://maps.google.com/?q=${view.geoLat},${view.geoLng}`} target="_blank" rel="noreferrer" className="text-navy underline">View on Map</a></div>}
              </div>
              {view.findings && <div><p className="text-gray-500 mb-1">Findings:</p><p className="bg-gray-50 rounded p-3">{view.findings}</p></div>}
              {(view.photoUrls ?? []).length > 0 && (
                <div>
                  <p className="text-gray-500 mb-2">Photos ({view.photoUrls.length}):</p>
                  <div className="flex gap-2 flex-wrap">
                    {view.photoUrls.map((u: string, i: number) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer" className="text-xs text-navy underline">[Photo {i + 1}]</a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
