import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import api from "../lib/api"
import Layout from "../components/Layout"
import LoadingSpinner from "../components/LoadingSpinner"
import { Users } from "lucide-react"

export default function CandidatePreferences() {
  const [examCode, setExamCode] = useState("")
  const [activeCode, setActiveCode] = useState("")
  const [view, setView] = useState<"list" | "summary">("summary")

  const { data: preferences, isLoading: prefLoading, error: prefError } = useQuery({
    queryKey: ["candidate-prefs", activeCode],
    queryFn: () => api.get(`/api/candidates/preferences?examCode=${activeCode}`).then((r) => r.data),
    enabled: !!activeCode,
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["candidate-prefs-summary", activeCode],
    queryFn: () => api.get(`/api/candidates/preferences/summary?examCode=${activeCode}`).then((r) => r.data),
    enabled: !!activeCode,
  })

  function handleLoad() {
    const code = examCode.trim().toUpperCase()
    if (!code) return
    setActiveCode(code)
  }

  const prefList: any[] = preferences ?? []
  const cityDemand: any[] = summary?.cityDemand ?? []

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Users size={22} className="text-navy" />
          <h1 className="text-xl font-bold text-gray-900">Candidate City Preferences</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
          <p className="text-xs text-gray-500">
            Enter the exam code to view candidate city priority submissions for that exam.
          </p>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 shrink-0">Exam Code</label>
            <input
              value={examCode}
              onChange={(e) => setExamCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLoad()}
              placeholder="e.g. UPSC-CSP-2025"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm max-w-xs"
            />
            <button onClick={handleLoad} disabled={!examCode.trim()}
              className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-40">
              Load
            </button>
          </div>
          {activeCode && summary && (
            <p className="text-xs text-teal-700 font-medium">
              {summary.totalCandidates} candidate(s) have submitted preferences for {activeCode}.
            </p>
          )}
        </div>

        {activeCode && (
          <>
            {/* View toggle */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
              <button onClick={() => setView("summary")}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${view === "summary" ? "bg-white shadow text-navy" : "text-gray-500 hover:text-gray-700"}`}>
                City Demand Summary
              </button>
              <button onClick={() => setView("list")}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${view === "list" ? "bg-white shadow text-navy" : "text-gray-500 hover:text-gray-700"}`}>
                All Submissions ({prefList.length})
              </button>
            </div>

            {/* City demand summary */}
            {view === "summary" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-700">City Demand by Priority</h2>
                  <p className="text-xs text-gray-400 mt-0.5">P1 = first choice. Use this to calibrate venue seat allocation per city.</p>
                </div>
                {summaryLoading ? <LoadingSpinner /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>{["City", "P1 (1st choice)", "P2", "P3", "P4", "P5", "Total Mentions"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cityDemand.length === 0
                          ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No data yet.</td></tr>
                          : cityDemand.map((c: any) => (
                            <tr key={c.city} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium">{c.city}</td>
                              <td className="px-4 py-3">
                                <span className="font-bold text-navy">{c.p1}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{c.p2}</td>
                              <td className="px-4 py-3 text-gray-500">{c.p3}</td>
                              <td className="px-4 py-3 text-gray-400">{c.p4}</td>
                              <td className="px-4 py-3 text-gray-400">{c.p5}</td>
                              <td className="px-4 py-3 font-medium text-gray-700">{c.total}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Full list */}
            {view === "list" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-700">Individual Submissions</h2>
                </div>
                {prefLoading ? <LoadingSpinner /> : prefError ? (
                  <p className="px-5 py-8 text-center text-red-500 text-sm">Failed to load preferences.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>{["Roll No", "Candidate Name", "Priority 1", "Priority 2", "Priority 3", "Priority 4", "Priority 5", "Submitted"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {prefList.length === 0
                          ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No submissions yet.</td></tr>
                          : prefList.map((p: any) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-mono font-medium">{p.rollNo}</td>
                              <td className="px-4 py-3">{p.candidateName ?? <span className="text-gray-400 text-xs">—</span>}</td>
                              <td className="px-4 py-3 font-medium text-navy">{p.priority1}</td>
                              <td className="px-4 py-3">{p.priority2 ?? "—"}</td>
                              <td className="px-4 py-3">{p.priority3 ?? "—"}</td>
                              <td className="px-4 py-3">{p.priority4 ?? "—"}</td>
                              <td className="px-4 py-3">{p.priority5 ?? "—"}</td>
                              <td className="px-4 py-3 text-xs text-gray-400">
                                {new Date(p.submittedAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
