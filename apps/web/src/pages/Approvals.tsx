import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, differenceInDays } from "date-fns"
import { ChevronDown, X } from "lucide-react"
import api from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import { Tabs, FilterChips } from "../components/ux"
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

  // Approval queue state
  const [tab, setTab] = useState("ALL")
  const [selected, setSelected] = useState<string[]>([])
  const [detail, setDetail] = useState<any>(null)
  const [returnRemarks, setReturnRemarks] = useState("")
  const [returnId, setReturnId] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkProgress, setBulkProgress] = useState("")

  // Venue approval state
  const [venueTab, setVenueTab] = useState<"approvals" | "venues">("approvals")
  const [rejectVenueId, setRejectVenueId] = useState<string | null>(null)
  const [venueRejectNote, setVenueRejectNote] = useState("")

  const canListApprovals = ["SO", "US", "DS", "JS"].includes(role)
  const canApproveVenues = ["SO", "US"].includes(role)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["approvals"],
    queryFn: () => api.get("/api/approvals").then((r) => r.data),
    enabled: canListApprovals,
  })

  const { data: pendingVenues, isLoading: venuesLoading, refetch: refetchVenues } = useQuery({
    queryKey: ["pending-venues"],
    queryFn: () => api.get("/api/venues/pending").then((r) => r.data),
    enabled: canApproveVenues,
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/approvals/${id}/action`, { action: "APPROVE" }),
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["approvals"] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  })

  const returnMut = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      api.patch(`/api/approvals/${id}/action`, { action: "REJECT", remarks }),
    onSuccess: () => {
      toast.success("Returned with remarks")
      setReturnId(null)
      setReturnRemarks("")
      qc.invalidateQueries({ queryKey: ["approvals"] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  })

  const approveVenueMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/venues/${id}/approve`),
    onSuccess: () => { toast.success("Venue approved"); qc.invalidateQueries({ queryKey: ["pending-venues"] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  })

  const rejectVenueMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.patch(`/api/venues/${id}/reject`, { rejectionNote: note }),
    onSuccess: () => {
      toast.success("Venue rejected with note sent to CS")
      setRejectVenueId(null)
      setVenueRejectNote("")
      qc.invalidateQueries({ queryKey: ["pending-venues"] })
    },
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
  const pendingVenueList: any[] = pendingVenues ?? []

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Approval Queue</h1>
          {selected.length > 0 && ["SO", "US"].includes(role) && venueTab === "approvals" && (
            <button onClick={bulkApprove} disabled={bulkLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {bulkLoading ? bulkProgress : `Bulk Approve (${selected.length})`}
            </button>
          )}
        </div>

        {/* Top-level tab: Workflow Approvals vs Venue Approvals */}
        {canApproveVenues && (
          <Tabs
            label="Approval type"
            value={venueTab}
            onChange={(v) => setVenueTab(v as typeof venueTab)}
            options={[
              { value: "approvals", label: "Workflow" },
              { value: "venues", label: "Venues", badge: pendingVenueList.length },
            ]}
          />
        )}

        {/* ---- VENUE APPROVALS TAB ---- */}
        {venueTab === "venues" && canApproveVenues && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
              CS officers submit new venues for review. Approve to make them available for exam assignment, or reject with a note.
            </div>
            <div className="ux4g-card ux4g-card-solid overflow-hidden">
              {venuesLoading ? (
                <div className="p-6 text-center text-neutral-600 text-sm">Loading pending venues…</div>
              ) : pendingVenueList.length === 0 ? (
                <div className="p-10 text-center text-neutral-600 text-sm">No venues pending approval.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="ux4g-table w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>{["Venue Name", "City", "Type", "Capacity", "Submitted By", "Age", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pendingVenueList.map((v: any) => {
                        const age = differenceInDays(new Date(), new Date(v.createdAt))
                        return (
                          <tr key={v.id} className={clsx("hover:bg-gray-50", age > 3 && "bg-amber-50/30")}>
                            <td className="px-4 py-3 font-medium">{v.name}<br /><span className="text-xs text-neutral-600">{v.address}</span></td>
                            <td className="px-4 py-3">{v.cityName}</td>
                            <td className="px-4 py-3 text-xs">{v.type}</td>
                            <td className="px-4 py-3">{v.capacity?.toLocaleString()}</td>
                            <td className="px-4 py-3">{v.addedBy?.name} <span className="text-xs text-neutral-600">({v.addedBy?.role})</span></td>
                            <td className={clsx("px-4 py-3 font-medium", age > 3 ? "text-amber-600" : "text-gray-500")}>{age}d</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button onClick={() => approveVenueMut.mutate(v.id)} disabled={approveVenueMut.isPending}
                                  className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded text-xs hover:bg-green-100 disabled:opacity-50">
                                  Approve
                                </button>
                                <button onClick={() => { setRejectVenueId(v.id); setVenueRejectNote("") }}
                                  className="px-3 py-1 bg-red-50 border border-red-200 text-red-700 rounded text-xs hover:bg-red-100">
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ---- WORKFLOW APPROVALS TAB ---- */}
        {venueTab === "approvals" && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
              <strong>Note:</strong> Venue assignment approvals (CS → SO → US) are managed per exam.
              Go to <strong>Exams → View an exam → Venue Assignments</strong> to review venue submissions.
              This queue is for other administrative approval workflows.
            </div>

            <FilterChips
              label="Filter by status"
              value={tab}
              onChange={setTab}
              options={["ALL", "PENDING", "IN_REVIEW", "APPROVED", "REJECTED"]}
            />

            {!canListApprovals && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                As ASO, you submit approvals for review — SO and above manage the queue here.
              </div>
            )}
            {error && <ErrorMessage message="Failed to load approvals" onRetry={refetch} />}

            <div className="ux4g-card ux4g-card-solid overflow-hidden">
              <div className="overflow-x-auto">
                <table className="ux4g-table w-full text-sm">
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
                        ? <tr><td colSpan={10} className="px-4 py-12 text-center text-neutral-600">No approvals found.</td></tr>
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
          </>
        )}
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
              <button onClick={() => setDetail(null)} aria-label="Close"
                className="ux4g-btn ux4g-btn-text-neutral ux4g-btn-sm"><X size={18} strokeWidth={2} aria-hidden /></button>
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
                ? <p className="text-sm text-neutral-600">No audit entries yet.</p>
                : (detail.auditEntries ?? []).map((e: any) => (
                  <div key={e.id} className="pl-3 py-1 border-l"
                       style={{ borderColor: "var(--ux4g-color-neutral-300)" }}>
                    <p className="text-sm font-medium">{e.action} — {e.actor?.name}</p>
                    {e.remarks && <p className="text-xs text-gray-500 italic">"{e.remarks}"</p>}
                    <p className="text-xs text-neutral-600">{formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Return with remarks modal */}
      {returnId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-1">Return File — Remarks Required</h3>
            <p className="text-xs text-gray-500 mb-3">Your remarks will be recorded in the audit trail and visible to the initiator.</p>
            <textarea value={returnRemarks} onChange={(e) => setReturnRemarks(e.target.value)} rows={4}
              placeholder="State reason for returning…" className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => setReturnId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button disabled={!returnRemarks.trim() || returnMut.isPending}
                onClick={() => returnMut.mutate({ id: returnId!, remarks: returnRemarks })}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">
                {returnMut.isPending ? "Returning…" : "Return File"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject venue modal */}
      {rejectVenueId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-1">Reject Venue — Note Required</h3>
            <p className="text-xs text-gray-500 mb-3">Your note will be shown to the CS who submitted this venue so they can correct and resubmit.</p>
            <textarea value={venueRejectNote} onChange={(e) => setVenueRejectNote(e.target.value)} rows={4}
              placeholder="Reason for rejection (e.g. insufficient capacity, address incomplete)…"
              className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => setRejectVenueId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button disabled={!venueRejectNote.trim() || rejectVenueMut.isPending}
                onClick={() => rejectVenueMut.mutate({ id: rejectVenueId!, note: venueRejectNote })}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">
                {rejectVenueMut.isPending ? "Rejecting…" : "Reject Venue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
