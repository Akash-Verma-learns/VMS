import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import api, { formatMoney } from "../../lib/api"
import Layout from "../../components/Layout"
import StatusBadge from "../../components/StatusBadge"
import LoadingSpinner from "../../components/LoadingSpinner"
import ErrorMessage from "../../components/ErrorMessage"
import ConfirmModal from "../../components/ConfirmModal"
import toast from "react-hot-toast"
import { useState } from "react"
import { AlertCircle } from "lucide-react"

export default function VSFal() {
  const qc = useQueryClient()
  const [ackId, setAckId] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["vs-fals"],
    queryFn: () => api.get("/api/fal/my").then((r) => r.data),
  })

  const ackMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/fal/${id}/acknowledge`),
    onSuccess: () => { toast.success("FAL acknowledged"); setAckId(null); qc.invalidateQueries({ queryKey: ["vs-fals"] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  })

  const fals: any[] = data ?? []
  const pending = fals.filter((f) => f.status === "ISSUED")

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Financial Advance Letter (FAL)</h1>

        {pending.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{pending.length} FAL(s) require acknowledgement</p>
              <p className="text-xs text-amber-600 mt-0.5">Acknowledge all issued FALs to confirm receipt of advance.</p>
            </div>
          </div>
        )}

        {isLoading && <LoadingSpinner />}
        {error && <ErrorMessage message="Failed to load FALs" onRetry={refetch} />}

        <div className="space-y-3">
          {!isLoading && fals.length === 0
            ? <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">No FALs issued to you yet.</div>
            : fals.map((f: any) => (
              <div key={f.id} className={`bg-white rounded-xl shadow-sm border p-5 ${f.status === "ISSUED" ? "border-amber-200" : "border-gray-100"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">FAL #{f.falNumber}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Exam: {f.exam?.name ?? f.examId}</p>
                  </div>
                  <StatusBadge status={f.status} />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div><span className="text-gray-500">Advance Amount:</span> <span className="font-medium ml-1">{formatMoney(f.advanceAmount)}</span></div>
                  <div><span className="text-gray-500">Issued:</span> <span className="ml-1">{f.issuedAt ? format(new Date(f.issuedAt), "dd MMM yyyy") : "—"}</span></div>
                  {f.acknowledgedAt && <div><span className="text-gray-500">Acknowledged:</span> <span className="ml-1">{format(new Date(f.acknowledgedAt), "dd MMM yyyy")}</span></div>}
                </div>
                {f.status === "ISSUED" && (
                  <button onClick={() => setAckId(f.id)}
                    className="mt-4 w-full py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                    Acknowledge Receipt
                  </button>
                )}
              </div>
            ))
          }
        </div>
      </div>

      {ackId && (
        <ConfirmModal title="Acknowledge FAL" message="By acknowledging, you confirm that you have received the advance amount mentioned in this FAL."
          onConfirm={() => ackMut.mutate(ackId!)} onCancel={() => setAckId(null)}
          loading={ackMut.isPending} confirmLabel="Acknowledge" />
      )}
    </Layout>
  )
}
