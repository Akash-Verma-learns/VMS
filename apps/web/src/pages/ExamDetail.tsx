import { useState } from "react"
import { useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { AlertTriangle } from "lucide-react"
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

  const { data: exam, isLoading, error, refetch } = useQuery({
    queryKey: ["exam", id],
    queryFn: () => api.get(`/api/exams/${id}`).then((r) => r.data),
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
    </Layout>
  )
}
