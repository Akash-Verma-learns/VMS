import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, differenceInDays } from "date-fns"
import { ChevronDown } from "lucide-react"
import api from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import StatusBadge from "../components/StatusBadge"
import ErrorMessage from "../components/ErrorMessage"
import toast from "react-hot-toast"
import clsx from "clsx"

function SkeletonRow() {
  return <tr>{[...Array(8)].map((_, i) => <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
}

export default function Approvals() {
  const { user } = useAuthStore()
  const role = user?.role ?? ""
  const qc = useQueryClient()
  const [tab, setTab] = useState("ALL")
  const [selected, setSelected] = useState<string[]>([])
  const [detail, setDetail] = useState<any>(null)
  const [returnRemarks, setReturnRemarks] = useState("")
  const [returnId, setReturnId] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkProgress, setBulkProgress] = useState("")

  const canListApprovals = ["SO", "US", "DS", "JS"].includes(role)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["approvals"],
    queryFn: () => api.get("/api/approvals").then((r) => r.data),
    enabled: canListApprovals,
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/approvals/${id}/action`, { action: "APPROVE" }),
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["approvals"] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  })

  const returnMut = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      api.patch(`/api/approvals/${id}/action`, { action: "REJECT", remarks }),
    onSuccess: () => { toast.success("Returned"); setReturnId(null); setReturnRemarks(""); qc.invalidateQueries({ queryKey: ["approvals"] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  })

  async function bulkApprove() {
    setBulkLoading(true)
    for (let i = 0; i < selected.length; i++) {
      setBulkProgress(`Approving ${i + 1} of ${selected.length}…`)
      try { await api.patch(`/api/approvals/${selected[i]}/action`, { action: "APPROVE" }) } catch {}
    }
    setBulkLoading(false); setBulkProgress(""); setSelected([])
    toast.success("Bulk approve complete"); qc.invalidateQueries({ queryKey: ["approvals"] })
  }

  const approvals: any[] = (data ?? []).filter((a: any) => tab === "ALL" || a.status === tab)

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Approval Queue</h1>
          {selected.length > 0 && ["SO", "US"].includes(role) && (
            <button onClick={bulkApprove} disabled={bulkLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {bulkLoading ? bulkProgress : `Bulk Approve (${selected.length})`}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {["ALL", "PENDING", "IN_REVIEW", "APPROVED", "REJECTED"].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx("px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                tab === t ? "border-navy text-navy" : "border-transparent text-gray-500 hover:text-gray-700")}>
              {t.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {!canListApprovals && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            As ASO, you submit approvals for review — SO and above manage the queue here.
          </div>
        )}
        {error && <ErrorMessage message="Failed to load approvals" onRetry={refetch} />}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["SO", "US"].includes(role) && <th className="px-4 py-3 w-8" />}
                  {["Type", "Exam", "Initiated By", "Date", "Stage", "Age", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />) :
                  approvals.length === 0
                    ? <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400">No approvals found.</td></tr>
                    : approvals.map((a: any) => {
                      const age = differenceInDays(new Date(), new Date(a.createdAt))
                      return (
                        <tr key={a.id} className={clsx("hover:bg-gray-50", age > 7 && "bg-red-50/40")}>
                          {["SO", "US"].includes(role) && (
                            <td className="px-4 py-3">
                              <input type="checkbox" checked={selected.includes(a.id)}
                                onChange={(e) => setSelected(e.target.checked ? [...selected, a.id] : selected.filter((x) => x !== a.id))} />
                            </td>
                          )}
                          <td className="px-4 py-3 font-medium">{a.type?.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3">{a.exam?.examCode ?? "—"}</td>
                          <td className="px-4 py-3">{a.initiator?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-500">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</td>
                          <td className="px-4 py-3">{a.currentRole}</td>
                          <td className={clsx("px-4 py-3 font-medium", age > 7 ? "text-red-600" : "")}>{age}d</td>
                          <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => setDetail(a)} className="px-2 py-1 border border-gray-200 rounded text-xs hover:bg-gray-50">
                                Open <ChevronDown size={12} className="inline" />
                              </button>
                              {["PENDING", "IN_REVIEW"].includes(a.status) && (
                                <>
                                  <button onClick={() => approveMut.mutate(a.id)}
                                    className="px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded text-xs hover:bg-green-100">Approve</button>
                                  <button onClick={() => setReturnId(a.id)}
                                    className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded text-xs hover:bg-red-100">Return</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900">{detail.type?.replace(/_/g, " ")}</h3>
                <p className="text-sm text-gray-500">{detail.exam?.examCode}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span><StatusBadge status={detail.status} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Current Stage</span><span className="font-medium">{detail.currentRole}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Initiated By</span><span>{detail.initiator?.name}</span>
              </div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Audit Trail</h4>
              {(detail.auditEntries ?? []).length === 0
                ? <p className="text-sm text-gray-400">No audit entries yet.</p>
                : (detail.auditEntries ?? []).map((e: any) => (
                  <div key={e.id} className="border-l-2 border-gray-200 pl-3 py-1">
                    <p className="text-sm font-medium">{e.action} — {e.actor?.name}</p>
                    {e.remarks && <p className="text-xs text-gray-500 italic">"{e.remarks}"</p>}
                    <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Return modal */}
      {returnId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-3">Return File — Remarks Required</h3>
            <textarea value={returnRemarks} onChange={(e) => setReturnRemarks(e.target.value)} rows={4}
              placeholder="State reason for returning…" className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => setReturnId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button disabled={!returnRemarks || returnMut.isPending}
                onClick={() => returnMut.mutate({ id: returnId!, remarks: returnRemarks })}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">
                {returnMut.isPending ? "Returning…" : "Return File"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
