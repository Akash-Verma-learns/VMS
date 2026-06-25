import { useState } from "react"
import { useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { AlertTriangle, Copy, Check } from "lucide-react"
import api from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import StatusBadge from "../components/StatusBadge"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import ConfirmModal from "../components/ConfirmModal"
import toast from "react-hot-toast"

export default function ExamDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const role = user?.role ?? ""
  const qc = useQueryClient()
  const [showConfirm, setShowConfirm] = useState(false)
  const [capacityEdits, setCapacityEdits] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const [rejectModal, setRejectModal] = useState<{ assignmentId: string; label: string } | null>(null)
  const [rejectComment, setRejectComment] = useState("")

  function copyId() {
    navigator.clipboard.writeText(id ?? "")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const { data: exam, isLoading, error, refetch } = useQuery({
    queryKey: ["exam", id],
    queryFn: () => api.get(`/api/exams/${id}`).then((r) => r.data),
  })

  const canSeeAssignments = ["SO", "US", "DS", "JS"].includes(role)
  const {
    data: assignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ["exam-assignments", id],
    queryFn: () => api.get(`/api/exams/${id}/assignments`).then((r) => r.data),
    enabled: canSeeAssignments,
  })

  const reviewMut = useMutation({
    mutationFn: ({ assignmentId, status, rejectionComment }: { assignmentId: string; status: string; rejectionComment?: string }) =>
      api.patch(`/api/exams/${id}/assignments/${assignmentId}`, { status, rejectionComment }),
    onSuccess: () => {
      toast.success("Assignment updated")
      setRejectModal(null)
      setRejectComment("")
      refetchAssignments()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to update"),
  })

  const releaseMut = useMutation({
    mutationFn: () => api.patch(`/api/exams/${id}/release`),
    onSuccess: () => { toast.success("Exam released successfully"); qc.invalidateQueries({ queryKey: ["exam", id] }); setShowConfirm(false) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to release exam"),
  })

  if (isLoading) return <Layout><LoadingSpinner message="Loading exam details…" /></Layout>
  if (error) return <Layout><ErrorMessage message="Failed to load exam" onRetry={refetch} /></Layout>

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{exam.name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="font-mono text-sm text-gray-500">{exam.examCode}</span>
              <StatusBadge status={exam.status} />
              <span className="text-sm text-gray-500">{format(new Date(exam.scheduledDate), "dd MMM yyyy")}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Created by {exam.createdBy?.name} · {exam.sessions} session(s)</p>
            <button onClick={copyId}
              className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-navy font-mono border border-gray-200 rounded px-2 py-1 hover:border-navy transition-colors">
              {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
              <span className="max-w-48 truncate">{id}</span>
              {copied ? <span className="text-green-600 not-italic font-sans">Copied!</span> : <span className="not-italic font-sans text-gray-400">Copy ID for CS</span>}
            </button>
          </div>
          {exam.status !== "RELEASED" && role === "US" && (
            <button onClick={() => setShowConfirm(true)}
              className="px-5 py-2 bg-navy text-white rounded-lg font-medium hover:bg-navy-light text-sm">
              Release Exam
            </button>
          )}
        </div>

        {exam.status === "DRAFT" && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">This exam has not been released. CS cannot begin venue selection.</p>
          </div>
        )}

        {/* Venue Assignments */}
        {canSeeAssignments && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">Venue Assignments</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{(assignments ?? []).length} venue(s)</span>
                <button onClick={() => refetchAssignments()} className="text-xs text-navy hover:underline">Refresh</button>
              </div>
            </div>
            {assignmentsLoading && <div className="px-5 py-8 text-center text-sm text-gray-400">Loading assignments…</div>}
            {assignmentsError && (
              <div className="px-5 py-4">
                <ErrorMessage message="Failed to load venue assignments" onRetry={refetchAssignments} />
              </div>
            )}
            {!assignmentsLoading && !assignmentsError && (
              <>
                {(assignments ?? []).some((a: any) => a.status === "PROPOSED") && (
                  <div className="mx-5 my-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                    Some venues are still in <strong>PROPOSED</strong> status — CS has not yet submitted them for review. Ask CS to log in and click "Submit for Review."
                  </div>
                )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{["Venue", "City", "Seats", "CS", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(assignments ?? []).length === 0
                      ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No venues assigned by CS yet.</td></tr>
                      : (assignments ?? []).map((a: any) => (
                        <tr key={a.id} className={a.status === "REJECTED" ? "bg-red-50/40" : "hover:bg-gray-50"}>
                          <td className="px-4 py-3 font-medium">{a.venue?.name}</td>
                          <td className="px-4 py-3">{a.venue?.cityName}</td>
                          <td className="px-4 py-3 text-sm">
                            {a.seatsAllocated != null
                              ? <>{a.seatsAllocated.toLocaleString()} <span className="text-gray-400 text-xs">/ {a.venue?.capacity?.toLocaleString()}</span></>
                              : <span className="text-gray-400 text-xs">Full ({a.venue?.capacity?.toLocaleString()})</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{a.cs?.name ?? "—"}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={a.status ?? "PROPOSED"} />
                            {a.status === "REJECTED" && a.rejectionComment && (
                              <p className="text-xs text-red-600 mt-1 italic">"{a.rejectionComment}"</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 flex-wrap">
                              {role === "SO" && a.status === "PROPOSED" && (
                                <span className="text-xs text-gray-400 italic">Awaiting CS submit</span>
                              )}
                              {role === "SO" && a.status === "SUBMITTED" && (
                                <>
                                  <button
                                    onClick={() => reviewMut.mutate({ assignmentId: a.id, status: "SO_REVIEWED" })}
                                    disabled={reviewMut.isPending}
                                    className="px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-xs hover:bg-indigo-100 disabled:opacity-50">
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => { setRejectModal({ assignmentId: a.id, label: a.venue?.name }); setRejectComment("") }}
                                    className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded text-xs hover:bg-red-100">
                                    Reject
                                  </button>
                                </>
                              )}
                              {role === "US" && a.status === "SO_REVIEWED" && (
                                <>
                                  <button
                                    onClick={() => reviewMut.mutate({ assignmentId: a.id, status: "APPROVED" })}
                                    disabled={reviewMut.isPending}
                                    className="px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded text-xs hover:bg-green-100 disabled:opacity-50">
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => { setRejectModal({ assignmentId: a.id, label: a.venue?.name }); setRejectComment("") }}
                                    className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded text-xs hover:bg-red-100">
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        )}

        {/* Centre table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Centre Capacities</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{["City", "Suggested Capacity", "Final Capacity", "Released", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(exam.centres ?? []).length === 0
                  ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No centres configured.</td></tr>
                  : (exam.centres ?? []).map((c: any) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.cityName}</td>
                      <td className="px-4 py-3">{c.suggestedCapacity?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {["SO", "US"].includes(role)
                          ? <input
                              type="number"
                              value={capacityEdits[c.id] ?? c.finalCapacity ?? ""}
                              onChange={(e) => setCapacityEdits((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              onBlur={async () => {
                                const val = capacityEdits[c.id]
                                if (val && val !== String(c.finalCapacity)) {
                                  try {
                                    await api.patch(`/api/exams/${id}/centre/${c.id}`, { finalCapacity: Number(val) })
                                    toast.success("Capacity saved")
                                    qc.invalidateQueries({ queryKey: ["exam", id] })
                                  } catch { toast.error("Failed to save capacity") }
                                }
                              }}
                              className="w-28 border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          : (c.finalCapacity?.toLocaleString() ?? "—")
                        }
                      </td>
                      <td className="px-4 py-3">
                        {c.isReleased ? <span className="text-green-600">✓</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {c.finalCapacity ? `${c.finalCapacity?.toLocaleString()} seats` : "Pending"}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          title="Release Examination"
          message="This will notify all Coordinating Supervisors and lock centre capacities. This cannot be undone. Confirm?"
          confirmLabel="Release Now"
          onConfirm={() => releaseMut.mutate()}
          onCancel={() => setShowConfirm(false)}
          loading={releaseMut.isPending}
        />
      )}

      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-1">Reject Venue Assignment</h3>
            <p className="text-sm text-gray-500 mb-3">
              Rejecting <strong>{rejectModal.label}</strong>. Your comment is mandatory and will be shown to the CS.
            </p>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={4}
              placeholder="State reason for rejection (e.g. venue not suitable, capacity insufficient, duplicate)…"
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              autoFocus
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button
                disabled={!rejectComment.trim() || reviewMut.isPending}
                onClick={() => reviewMut.mutate({ assignmentId: rejectModal.assignmentId, status: "REJECTED", rejectionComment: rejectComment })}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">
                {reviewMut.isPending ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
