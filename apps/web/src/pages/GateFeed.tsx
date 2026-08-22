import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import api from "../lib/api"
import Layout from "../components/Layout"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"

// Live feed from the physical gate terminal. The Face Auth page is a review
// queue and shows flagged records only; this shows every scan as it lands,
// which is what an invigilator standing at the gate actually needs.

const POLL_MS = 2000

type GateRecord = {
  id: string
  candidateRollNo: string
  matchConfidence: number | null
  matchResult: "MATCH" | "NO_MATCH" | "INCONCLUSIVE" | "NOT_CAPTURED"
  flagged: boolean
  flagReason: string | null
  ingestedAt: string
  caseStatus: string
  venue?: { name: string; cityName: string } | null
}

const RESULT_STYLE: Record<string, string> = {
  MATCH: "bg-green-100 text-green-800 border-green-200",
  NO_MATCH: "bg-red-100 text-red-700 border-red-200",
  INCONCLUSIVE: "bg-orange-100 text-orange-800 border-orange-200",
  NOT_CAPTURED: "bg-gray-100 text-gray-700 border-gray-200",
}

const RESULT_LABEL: Record<string, string> = {
  MATCH: "ADMITTED",
  NO_MATCH: "REFUSED",
  INCONCLUSIVE: "FLAGGED",
  NOT_CAPTURED: "NO READ",
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour12: false })
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 min-w-[110px]">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

export default function GateFeed() {
  const [examId, setExamId] = useState("")
  const [live, setLive] = useState(true)

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: () => api.get("/api/exams").then((r) => r.data),
  })

  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["gate-feed", examId],
    queryFn: () => api.get(`/api/faceauth/records/${examId}`).then((r) => r.data),
    enabled: !!examId,
    refetchInterval: live ? POLL_MS : false,
  })

  const summary = data?.summary ?? { total: 0, matched: 0, flagged: 0, pendingReview: 0 }
  const records: GateRecord[] = data?.records ?? []

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gate Feed</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Live biometric verifications from the entry terminal
            </p>
          </div>
          <button
            onClick={() => setLive((v) => !v)}
            className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              live
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${live ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
            {live ? "LIVE" : "PAUSED"}
          </button>
        </div>

        <div className="flex gap-3 items-center">
          <label className="text-sm font-medium text-gray-700 shrink-0">Select Exam:</label>
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-navy max-w-xs"
          >
            <option value="">— Choose exam —</option>
            {(exams ?? []).map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.examCode})
              </option>
            ))}
          </select>
        </div>

        {!examId && (
          <p className="text-gray-400 text-sm py-10 text-center">
            Select an exam to watch the gate.
          </p>
        )}

        {examId && isLoading && <LoadingSpinner />}
        {examId && error && <ErrorMessage message="Failed to load gate feed" onRetry={refetch} />}

        {examId && data && (
          <>
            <div className="flex gap-3 flex-wrap">
              <Tile label="Scans" value={summary.total} tone="text-gray-900" />
              <Tile label="Admitted" value={summary.matched} tone="text-green-600" />
              <Tile label="Flagged" value={summary.flagged} tone="text-red-600" />
              <Tile label="Awaiting review" value={summary.pendingReview} tone="text-amber-600" />
            </div>

            {records.length === 0 ? (
              <p className="text-gray-400 text-sm py-10 text-center">
                No scans yet. Place an enrolled finger on the terminal.
              </p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Time</th>
                      <th className="text-left px-4 py-2 font-medium">Roll No</th>
                      <th className="text-left px-4 py-2 font-medium">Result</th>
                      <th className="text-left px-4 py-2 font-medium">Confidence</th>
                      <th className="text-left px-4 py-2 font-medium">Venue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r: GateRecord) => (
                      <tr key={r.id} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                          {timeOf(r.ingestedAt)}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-medium text-gray-900">
                          {r.candidateRollNo}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              RESULT_STYLE[r.matchResult] ?? "bg-gray-100 text-gray-700 border-gray-200"
                            }`}
                          >
                            {RESULT_LABEL[r.matchResult] ?? r.matchResult}
                          </span>
                          {r.flagReason && (
                            <div className="text-xs text-gray-400 mt-1">{r.flagReason}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {r.matchConfidence !== null ? `${r.matchConfidence}%` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {r.venue?.name ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {dataUpdatedAt > 0 && (
              <p className="text-xs text-gray-400 text-right">
                Updated {timeOf(new Date(dataUpdatedAt).toISOString())}
              </p>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
