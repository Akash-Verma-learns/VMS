import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "../../lib/api"
import Layout from "../../components/Layout"
import StatusBadge from "../../components/StatusBadge"
import LoadingSpinner from "../../components/LoadingSpinner"
import ErrorMessage from "../../components/ErrorMessage"
import ConfirmModal from "../../components/ConfirmModal"
import toast from "react-hot-toast"
import { AlertTriangle, Check, Plus, X } from "lucide-react"

const VENUE_TYPES = ["GOVERNMENT", "AIDED", "PRIVATE", "UNIVERSITY"]

export default function VenueManagement() {
  const qc = useQueryClient()
  const [selectedExamId, setSelectedExamId] = useState("")
  const [examIdInput, setExamIdInput] = useState("")
  const [examError, setExamError] = useState("")
  const [assignModal, setAssignModal] = useState<{ venueId: string; capacity: number } | null>(null)
  const [seatsInput, setSeatsInput] = useState("")
  const [submitConfirm, setSubmitConfirm] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: "", address: "", cityName: "", type: "GOVERNMENT", capacity: "", pincode: "" })

  const [examInfo, setExamInfo] = useState<{ name: string; examCode: string } | null>(null)
  const [loadingExam, setLoadingExam] = useState(false)

  async function handleLoad() {
    const code = examIdInput.trim().toUpperCase()
    if (!code) return
    setExamError("")
    setExamInfo(null)
    setSelectedExamId("")
    setLoadingExam(true)
    try {
      const res = await api.get("/api/exams/lookup", { params: { code } })
      setSelectedExamId(res.data.id)
      setExamInfo({ name: res.data.name, examCode: res.data.examCode })
    } catch (e: any) {
      setExamError(e.response?.data?.error ?? "Exam not found. Check the code and try again.")
    } finally {
      setLoadingExam(false)
    }
  }

  const { data: venues, isLoading: venuesLoading, error: venuesError, refetch: refetchVenues } = useQuery({
    queryKey: ["cs-venues"],
    queryFn: () => api.get("/api/venues").then((r) => r.data),
  })

  const { data: assignments, isLoading: assignLoading } = useQuery({
    queryKey: ["cs-assignments", selectedExamId],
    queryFn: () => api.get(`/api/exams/${selectedExamId}/assignments`).then((r) => r.data),
    enabled: !!selectedExamId,
  })

  const addVenueMut = useMutation({
    mutationFn: () => api.post("/api/venues", {
      name: addForm.name, address: addForm.address, cityName: addForm.cityName,
      type: addForm.type, capacity: Number(addForm.capacity),
    }),
    onSuccess: () => {
      toast.success("Venue submitted for SO approval")
      setShowAdd(false)
      setAddForm({ name: "", address: "", cityName: "", type: "GOVERNMENT", capacity: "", pincode: "" })
      qc.invalidateQueries({ queryKey: ["cs-venues"] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to add venue"),
  })

  const assignMut = useMutation({
    mutationFn: ({ venueId, seats }: { venueId: string; seats: number | null }) =>
      api.post(`/api/exams/${selectedExamId}/assignments`, {
        venueId,
        seatsAllocated: seats ?? undefined,
      }),
    onSuccess: () => {
      toast.success("Venue assigned to exam")
      setAssignModal(null)
      setSeatsInput("")
      qc.invalidateQueries({ queryKey: ["cs-assignments", selectedExamId] })
    },
    onError: (e: any) => {
      const msg = e.response?.data?.error ?? "Failed to assign"
      toast.error(msg)
      if (e.response?.status === 404) {
        setExamError("Exam not found. Please check the exam ID.")
        setSelectedExamId("")
      }
    },
  })

  const submitMut = useMutation({
    mutationFn: () => api.post(`/api/exams/${selectedExamId}/assignments/submit`),
    onSuccess: (res) => {
      toast.success(`${res.data.count} venue(s) submitted for review`)
      setSubmitConfirm(false)
      qc.invalidateQueries({ queryKey: ["cs-assignments", selectedExamId] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to submit"),
  })

  const venueList: any[] = venues ?? []
  const assignmentList: any[] = assignments ?? []
  const assignedVenueIds = new Set(assignmentList.map((a: any) => a.venueId))
  const proposedCount = assignmentList.filter((a: any) => a.status === "PROPOSED").length
  const submittedCount = assignmentList.filter((a: any) => a.status !== "PROPOSED").length

  function openAssignModal(v: any) {
    setAssignModal({ venueId: v.id, capacity: v.capacity })
    setSeatsInput(String(v.capacity))
  }

  function handleConfirmAssign() {
    if (!assignModal) return
    const seats = seatsInput.trim() ? Number(seatsInput) : null
    if (seats !== null && (isNaN(seats) || seats <= 0 || seats > assignModal.capacity)) {
      toast.error(`Seats must be between 1 and ${assignModal.capacity}`)
      return
    }
    assignMut.mutate({ venueId: assignModal.venueId, seats })
  }

  const approvalBadge: Record<string, string> = {
    PENDING_APPROVAL: "bg-amber-100 text-amber-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="ux4g-heading-xl-strong">Venue Management</h1>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg text-sm">
            <Plus size={14} /> Add Venue
          </button>
        </div>

        {/* Exam selector */}
        <div className="ux4g-card ux4g-card-solid p-4 space-y-2">
          <p className="text-xs text-gray-500">
            Enter the exam code shared by your Section Officer — e.g.{" "}
            <span className="font-mono text-gray-600">UPSC/2030/CSP</span>
          </p>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 shrink-0">Exam Code</label>
            <input
              value={examIdInput}
              onChange={(e) => { setExamIdInput(e.target.value); setExamError("") }}
              onKeyDown={(e) => e.key === "Enter" && handleLoad()}
              placeholder="e.g. UPSC/2030/CSP"
              className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono max-w-sm ${examError ? "border-red-400" : "border-gray-300"}`}
            />
            <button onClick={handleLoad} disabled={!examIdInput.trim() || loadingExam}
              className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-40">
              {loadingExam ? "Loading…" : "Load"}
            </button>
          </div>
          {examError && <p className="text-xs text-red-600">{examError}</p>}
          {examInfo && (
            <p className="text-xs text-green-700 font-medium">
              ✓ {examInfo.name} <span className="text-neutral-600 font-mono">({examInfo.examCode})</span>
            </p>
          )}
          {selectedExamId && !examError && !assignLoading && (
            proposedCount > 0 ? (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-800 font-medium">
                  ⚠ {proposedCount} venue(s) not yet submitted — UPSC cannot review them until you click Submit.
                </p>
                <button onClick={() => setSubmitConfirm(true)}
                  className="ml-3 shrink-0 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">
                  Submit Now
                </button>
              </div>
            ) : submittedCount > 0 ? (
              <p className="text-xs text-green-700 font-medium inline-flex items-center gap-1.5">
                <Check size={14} strokeWidth={2.5} aria-hidden /> All {submittedCount} venue(s) submitted for UPSC review.
              </p>
            ) : (
              <p className="text-xs text-teal-600">Exam loaded — assign venues below then Submit for review.</p>
            )
          )}
          {selectedExamId && !examError && assignLoading && (
            <p className="text-xs text-neutral-600">Fetching assignments…</p>
          )}
        </div>

        {/* Venues table */}
        <div className="ux4g-card ux4g-card-solid overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="ux4g-title-s-strong">My Venues</h2>
          </div>
          {venuesLoading && <LoadingSpinner />}
          {venuesError && <ErrorMessage message="Failed to load venues" onRetry={refetchVenues} />}
          <div className="overflow-x-auto">
            <table className="ux4g-table w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["Venue Name", "Type", "City", "Capacity", "Approval", "Assignment", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!venuesLoading && venueList.length === 0
                  ? <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-600">No venues yet. Add your first venue →</td></tr>
                  : venueList.map((v: any) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {v.name}
                        {v.approvalStatus === "REJECTED" && v.rejectionNote && (
                          <p className="text-xs text-red-500 mt-0.5 italic">Reason: {v.rejectionNote}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{v.type?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3">{v.cityName}</td>
                      <td className="px-4 py-3">{v.capacity?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${approvalBadge[v.approvalStatus] ?? "bg-gray-100 text-gray-500"}`}>
                          {v.approvalStatus === "PENDING_APPROVAL" ? "Awaiting SO" : v.approvalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {v.approvalStatus !== "APPROVED"
                          ? <span className="text-xs text-neutral-600">—</span>
                          : assignedVenueIds.has(v.id)
                            ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Assigned</span>
                            : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">Not Assigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        {selectedExamId && v.approvalStatus === "APPROVED" && !assignedVenueIds.has(v.id) && (
                          <button onClick={() => openAssignModal(v)}
                            className="px-2 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded text-xs">
                            Assign to Exam
                          </button>
                        )}
                        {v.approvalStatus === "PENDING_APPROVAL" && (
                          <span className="text-xs text-amber-600">Pending SO approval</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Assignments table */}
        {selectedExamId && (
          <div className="ux4g-card ux4g-card-solid overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="ux4g-title-s-strong">Exam Assignments</h2>
              {proposedCount > 0 && (
                <button onClick={() => setSubmitConfirm(true)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700">
                  Submit {proposedCount} for Review
                </button>
              )}
            </div>
            {assignLoading ? <LoadingSpinner /> : (
              <div className="overflow-x-auto">
                <table className="ux4g-table w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>{["Venue", "City", "Capacity", "Seats Allotted", "VS Assigned", "Status", "Visibility"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {assignmentList.length === 0
                      ? <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-600">No venues assigned to this exam yet.</td></tr>
                      : assignmentList.map((a: any) => (
                        <tr key={a.id} className={a.status === "PROPOSED" ? "bg-amber-50/40 hover:bg-amber-50" : a.status === "REJECTED" ? "bg-red-50/40" : "hover:bg-gray-50"}>
                          <td className="px-4 py-3 font-medium">{a.venue?.name}</td>
                          <td className="px-4 py-3">{a.venue?.cityName}</td>
                          <td className="px-4 py-3 text-gray-500">{a.venue?.capacity?.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            {a.seatsAllocated != null
                              ? <span className="font-medium">{a.seatsAllocated.toLocaleString()}</span>
                              : <span className="text-neutral-600 text-xs">Full capacity</span>}
                          </td>
                          <td className="px-4 py-3">{a.vs?.name ?? <span className="text-neutral-600 text-xs">Not assigned</span>}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={a.status ?? "PROPOSED"} />
                            {a.status === "REJECTED" && a.rejectionComment && (
                              <p className="text-xs text-red-500 mt-0.5 italic">"{a.rejectionComment}"</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {a.status === "PROPOSED"
                              ? <span className="text-xs text-amber-700 font-medium inline-flex items-center gap-1">
                                    <AlertTriangle size={13} aria-hidden /> Not submitted</span>
                              : a.status === "REJECTED"
                                ? <span className="text-xs text-red-700 inline-flex items-center gap-1">
                                      <X size={13} strokeWidth={2.5} aria-hidden /> Rejected</span>
                                : <span className="text-xs text-green-700 inline-flex items-center gap-1">
                                      <Check size={13} strokeWidth={2.5} aria-hidden /> Visible to UPSC</span>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add venue modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-1">Add Venue</h3>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
              New venues require SO approval before they can be assigned to an exam.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name *</label>
                <input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full ux4g-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <input value={addForm.address} onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  className="w-full ux4g-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input value={addForm.cityName} onChange={(e) => setAddForm({ ...addForm, cityName: e.target.value })}
                    className="w-full ux4g-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input value={addForm.pincode} onChange={(e) => setAddForm({ ...addForm, pincode: e.target.value })}
                    className="w-full ux4g-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                    className="w-full ux4g-input">
                    {VENUE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Capacity *</label>
                  <input type="number" value={addForm.capacity} onChange={(e) => setAddForm({ ...addForm, capacity: e.target.value })}
                    className="w-full ux4g-input" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => addVenueMut.mutate()}
                disabled={!addForm.name || !addForm.address || !addForm.cityName || !addForm.capacity || addVenueMut.isPending}
                className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-50">
                {addVenueMut.isPending ? "Submitting…" : "Submit for Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to exam modal — with seat allocation */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-1">Assign Venue to Exam</h3>
            <p className="text-sm text-gray-500 mb-4">
              {venueList.find((v) => v.id === assignModal.venueId)?.name} &mdash; total capacity: <strong>{assignModal.capacity.toLocaleString()}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seats to Allocate for This Exam *
              </label>
              <input
                type="number"
                min={1}
                max={assignModal.capacity}
                value={seatsInput}
                onChange={(e) => setSeatsInput(e.target.value)}
                className="w-full ux4g-input"
              />
              <p className="text-xs text-neutral-600 mt-1">
                You can allocate fewer seats than total capacity (partial allocation). Leave as-is to use full capacity.
              </p>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => { setAssignModal(null); setSeatsInput("") }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={handleConfirmAssign} disabled={assignMut.isPending}
                className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-50">
                {assignMut.isPending ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit confirm */}
      {submitConfirm && (
        <ConfirmModal
          title="Submit Venue List"
          message="Submit all assigned venues for UPSC review? This will notify UPSC HQ."
          confirmLabel="Submit"
          onConfirm={() => submitMut.mutate()}
          onCancel={() => setSubmitConfirm(false)}
          loading={submitMut.isPending}
        />
      )}
    </Layout>
  )
}
