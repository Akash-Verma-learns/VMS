import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import api from "../../lib/api"
import Layout from "../../components/Layout"
import { ClipboardList, Package, FileText, CheckSquare, ExternalLink } from "lucide-react"
import { Alert } from "../../components/ux"

/**
 * Readiness, material tracking and the exam-day report moved to the field app
 * when the operator surfaces were consolidated there. These cards kept pointing
 * at their old paths, which no longer exist in this app — so the router fell
 * through to the catch-all, which redirects to "/", which renders the sign-in
 * screen. Clicking them looked exactly like being signed out, with the session
 * still perfectly valid.
 *
 * They are field tasks done on a phone in a hall, so they stay in the field app
 * rather than being rebuilt here; the cards now open it instead of pretending
 * to be local routes.
 */
const FIELD_APP = import.meta.env.VITE_FIELD_APP_URL ?? "http://localhost:5174"

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
      inFieldApp: true,
      badge: null,
    },
    {
      icon: <Package size={24} className="text-teal-600" />,
      title: "Material Tracking",
      desc: "Confirm receipt and dispatch of exam materials",
      route: "/vs/material",
      inFieldApp: true,
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
      inFieldApp: true,
      badge: null,
    },
  ]

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <h1 className="ux4g-heading-xl-strong">Venue Superintendent Dashboard</h1>

        <Alert tone="info" title="Some tasks open the field app">
          Readiness, material tracking and the exam-day report are filled in on a
          phone at the venue, so they open the field app. Surveys stay here.
        </Alert>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((c) => (
            <button key={c.title}
              onClick={() => {
                if (c.inFieldApp) window.location.href = FIELD_APP + c.route
                else navigate(c.route)
              }}
              className="ux4g-card ux4g-card-solid p-5 text-left hover:border-navy hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                {c.icon}
                {c.inFieldApp && (
                  <span className="flex items-center gap-1 ux4g-label-m-default"
                        style={{ color: "var(--ux4g-color-neutral-600)" }}>
                    <ExternalLink size={13} strokeWidth={2} aria-hidden />
                    Field app
                  </span>
                )}
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
