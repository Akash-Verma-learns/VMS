import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "../../lib/api"
import Layout from "../../components/Layout"
import StatusBadge from "../../components/StatusBadge"
import LoadingSpinner from "../../components/LoadingSpinner"
import ErrorMessage from "../../components/ErrorMessage"
import ConfirmModal from "../../components/ConfirmModal"
import toast from "react-hot-toast"
import { Plus } from "lucide-react"

const VENUE_TYPES = ["GOVERNMENT", "AIDED", "PRIVATE", "UNIVERSITY"]

export default function VenueManagement() {
  const qc = useQueryClient()
  const [selectedExamId, setSelectedExamId] = useState("")
  const [assignModal, setAssignModal] = useState<string | null>(null)
  const [submitConfirm, setSubmitConfirm] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: "", address: "", cityName: "", type: "GOVERNMENT", capacity: "", pincode: "" })

  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get("/api/exams").then((r) => r.data) })

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
      toast.success("Venue added")
      setShowAdd(false)
      setAddForm({ name: "", address: "", cityName: "", type: "GOVERNMENT", capacity: "", pincode: "" })
      qc.invalidateQueries({ queryKey: ["cs-venues"] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to add venue"),
  })

  const assignMut = useMutation({
    mutationFn: (venueId: string) => api.post(`/api/exams/${selectedExamId}/assignments`, { venueId }),
    onSuccess: () => {
      toast.success("Venue assigned to exam")
      setAssignModal(null)
      qc.invalidateQueries({ queryKey: ["cs-assignments", selectedExamId] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to assign"),
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

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Venue Management</h1>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg text-sm">
            <Plus size={14} /> Add Venue
          </button>
        </div>

        {/* Exam selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 shrink-0">Active Exam</label>
          <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm max-w-sm">
            <option value="">— Select exam —</option>
            {(exams ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          {selectedExamId && assignmentList.length > 0 && (
            <button onClick={() => setSubmitConfirm(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium ml-auto">
              Submit All for Review
            </button>
          )}
        </div>

        {/* Venues table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">All Venues</h2>
          </div>
          {venuesLoading && <LoadingSpinner />}
          {venuesError && <ErrorMessage message="Failed to load venues" onRetry={refetchVenues} />}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["Venue Name", "Type", "City", "Capacity", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!venuesLoading && venueList.length === 0
                  ? <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No venues yet. Add your first venue →</td></tr>
                  : venueList.map((v: any) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{v.name}</td>
                      <td className="px-4 py-3 text-xs">{v.type?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3">{v.cityName}</td>
                      <td className="px-4 py-3">{v.capacity?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {assignedVenueIds.has(v.id)
                          ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Assigned</span>
                          : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">Not Assigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        {selectedExamId && !assignedVenueIds.has(v.id) && (
                          <button onClick={() => setAssignModal(v.id)}
                            className="px-2 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded text-xs">
                            Assign to Exam
                          </button>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Exam Assignments</h2>
            </div>
            {assignLoading ? <LoadingSpinner /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>{["Venue", "City", "VS Assigned", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {assignmentList.length === 0
                      ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No venues assigned to this exam yet.</td></tr>
                      : assignmentList.map((a: any) => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{a.venue?.name}</td>
                          <td className="px-4 py-3">{a.venue?.cityName}</td>
                          <td className="px-4 py-3">{a.vs?.name ?? <span className="text-gray-400 text-xs">Not assigned</span>}</td>
                          <td className="px-4 py-3"><StatusBadge status={a.status ?? "PROPOSED"} /></td>
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
            <h3 className="font-semibold mb-4">Add Venue</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name *</label>
                <input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <input value={addForm.address} onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input value={addForm.cityName} onChange={(e) => setAddForm({ ...addForm, cityName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input value={addForm.pincode} onChange={(e) => setAddForm({ ...addForm, pincode: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {VENUE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity *</label>
                  <input type="number" value={addForm.capacity} onChange={(e) => setAddForm({ ...addForm, capacity: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => addVenueMut.mutate()}
                disabled={!addForm.name || !addForm.address || !addForm.cityName || !addForm.capacity || addVenueMut.isPending}
                className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-50">
                {addVenueMut.isPending ? "Adding…" : "Add Venue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to exam confirm */}
      {assignModal && (
        <ConfirmModal
          title="Assign Venue to Exam"
          message={`Assign "${venueList.find((v) => v.id === assignModal)?.name}" to the selected exam?`}
          confirmLabel="Assign"
          onConfirm={() => assignMut.mutate(assignModal!)}
          onCancel={() => setAssignModal(null)}
          loading={assignMut.isPending}
        />
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
