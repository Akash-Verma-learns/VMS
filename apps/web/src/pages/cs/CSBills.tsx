import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import api, { formatMoney } from "../../lib/api"
import Layout from "../../components/Layout"
import StatusBadge from "../../components/StatusBadge"
import LoadingSpinner from "../../components/LoadingSpinner"
import ErrorMessage from "../../components/ErrorMessage"
import toast from "react-hot-toast"
import { Plus } from "lucide-react"

const BILL_TYPES = ["HONORARIUM", "STATIONERY", "CONTINGENCY", "TRAVEL", "REFRESHMENT", "OTHER"]

export default function CSBills() {
  const qc = useQueryClient()
  const [showSubmit, setShowSubmit] = useState(false)
  const [selectedExamId, setSelectedExamId] = useState("")
  const [examIdInput, setExamIdInput] = useState("")
  const [form, setForm] = useState({ examId: "", type: "HONORARIUM", amount: "", description: "" })

  const { data: bills, isLoading, error, refetch } = useQuery({
    queryKey: ["cs-bills", selectedExamId],
    queryFn: () => api.get(`/api/finance/bills/${selectedExamId}`).then((r) => r.data),
    enabled: !!selectedExamId,
  })

  const submitMut = useMutation({
    mutationFn: () => api.post("/api/finance/bills", {
      examId: form.examId,
      type: form.type,
      amount: Math.round(Number(form.amount) * 100),
      description: form.description,
    }),
    onSuccess: () => {
      toast.success("Bill submitted")
      setShowSubmit(false)
      setForm({ examId: "", type: "HONORARIUM", amount: "", description: "" })
      qc.invalidateQueries({ queryKey: ["cs-bills"] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to submit"),
  })

  const billList: any[] = bills ?? []
  const totalAmount = billList.reduce((sum, b) => sum + Number(b.amount ?? 0), 0)
  const approved = billList.filter((b) => b.status === "APPROVED").length

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Bill Submissions</h1>
          <button onClick={() => setShowSubmit(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg text-sm">
            <Plus size={14} /> Submit Bill
          </button>
        </div>

        {/* Exam ID input */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
          <p className="text-xs text-gray-500">Enter the Exam ID shared by your Section Officer to view bills.</p>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 shrink-0">Exam ID</label>
            <input
              value={examIdInput}
              onChange={(e) => setExamIdInput(e.target.value)}
              placeholder="Paste exam ID here…"
              className="flex-1 ux4g-input font-mono max-w-sm"
            />
            <button
              onClick={() => setSelectedExamId(examIdInput.trim())}
              disabled={!examIdInput.trim()}
              className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-40"
            >
              Load
            </button>
          </div>
          {selectedExamId && <p className="text-xs text-teal-600 font-mono">Loaded: {selectedExamId}</p>}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[["Total Bills", billList.length], ["Total Claimed", formatMoney(totalAmount)], ["Approved", approved]].map(([l, v]) => (
            <div key={l as string} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
              <div className="text-xl font-bold text-gray-900">{v}</div>
              <div className="text-xs text-gray-500">{l as string}</div>
            </div>
          ))}
        </div>

        {isLoading && <LoadingSpinner />}
        {error && <ErrorMessage message="Failed to load bills" onRetry={refetch} />}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["Type", "Exam", "Amount", "Description", "Status", "Submitted"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!selectedExamId
                  ? <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-600">Enter an exam ID above to view bills.</td></tr>
                  : !isLoading && billList.length === 0
                  ? <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-600">No bills submitted yet.</td></tr>
                  : billList.map((b: any) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{b.type?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-gray-500">{b.exam?.examCode ?? "—"}</td>
                      <td className="px-4 py-3">{formatMoney(b.amount)}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-40 truncate">{b.description ?? "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3 text-neutral-600 text-xs">{b.submittedAt ? format(new Date(b.submittedAt), "dd MMM yyyy") : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showSubmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-4">Submit Bill</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam ID *</label>
                <input
                  value={form.examId}
                  onChange={(e) => setForm({ ...form, examId: e.target.value })}
                  placeholder="Paste exam ID…"
                  className="w-full ux4g-input font-mono"
                />
                {selectedExamId && !form.examId && (
                  <button onClick={() => setForm({ ...form, examId: selectedExamId })}
                    className="text-xs text-teal-600 mt-1">Use loaded exam ID</button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bill Type *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full ux4g-input">
                  {BILL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rupees) *</label>
                <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00" className="w-full ux4g-input" />
                {form.amount && <p className="text-xs text-neutral-600 mt-1">= {formatMoney(Number(form.amount) * 100)}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full ux4g-input" />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowSubmit(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => submitMut.mutate()}
                disabled={!form.examId || !form.amount || submitMut.isPending}
                className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-50">
                {submitMut.isPending ? "Submitting…" : "Submit Bill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
