import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import StatusBadge from "../components/StatusBadge"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import toast from "react-hot-toast"

type CaseStatus = "UNDER_INVESTIGATION" | "CLOSED_LEGITIMATE" | "CLOSED_MALPRACTICE" | "ESCALATED"

const CASE_OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: "UNDER_INVESTIGATION", label: "Under Investigation" },
  { value: "CLOSED_LEGITIMATE", label: "Closed — Legitimate" },
  { value: "CLOSED_MALPRACTICE", label: "Closed — Malpractice" },
  { value: "ESCALATED", label: "Escalated" },
]

export default function FaceAuth() {
  const { user } = useAuthStore()
  const role = user?.role ?? ""
  const qc = useQueryClient()
  const canReview = ["US", "DS"].includes(role)

  const [examId, setExamId] = useState("")
  const [reviewModal, setReviewModal] = useState<{ id: string; rollNo: string } | null>(null)
  const [caseStatus, setCaseStatus] = useState<CaseStatus>("UNDER_INVESTIGATION")
  const [reviewNotes, setReviewNotes] = useState("")

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: () => api.get("/api/exams").then((r) => r.data),
  })

  const { data: records, isLoading, error, refetch } = useQuery({
    queryKey: ["faceauth-flags", examId],
    queryFn: () => api.get(`/api/faceauth/flags/${examId}`).then((r) => r.data),
    enabled: !!examId,
  })

  const reviewMut = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.patch(`/api/faceauth/${id}/review`, { caseStatus, reviewNotes }),
    onSuccess: () => {
      toast.success("Record reviewed")
      qc.invalidateQueries({ queryKey: ["faceauth-flags", examId] })
      setReviewModal(null)
      setReviewNotes("")
      setCaseStatus("UNDER_INVESTIGATION")
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Review failed"),
  })

  const flagged = Array.isArray(records) ? records : []
  const pending = flagged.filter((r: any) => r.caseStatus === "PENDING_REVIEW").length

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Face Auth — Flagged Records</h1>
            <p className="text-sm text-gray-500 mt-0.5">Biometric mismatch flags requiring review</p>
          </div>
          {examId && flagged.length > 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold text-red-600">{pending}</div>
              <div className="text-xs text-gray-500">Pending review</div>
            </div>
          )}
        </div>

        <div className="flex gap-3 items-center">
          <label className="text-sm font-medium text-gray-700 shrink-0">Select Exam:</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-navy max-w-xs">
            <option value="">— Choose exam —</option>
            {(exams ?? []).map((e: any) => (
              <option key={e.id} value={e.id}>{e.name} ({e.examCode})</option>
            ))}
          </select>
        </div>

        {!examId && (
          <p className="text-gray-400 text-sm py-10 text-center">Select an exam to view flagged biometric records.</p>
        )}

        {examId && isLoading && <LoadingSpinner />}
        {examId && error && <ErrorMessage message="Failed to load flagged records" onRetry={refetch} />}

        {examId && !isLoading && !error && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-sm">{flagged.length} Flagged Record{flagged.length !== 1 ? "s" : ""}</h2>
              <button onClick={() => refetch()} className="text-xs text-navy hover:underline">Refresh</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Roll No.", "Venue", "City", "Auth Result", "Confidence", "Case Status", "Flag Reason", ...(canReview ? ["Action"] : [])].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {flagged.length === 0
                    ? <tr><td colSpan={canReview ? 8 : 7} className="px-4 py-10 text-center text-gray-400">No flagged records for this exam.</td></tr>
                    : flagged.map((r: any) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold">{r.candidateRollNo}</td>
                        <td className="px-4 py-3 font-medium">{r.venue?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{r.venue?.cityName ?? "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.matchResult} /></td>
                        <td className="px-4 py-3">
                          {r.matchConfidence != null ? (
                            <span className={r.matchConfidence < 60 ? "text-red-600 font-semibold" : "text-gray-700"}>
                              {Number(r.matchConfidence).toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={r.caseStatus} /></td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={r.flagReason ?? ""}>
                          {r.flagReason ?? "—"}
                        </td>
                        {canReview && (
                          <td className="px-4 py-3">
                            {r.caseStatus === "PENDING_REVIEW" && (
                              <button onClick={() => setReviewModal({ id: r.id, rollNo: r.candidateRollNo })}
                                className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded text-xs hover:bg-amber-100">
                                Review
                              </button>
                            )}
                            {r.caseStatus !== "PENDING_REVIEW" && r.reviewer && (
                              <span className="text-xs text-gray-400">by {r.reviewer.name}</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {reviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-1">Review Flag</h3>
            <p className="text-sm text-gray-500 mb-4">Roll No: <span className="font-mono font-semibold">{reviewModal.rollNo}</span></p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Status *</label>
                <select value={caseStatus} onChange={(e) => setCaseStatus(e.target.value as CaseStatus)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {CASE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Notes</label>
                <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3}
                  placeholder="Add notes about this case…"
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => { setReviewModal(null); setReviewNotes(""); setCaseStatus("UNDER_INVESTIGATION") }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => reviewMut.mutate({ id: reviewModal.id })}
                disabled={reviewMut.isPending}
                className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-50">
                {reviewMut.isPending ? "Saving…" : "Save Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
