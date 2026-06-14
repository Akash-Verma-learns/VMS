import { useQuery, useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import api from "../../lib/api"
import { useAuthStore } from "../../store/auth"
import Layout from "../../components/Layout"
import StatusBadge from "../../components/StatusBadge"
import LoadingSpinner from "../../components/LoadingSpinner"
import ErrorMessage from "../../components/ErrorMessage"
import toast from "react-hot-toast"
import { AlertCircle, CheckCircle, Clock, Send } from "lucide-react"

export default function CSDashboard() {
  const { user } = useAuthStore()
  const [contactModal, setContactModal] = useState(false)
  const [msg, setMsg] = useState("")

  const { data: venues, isLoading: vLoading, error: vError, refetch: vRefetch } = useQuery({
    queryKey: ["cs-venues"],
    queryFn: () => api.get("/api/venues/my").then((r) => r.data),
  })
  const { data: fals } = useQuery({
    queryKey: ["cs-fals"],
    queryFn: () => api.get("/api/fal").then((r) => r.data),
  })
  const { data: surveys } = useQuery({
    queryKey: ["my-surveys"],
    queryFn: () => api.get("/api/surveys/my").then((r) => r.data),
  })

  const contactMut = useMutation({
    mutationFn: () => api.post("/api/contact/so", { message: msg, fromUserId: user?.id }),
    onSuccess: () => { toast.success("Message sent to SO"); setContactModal(false); setMsg("") },
    onError: () => toast.error("Failed to send message"),
  })

  const venueList: any[] = venues ?? []
  const pendingFALs = (fals ?? []).filter((f: any) => f.status === "ISSUED")
  const pendingSurveys = (surveys ?? []).filter((s: any) => !s.responses?.length)

  const stats = [
    { label: "My Venues", value: venueList.length, icon: <CheckCircle size={20} />, color: "text-teal-600" },
    { label: "Pending FALs", value: pendingFALs.length, icon: <AlertCircle size={20} />, color: pendingFALs.length > 0 ? "text-amber-600" : "text-gray-400" },
    { label: "Surveys Pending", value: pendingSurveys.length, icon: <Clock size={20} />, color: pendingSurveys.length > 0 ? "text-red-500" : "text-gray-400" },
  ]

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Centre Superintendent Dashboard</h1>
          <button onClick={() => setContactModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Send size={14} /> Contact SO
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
              <span className={s.color}>{s.icon}</span>
              <div><div className="text-xl font-bold text-gray-900">{s.value}</div><div className="text-xs text-gray-500">{s.label}</div></div>
            </div>
          ))}
        </div>

        {/* Venues */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm">My Venues</div>
          {vLoading ? <LoadingSpinner /> : vError ? <ErrorMessage message="Could not load venues" onRetry={vRefetch} /> : (
            <div className="divide-y divide-gray-50">
              {venueList.length === 0
                ? <p className="px-5 py-8 text-center text-gray-400 text-sm">No venues assigned to you yet.</p>
                : venueList.map((v: any) => (
                  <div key={v.id} className="px-5 py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{v.name}</p>
                      <p className="text-xs text-gray-400">{v.cityName} · {v.address}</p>
                    </div>
                    <StatusBadge status={v.status ?? "REGISTERED"} />
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Action items */}
        {(pendingFALs.length > 0 || pendingSurveys.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-3">Action Required</h3>
            <div className="space-y-2">
              {pendingFALs.map((f: any) => (
                <div key={f.id} className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertCircle size={14} />
                  FAL {f.falNumber} is awaiting your acknowledgement — issued {formatDistanceToNow(new Date(f.issuedAt), { addSuffix: true })}
                </div>
              ))}
              {pendingSurveys.map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 text-sm text-amber-700">
                  <Clock size={14} />
                  Survey "{s.title}" pending response — deadline {formatDistanceToNow(new Date(s.deadline), { addSuffix: true })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {contactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-4">Contact Section Officer</h3>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={5}
              placeholder="Enter your message to the Section Officer…" className="w-full border border-gray-300 rounded-lg p-3 text-sm" />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => setContactModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => contactMut.mutate()} disabled={!msg || contactMut.isPending}
                className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-50">
                {contactMut.isPending ? "Sending…" : "Send Message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
