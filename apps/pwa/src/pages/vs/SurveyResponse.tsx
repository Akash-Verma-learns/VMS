import { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import api from "../../lib/api"
import { db } from "../../db/offline"
import PWALayout from "../../components/PWALayout"
import { useAuthStore } from "../../store/auth"
import BottomNav from "../../components/BottomNav"
import { navFor } from "../gate/GateNav"
import toast from "react-hot-toast"
import { v4 as uuid } from "uuid"
import { ClipboardList } from "lucide-react"


export default function SurveyResponse() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [activeSurvey, setActiveSurvey] = useState<any>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: surveys, isLoading } = useQuery({
    queryKey: ["my-surveys"],
    queryFn: () => api.get("/api/surveys/my").then((r) => r.data),
  })

  useEffect(() => {
    if (!activeSurvey) return
    if (autoSaveTimer.current) clearInterval(autoSaveTimer.current)
    autoSaveTimer.current = setInterval(async () => {
      await db.surveyDrafts.put({ id: activeSurvey.id, surveyId: activeSurvey.id, answers, savedAt: Date.now() })
    }, 30_000)
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current) }
  }, [activeSurvey, answers])

  async function openSurvey(s: any) {
    const draft = await db.surveyDrafts.get(s.id)
    setAnswers(draft?.answers ?? s.responses?.[0]?.answers ?? {})
    setActiveSurvey(s)
  }

  async function submit(isDraft: boolean) {
    setSubmitting(true)
    const payload = { answers, isDraft, surveyId: activeSurvey.id }
    try {
      if (navigator.onLine) {
        await api.post(`/api/surveys/${activeSurvey.id}/respond`, { answers, isDraft })
        if (!isDraft) {
          toast.success("Response submitted")
          setActiveSurvey(null)
          qc.invalidateQueries({ queryKey: ["my-surveys"] })
          await db.surveyDrafts.delete(activeSurvey.id)
        } else toast.success("Draft saved")
      } else {
        await db.surveyDrafts.put({ id: activeSurvey.id, surveyId: activeSurvey.id, answers, savedAt: Date.now() })
        if (!isDraft) {
          await db.pendingSync.add({ id: uuid(), type: "survey", payload, status: "pending", createdAt: Date.now() })
          toast.success("Saved offline — will sync when connected")
          setActiveSurvey(null)
        } else toast.success("Draft saved offline")
      }
    } catch { toast.error("Failed to save") } finally { setSubmitting(false) }
  }

  if (activeSurvey) {
    const questions = activeSurvey.questions ?? []
    return (
      <>
        <PWALayout title={activeSurvey.title} back="/vs/survey">
          <div className="p-4 space-y-4">
            <p className="text-xs text-gray-500">Auto-saves every 30s · {questions.length} questions</p>
            {questions.map((q: any, i: number) => (
              <div key={q.id ?? i} className="ux4g-card ux4g-card-solid p-4">
                <p className="text-sm font-medium mb-3">{i + 1}. {q.text} {q.required && <span className="text-red-400">*</span>}</p>
                {q.type === "YES_NO" && ["Yes", "No"].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 mb-2 text-sm cursor-pointer">
                    <input type="radio" className="w-5 h-5 shrink-0" name={q.text} checked={answers[q.text] === opt} onChange={() => setAnswers({ ...answers, [q.text]: opt })} />
                    {opt}
                  </label>
                ))}
                {q.type === "TEXT" && <textarea rows={3} value={answers[q.text] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.text]: e.target.value })} className="w-full ux4g-input" />}
                {q.type === "NUMBER" && <input type="number" inputMode="numeric" value={answers[q.text] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.text]: e.target.value })} className="w-full ux4g-input" />}
                {q.type === "MULTIPLE_CHOICE" && (q.options ?? []).map((opt: string) => (
                  <label key={opt} className="flex items-center gap-2 mb-1 text-sm cursor-pointer">
                    <input type="checkbox" checked={(answers[q.text] ?? []).includes(opt)}
                      onChange={(e) => {
                        const prev = answers[q.text] ?? []
                        setAnswers({ ...answers, [q.text]: e.target.checked ? [...prev, opt] : prev.filter((x: string) => x !== opt) })
                      }} />
                    {opt}
                  </label>
                ))}
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => submit(true)} disabled={submitting} className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-lg flex-1 min-h-[48px]">Save Draft</button>
              <button onClick={() => submit(false)} disabled={submitting} className="ux4g-btn ux4g-btn-primary ux4g-btn-lg flex-1 min-h-[48px]">
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </PWALayout>
        <BottomNav items={navFor(user?.role)} />
      </>
    )
  }

  return (
    <>
      <PWALayout title="Surveys">
        <div className="p-4 space-y-3">
          {isLoading && <p className="text-center text-neutral-600 py-8">Loading surveys…</p>}
          {!isLoading && (surveys ?? []).length === 0 && (
            <div className="text-center py-12 text-neutral-600">
              <ClipboardList size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No surveys assigned to you.</p>
            </div>
          )}
          {(surveys ?? []).map((s: any) => (
            <div key={s.id} className="ux4g-card ux4g-card-solid p-4">
              <h3 className="font-medium text-gray-900 text-sm">{s.title}</h3>
              <p className="text-xs text-neutral-600 mt-1">Deadline: {new Date(s.deadline).toLocaleDateString("en-IN")}</p>
              {s.responses?.length > 0 && <p className="text-xs text-green-600 mt-1">Draft saved</p>}
              <button onClick={() => openSurvey(s)}
                className="mt-3 w-full py-2 bg-navy text-white rounded-lg text-sm font-medium">
                {s.responses?.length ? "Continue" : "Respond"}
              </button>
            </div>
          ))}
        </div>
      </PWALayout>
      <BottomNav items={navFor(user?.role)} />
    </>
  )
}
