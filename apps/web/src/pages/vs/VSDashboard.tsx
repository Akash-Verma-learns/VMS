import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import api from "../../lib/api"
import Layout from "../../components/Layout"
import { ClipboardList, Package, FileText, CheckSquare } from "lucide-react"

export default function VSDashboard() {
  const navigate = useNavigate()

  const { data: surveys } = useQuery({
    queryKey: ["my-surveys"],
    queryFn: () => api.get("/api/surveys/my").then((r) => r.data),
  })

  const pendingSurveys = (surveys ?? []).filter((s: any) => !s.responses?.length)

  const cards = [
    {
      icon: <ClipboardList size={24} className="text-navy" />,
      title: "Readiness Checklist",
      desc: "Submit pre-exam readiness for your venue",
      route: "/vs/readiness",
      badge: null,
    },
    {
      icon: <Package size={24} className="text-teal-600" />,
      title: "Material Tracking",
      desc: "Confirm receipt and dispatch of exam materials",
      route: "/vs/material",
      badge: null,
    },
    {
      icon: <FileText size={24} className="text-amber-500" />,
      title: "Surveys",
      desc: "Respond to pending survey questionnaires",
      route: "/surveys",
      badge: pendingSurveys.length > 0 ? pendingSurveys.length : null,
    },
    {
      icon: <CheckSquare size={24} className="text-indigo-500" />,
      title: "Exam Day Report",
      desc: "Submit exam-day checkpoints and session reports",
      route: "/vs/exam-day",
      badge: null,
    },
  ]

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <h1 className="text-xl font-bold text-gray-900">Venue Superintendent Dashboard</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((c) => (
            <button key={c.title} onClick={() => navigate(c.route)}
              className="ux4g-card ux4g-card-solid p-5 text-left hover:border-navy hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                {c.icon}
                {c.badge != null && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{c.badge}</span>
                )}
              </div>
              <p className="font-semibold text-gray-900 group-hover:text-navy">{c.title}</p>
              <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </Layout>
  )
}
