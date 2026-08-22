import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import api from "../../lib/api"
import Layout from "../../components/Layout"
import LoadingSpinner from "../../components/LoadingSpinner"
import ErrorMessage from "../../components/ErrorMessage"
import { CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react"

export default function CSDashboard() {
  const { data: venues, isLoading: vLoading, error: vError, refetch: vRefetch } = useQuery({
    queryKey: ["cs-venues"],
    queryFn: () => api.get("/api/venues").then((r) => r.data),
  })

  const { data: allAssignments } = useQuery({
    queryKey: ["cs-my-assignments"],
    queryFn: () => api.get("/api/exams/assignments/mine").then((r) => r.data),
  })

  const { data: surveys } = useQuery({
    queryKey: ["my-surveys"],
    queryFn: () => api.get("/api/surveys/my").then((r) => r.data),
  })

  const venueList: any[] = venues ?? []
  const assignmentList: any[] = allAssignments ?? []
  const pendingSurveys = (surveys ?? []).filter((s: any) => !s.responses?.length)

  const rejectedAssignments = assignmentList.filter((a: any) => a.status === "REJECTED")
  const rejectedVenues = venueList.filter((v: any) => v.approvalStatus === "REJECTED")
  const pendingVenues = venueList.filter((v: any) => v.approvalStatus === "PENDING_APPROVAL")
  const approvedVenues = venueList.filter((v: any) => v.approvalStatus === "APPROVED")

  const totalRejections = rejectedAssignments.length + rejectedVenues.length

  const stats = [
    { label: "Approved Venues", value: approvedVenues.length, icon: <CheckCircle size={20} />, color: "text-teal-600" },
    { label: "Pending SO Approval", value: pendingVenues.length, icon: <Clock size={20} />, color: pendingVenues.length > 0 ? "text-amber-500" : "text-neutral-600" },
    { label: "Action Required", value: totalRejections + pendingSurveys.length, icon: <AlertTriangle size={20} />, color: totalRejections + pendingSurveys.length > 0 ? "text-red-500" : "text-neutral-600" },
  ]

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <h1 className="ux4g-heading-xl-strong">Centre Superintendent Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="ux4g-card ux4g-card-solid p-4 flex items-center gap-3">
              <span className={s.color}>{s.icon}</span>
              <div>
                <div className="ux4g-heading-xl-strong">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ---- REJECTIONS PANEL ---- */}
        {(rejectedAssignments.length > 0 || rejectedVenues.length > 0) && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <XCircle size={18} className="text-red-600 shrink-0" />
              <h2 className="text-sm font-semibold text-red-800">
                {totalRejections} item{totalRejections > 1 ? "s" : ""} rejected — review and resubmit
              </h2>
            </div>

            {rejectedVenues.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Rejected Venues (SO)</p>
                {rejectedVenues.map((v: any) => (
                  <div key={v.id} className="bg-white border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-gray-900">{v.name} <span className="text-neutral-600 text-xs">· {v.cityName}</span></p>
                    {v.rejectionNote && (
                      <p className="text-xs text-red-600 mt-0.5">SO note: "{v.rejectionNote}"</p>
                    )}
                    <Link to="/cs/venues" className="text-xs text-navy underline mt-1 inline-block">
                      Go to My Venues to resubmit →
                    </Link>
                  </div>
                ))}
              </div>
            )}

            {rejectedAssignments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Rejected Exam Assignments</p>
                {rejectedAssignments.map((a: any) => (
                  <div key={a.id} className="bg-white border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-gray-900">
                      {a.venue?.name}
                      <span className="text-neutral-600 text-xs ml-2">· {a.exam?.examCode}</span>
                    </p>
                    {a.rejectionComment && (
                      <p className="text-xs text-red-600 mt-0.5">Reason: "{a.rejectionComment}"</p>
                    )}
                    <Link to="/cs/venues" className="text-xs text-navy underline mt-1 inline-block">
                      Go to My Venues to reassign →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Surveys action */}
        {pendingSurveys.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-800">Action Required — Surveys</h3>
            </div>
            <p className="text-sm text-amber-700">{pendingSurveys.length} survey{pendingSurveys.length > 1 ? "s" : ""} pending your response.</p>
          </div>
        )}

        {/* Venues list */}
        <div className="ux4g-card ux4g-card-solid">
          <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm">My Venues</div>
          {vLoading ? <LoadingSpinner /> : vError ? <ErrorMessage message="Could not load venues" onRetry={vRefetch} /> : (
            <div className="divide-y divide-gray-50">
              {venueList.length === 0
                ? <p className="px-5 py-8 text-center text-neutral-600 text-sm">No venues yet. Go to My Venues to add one.</p>
                : venueList.map((v: any) => (
                  <div key={v.id} className="px-5 py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{v.name}</p>
                      <p className="text-xs text-neutral-600">{v.cityName} · {v.address}</p>
                      {v.approvalStatus === "REJECTED" && v.rejectionNote && (
                        <p className="text-xs text-red-500 mt-0.5">Rejected: "{v.rejectionNote}"</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      v.approvalStatus === "APPROVED" ? "bg-green-100 text-green-700" :
                      v.approvalStatus === "REJECTED" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {v.approvalStatus === "PENDING_APPROVAL" ? "Awaiting SO" : v.approvalStatus}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
