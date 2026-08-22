import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { Plus, Search } from "lucide-react"
import api from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import StatusBadge from "../components/StatusBadge"
import ErrorMessage from "../components/ErrorMessage"
import { Alert } from "../components/ux"

function SkeletonRow() {
  return (
    <tr>{[...Array(7)].map((_, i) => (
      <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
    ))}</tr>
  )
}

export default function ExamList() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const role = user?.role ?? ""
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["exams"],
    queryFn: () => api.get("/api/exams").then((r) => r.data),
  })

  const exams: any[] = (data ?? []).filter((e: any) => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.examCode.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "ALL" || e.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="ux4g-heading-xl-strong">Examinations</h1>
            <p className="text-sm text-gray-500">Showing {exams.length} examination{exams.length !== 1 ? "s" : ""}</p>
          </div>
          {["ASO", "SO"].includes(role) && (
            <button onClick={() => navigate("/exams/create")}
              className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy-light">
              <Plus size={16} /> New Exam
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="ux4g-input">
            <option value="ALL">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_SO">Pending SO</option>
            <option value="PENDING_US">Pending US</option>
            <option value="RELEASED">Released</option>
          </select>
        </div>

        {["SO", "US"].includes(role) && (
          <Alert tone="info">
            To review venue assignments submitted by CS: click <strong>View</strong> on any exam → scroll to <strong>Venue Assignments</strong>.</Alert>
        )}

        {error && <ErrorMessage message="Failed to load exams" onRetry={refetch} />}

        <div className="ux4g-card ux4g-card-solid overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ux4g-table w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["Exam Name", "Code", "Year", "Type", "Scheduled Date", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />) : exams.length === 0
                  ? <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-600">
                      No exams found.{" "}
                      {["ASO", "SO"].includes(role) && (
                        <button onClick={() => navigate("/exams/create")} className="text-navy underline">Create your first exam →</button>
                      )}
                    </td></tr>
                  : exams.map((e: any) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{e.examCode}</td>
                      <td className="px-4 py-3">{e.year}</td>
                      <td className="px-4 py-3">{e.examType}</td>
                      <td className="px-4 py-3">{format(new Date(e.scheduledDate), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/exams/${e.id}`)}
                          className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-sm min-h-[36px]">View</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
