import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api, { formatMoney } from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import StatusBadge from "../components/StatusBadge"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import ConfirmModal from "../components/ConfirmModal"
import toast from "react-hot-toast"
import clsx from "clsx"

export default function Finance() {
  const { user } = useAuthStore()
  const role = user?.role ?? ""
  const qc = useQueryClient()
  const [tab, setTab] = useState<"advances" | "bills">("advances")
  const [examId, setExamId] = useState("")
  const [confirmVerify, setConfirmVerify] = useState<string | null>(null)
  const [confirmApprove, setConfirmApprove] = useState<string | null>(null)

  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get("/api/exams").then((r) => r.data) })

  const { data: advances, isLoading: advLoading, error: advErr, refetch: advRefetch } = useQuery({
    queryKey: ["advances", examId],
    queryFn: () => api.get(`/api/finance/calculate/${examId}`).then((r) => r.data),
    enabled: !!examId && tab === "advances",
  })

  const { data: bills, isLoading: billLoading, error: billErr, refetch: billRefetch } = useQuery({
    queryKey: ["bills", examId],
    queryFn: () => api.get(`/api/finance/bills/${examId}`).then((r) => r.data),
    enabled: !!examId && tab === "bills",
  })

  const verifyMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/finance/bills/${id}/verify`),
    onSuccess: () => { toast.success("Bill verified"); setConfirmVerify(null); qc.invalidateQueries({ queryKey: ["bills"] }) },
  })
  const approveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/finance/bills/${id}/approve`),
    onSuccess: () => { toast.success("Bill approved"); setConfirmApprove(null); qc.invalidateQueries({ queryKey: ["bills"] }) },
  })

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Financial Management</h1>

        <div className="flex gap-4 items-center">
          <label className="text-sm font-medium text-gray-700 shrink-0">Select Exam:</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)}
            className="ux4g-input flex-1 max-w-xs">
            <option value="">— Choose exam —</option>
            {(exams ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.examCode})</option>)}
          </select>
        </div>

        <div className="flex gap-2 border-b border-gray-200">
          {(["advances", "bills"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx("px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize",
                tab === t ? "border-navy text-navy" : "border-transparent text-gray-500 hover:text-gray-700")}>
              {t === "advances" ? "Advance Calculations" : "Bill Settlement"}
            </button>
          ))}
        </div>

        {!examId && <p className="text-neutral-600 text-sm py-8 text-center">Please select an exam to view data.</p>}

        {tab === "advances" && examId && (
          <>
            {advLoading && <LoadingSpinner />}
            {advErr && <ErrorMessage message="Failed to load advance calculations" onRetry={advRefetch} />}
            {!advLoading && !advErr && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>{["Venue", "City", "Candidates", "Honorarium", "Stationery", "Contingency", "Total"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(Array.isArray(advances) ? advances : []).length === 0
                        ? <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-600">No data for this exam.</td></tr>
                        : (Array.isArray(advances) ? advances : []).map((c: any) => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{c.venue?.name ?? "—"}</td>
                            <td className="px-4 py-3">{c.venue?.cityName ?? "—"}</td>
                            <td className="px-4 py-3">{c.candidateCount?.toLocaleString()}</td>
                            <td className="px-4 py-3">{formatMoney(c.honorarium)}</td>
                            <td className="px-4 py-3">{formatMoney(c.stationery)}</td>
                            <td className="px-4 py-3">{formatMoney(c.contingency)}</td>
                            <td className="px-4 py-3 font-semibold">{formatMoney(c.totalAmount)}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "bills" && examId && (
          <>
            {billLoading && <LoadingSpinner />}
            {billErr && <ErrorMessage message="Failed to load bills" onRetry={billRefetch} />}
            {!billLoading && !billErr && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["Total Bills", (bills ?? []).length],
                    ["Total Amount", formatMoney((bills ?? []).reduce((s: number, b: any) => s + Number(b.amount), 0))],
                    ["Approved", (bills ?? []).filter((b: any) => b.status === "APPROVED").length],
                  ].map(([l, v]) => (
                    <div key={l as string} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                      <div className="text-lg font-bold text-gray-900">{v}</div>
                      <div className="text-xs text-gray-500">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>{["Submitted By", "Type", "Amount", "Status", "Submitted", "Actions"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(bills ?? []).length === 0
                          ? <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-600">No bills for this exam.</td></tr>
                          : (bills ?? []).map((b: any) => (
                            <tr key={b.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium">{b.submitter?.name ?? "—"}</td>
                              <td className="px-4 py-3">{b.type?.replace(/_/g, " ")}</td>
                              <td className="px-4 py-3">{formatMoney(b.amount)}</td>
                              <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{b.submittedAt ? new Date(b.submittedAt).toLocaleDateString() : "—"}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  {b.status === "SUBMITTED" && role === "US" && (
                                    <button onClick={() => setConfirmVerify(b.id)}
                                      className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded text-xs">Verify</button>
                                  )}
                                  {b.status === "VERIFIED" && role === "DS" && (
                                    <button onClick={() => setConfirmApprove(b.id)}
                                      className="px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded text-xs">Approve</button>
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
              </>
            )}
          </>
        )}
      </div>

      {confirmVerify && (
        <ConfirmModal title="Verify Bill" message="Confirm this bill as verified?"
          onConfirm={() => verifyMut.mutate(confirmVerify!)} onCancel={() => setConfirmVerify(null)}
          loading={verifyMut.isPending} confirmLabel="Verify" />
      )}
      {confirmApprove && (
        <ConfirmModal title="Approve Bill" message="Approve this bill for payment?"
          onConfirm={() => approveMut.mutate(confirmApprove!)} onCancel={() => setConfirmApprove(null)}
          loading={approveMut.isPending} confirmLabel="Approve" />
      )}
    </Layout>
  )
}
