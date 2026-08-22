import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import api from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import FindingList, { type Finding } from "../components/FindingList"

// MOD-14 — seat allotment and admit card release.
// ASO/SO prepare the allotment; US publishes it. Those are the same
// authorities that create and release the exam itself.

export default function AdmitCards() {
  const { user } = useAuthStore()
  const role = user?.role ?? ""
  const canAllocate = ["ASO", "SO"].includes(role)
  const canRelease = role === "US"
  const qc = useQueryClient()

  const [examId, setExamId] = useState("")
  const [filter, setFilter] = useState("")

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: () => api.get("/api/exams").then((r) => r.data),
  })

  // Runs alongside the roll so problems are visible at the moment you would
  // click the buttons they block, rather than after the fact.
  const { data: check, refetch: recheck } = useQuery({
    queryKey: ["data-check", examId],
    queryFn: () => api.get(`/api/admit-cards/${examId}/data-check`).then((r) => r.data),
    enabled: !!examId,
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admit-cards", examId, filter],
    queryFn: () =>
      api.get(`/api/admit-cards/${examId}`, { params: filter ? { q: filter } : {} })
        .then((r) => r.data),
    enabled: !!examId,
  })

  const allocate = useMutation({
    mutationFn: () => api.post(`/api/admit-cards/${examId}/allocate`),
    onSuccess: (r) => {
      const s = r.data
      toast.success(`Allotted ${s.allotted} of ${s.total}`)
      qc.invalidateQueries({ queryKey: ["admit-cards", examId] })
      recheck()
    },
    onError: (e: any) => {
      const d = e.response?.data
      if (d?.blockers?.length) {
        toast.error(`Blocked: ${d.blockers[0].title}`)
        recheck()
        return
      }
      toast.error(d?.error ?? "Allotment failed")
    },
  })

  const release = useMutation({
    mutationFn: (force: boolean) =>
      api.post(`/api/admit-cards/${examId}/release`, { force }),
    onSuccess: (r) => {
      toast.success(`Released ${r.data.released} admit cards`)
      qc.invalidateQueries({ queryKey: ["admit-cards", examId] })
      recheck()
    },
    onError: (e: any) => {
      const d = e.response?.data
      if (d?.blockers?.length) {
        toast.error(`Blocked: ${d.blockers[0].title}`)
        recheck()
        return
      }
      if (d?.unallotted) {
        if (confirm(`${d.unallotted} candidate(s) have no venue. Release the rest anyway?`)) {
          release.mutate(true)
          return
        }
      }
      toast.error(d?.error ?? "Release failed")
    },
  })

  const records = data?.records ?? []
  const summary = data?.summary ?? { draft: 0, released: 0 }
  const unallotted = records.filter((r: any) => !r.venueId).length

  const rankLabel = (n: number | null) =>
    n === null ? "—" : n === 1 ? "1st choice" : n === 2 ? "2nd choice" : `${n}th choice`

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admit Cards</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Seats are allotted from each candidate's city preferences, then released for download.
          </p>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <select value={examId} onChange={(e) => setExamId(e.target.value)}
            className="ux4g-input max-w-xs">
            <option value="">— Choose exam —</option>
            {(exams ?? []).map((e: any) => (
              <option key={e.id} value={e.id}>{e.name} ({e.examCode})</option>
            ))}
          </select>

          {examId && (
            <>
              <button onClick={() => allocate.mutate()}
                disabled={!canAllocate || allocate.isPending}
                title={canAllocate ? undefined : "Only ASO or SO can run the allotment"}
                className="ux4g-btn ux4g-btn-primary ux4g-btn-sm">
                {allocate.isPending ? "Allotting…" : "Run allotment"}
              </button>
              <button onClick={() => release.mutate(false)}
                disabled={!canRelease || release.isPending || summary.draft === 0}
                title={canRelease ? undefined : "Only US can release admit cards"}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-green-600 text-green-700 disabled:opacity-40">
                {release.isPending ? "Releasing…" : `Release ${summary.draft || ""}`}
              </button>
            </>
          )}
        </div>

        {!examId && (
          <p className="text-sm py-10 text-center" style={{ color: "var(--ux4g-color-neutral-600)" }}>
            Select an exam to allot seats and release admit cards.
          </p>
        )}

        {examId && isLoading && <LoadingSpinner />}
        {examId && error && <ErrorMessage message="Failed to load allotments" onRetry={refetch} />}

        {examId && check && (
          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Data completeness check
              </h2>
              <span className="text-xs" style={{ color: "var(--ux4g-color-neutral-600)" }}>
                {check.inspected.candidates} candidates · {check.inspected.venues} venues ·{" "}
                {check.inspected.seats} seats · {check.inspected.allocations} allotments
              </span>
            </div>
            {check.blockers > 0 && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {check.blockers} blocker{check.blockers > 1 ? "s" : ""} must be cleared before
                allotment or release will run.
              </p>
            )}
            <FindingList findings={(check.findings ?? []) as Finding[]} />
          </section>
        )}

        {examId && data && (
          <>
            <div className="flex gap-3 flex-wrap">
              {[
                { label: "Draft", value: summary.draft, tone: "text-amber-600" },
                { label: "Released", value: summary.released, tone: "text-green-600" },
                { label: "No venue", value: unallotted, tone: unallotted ? "text-red-600" : "text-neutral-600" },
              ].map((t) => (
                <div key={t.label} className="ux4g-card ux4g-card-solid px-4 py-3 flex-1 min-w-[120px]">
                  <div className={`text-2xl font-bold ${t.tone}`}>{t.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.label}</div>
                </div>
              ))}
            </div>

            <input value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by roll number or name"
              className="ux4g-input w-full max-w-sm" />

            {records.length === 0 ? (
              <p className="text-sm py-10 text-center" style={{ color: "var(--ux4g-color-neutral-600)" }}>
                No allotments yet. Run the allotment to generate them.
              </p>
            ) : (
              <div className="ux4g-card ux4g-card-solid overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Roll No</th>
                      <th className="text-left px-4 py-2 font-medium">Candidate</th>
                      <th className="text-left px-4 py-2 font-medium">Venue</th>
                      <th className="text-left px-4 py-2 font-medium">Seat</th>
                      <th className="text-left px-4 py-2 font-medium">Got</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r: any) => (
                      <tr key={r.id} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 font-mono font-medium">{r.rollNo}</td>
                        <td className="px-4 py-2.5 text-gray-700">{r.candidateName ?? "—"}</td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {r.venue
                            ? <>{r.venue.name} <span style={{ color: "var(--ux4g-color-neutral-600)" }}>· {r.venue.cityName}</span></>
                            : <span className="text-red-600">No venue</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono">{r.seatNo ?? "—"}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{rankLabel(r.preferenceRank)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.status === "RELEASED"
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800"}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
