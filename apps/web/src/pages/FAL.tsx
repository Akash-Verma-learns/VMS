import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import api, { formatMoney } from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import { FilterChips } from "../components/ux"
import StatusBadge from "../components/StatusBadge"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import toast from "react-hot-toast"

function SkeletonRow() {
  return <tr>{[...Array(8)].map((_, i) => <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
}

export default function FAL() {
  const { user } = useAuthStore()
  const role = user?.role ?? ""
  const qc = useQueryClient()
  const [filter, setFilter] = useState("ALL")
  const [showCreate, setShowCreate] = useState(false)
  const [viewFal, setViewFal] = useState<any>(null)
  const [form, setForm] = useState({ examId: "", csId: "", amount: "" })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["fals"],
    queryFn: () => api.get("/api/fal").then((r) => r.data),
  })
  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get("/api/exams").then((r) => r.data) })
  const { data: examAssignments } = useQuery({
    queryKey: ["fal-assignments", form.examId],
    queryFn: () => api.get(`/api/exams/${form.examId}/assignments`).then((r) => r.data),
    enabled: !!form.examId && ["SO", "ASO"].includes(role),
  })
  const csOptions: { id: string; name: string }[] = (() => {
    const seen = new Set<string>()
    return (examAssignments ?? []).reduce((acc: any[], a: any) => {
      if (a.cs && !seen.has(a.cs.id)) { seen.add(a.cs.id); acc.push({ id: a.cs.id, name: a.cs.name }) }
      return acc
    }, [])
  })()

  const sanctionMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/fal/${id}/sanction`),
    onSuccess: () => { toast.success("FAL sanctioned"); qc.invalidateQueries({ queryKey: ["fals"] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  })
  const reminderMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/fal/${id}/reminder`),
    onSuccess: (_, id) => {
      const f = fals.find((x: any) => x.id === id)
      toast.success(`Reminder sent to ${f?.cs?.name ?? "CS"}`)
    },
  })
  const createMut = useMutation({
    mutationFn: () => api.post("/api/fal", { examId: form.examId, csId: form.csId, advanceAmountInPaise: Math.round(Number(form.amount) * 100) }),
    onSuccess: () => { toast.success("FAL created"); setShowCreate(false); setForm({ examId: "", csId: "", amount: "" }); qc.invalidateQueries({ queryKey: ["fals"] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  })

  const fals: any[] = (data ?? []).filter((f: any) => filter === "ALL" || f.status === filter)
  const total = data?.length ?? 0
  const issued = (data ?? []).filter((f: any) => f.status === "ISSUED").length
  const ack = (data ?? []).filter((f: any) => f.status === "ACKNOWLEDGED").length
  const overdue = (data ?? []).filter((f: any) => f.status === "OVERDUE").length

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">FAL Management</h1>
          {["ASO", "SO"].includes(role) && (
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-navy text-white rounded-lg text-sm hover:bg-navy-light">+ Create FAL</button>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          {[["Total", total, "text-gray-700"], ["Issued", issued, "text-teal-600"], ["Acknowledged", ack, "text-green-600"], ["Overdue", overdue, "text-red-600"]].map(([l, v, c]) => (
            <div key={l as string} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
              <div className={`text-2xl font-bold ${c}`}>{v as number}</div>
              <div className="text-xs text-gray-500">{l as string}</div>
            </div>
          ))}
        </div>

        <FilterChips
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={["ALL", "PENDING_DS", "SANCTIONED", "ISSUED", "ACKNOWLEDGED", "OVERDUE"]}
        />

        {isLoading && <LoadingSpinner message="Loading FALs…" />}
        {error && <ErrorMessage message="Failed to load FALs" onRetry={refetch} />}

        <div className="ux4g-card ux4g-card-solid overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ux4g-table w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["CS Name", "FAL Number", "Advance Amount", "Issue Date", "Acknowledged", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />) :
                  fals.length === 0
                    ? <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-600">No FALs found.</td></tr>
                    : fals.map((f: any) => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{f.cs?.name ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{f.falNumber}</td>
                        <td className="px-4 py-3">{formatMoney(f.advanceAmount)}</td>
                        <td className="px-4 py-3 text-gray-500">{f.issuedAt ? format(new Date(f.issuedAt), "dd MMM yyyy") : "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{f.acknowledgedAt ? format(new Date(f.acknowledgedAt), "dd MMM yyyy") : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => setViewFal(f)}
                              className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-sm min-h-[36px]">View</button>
                            {f.status === "SANCTIONED" && (
                              <button
                                onClick={() => { navigator.clipboard.writeText(f.id); toast.success("FAL ID copied — share with CS to acknowledge") }}
                                className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-sm min-h-[36px]">
                                Copy ID for CS
                              </button>
                            )}
                            {f.status === "PENDING_DS" && role === "DS" && (
                              <button onClick={() => sanctionMut.mutate(f.id)}
                                className="px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded text-xs">Sanction</button>
                            )}
                            {f.status === "OVERDUE" && (
                              <button onClick={() => reminderMut.mutate(f.id)}
                                className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded text-xs">Remind</button>
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
      </div>

      {/* View modal */}
      {viewFal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-4">FAL Details — {viewFal.falNumber}</h3>
            <dl className="space-y-3 text-sm">
              {[["CS", viewFal.cs?.name], ["Advance", formatMoney(viewFal.advanceAmount)], ["Status", viewFal.status],
                ["Issued", viewFal.issuedAt ? format(new Date(viewFal.issuedAt), "dd MMM yyyy") : "—"],
                ["Acknowledged", viewFal.acknowledgedAt ? format(new Date(viewFal.acknowledgedAt), "dd MMM yyyy") : "—"]
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between border-b border-gray-50 pb-2">
                  <dt className="text-gray-500">{k}</dt><dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <button onClick={() => setViewFal(null)} className="mt-5 w-full py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}

      {/* Create FAL modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-4">Create FAL</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam *</label>
                <select value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })}
                  className="w-full ux4g-input">
                  <option value="">Select exam</option>
                  {(exams ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centre Superintendent *</label>
                {!form.examId ? (
                  <p className="text-xs text-neutral-600 py-2">Select an exam first to load its CS list.</p>
                ) : csOptions.length > 0 ? (
                  <select value={form.csId} onChange={(e) => setForm({ ...form, csId: e.target.value })}
                    className="w-full ux4g-input">
                    <option value="">Select Centre Superintendent</option>
                    {csOptions.map((cs) => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                  </select>
                ) : (
                  <p className="text-xs text-amber-600 py-2">No CS has submitted venue assignments for this exam yet. CS must assign and submit venues first.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advance Amount (Rupees) *</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="842500" className="w-full ux4g-input" />
                {form.amount && <p className="text-xs text-gray-500 mt-1">= {formatMoney(Number(form.amount) * 100)}</p>}
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={!form.examId || !form.csId || !form.amount || createMut.isPending}
                className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-50">
                {createMut.isPending ? "Creating…" : "Create FAL"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
