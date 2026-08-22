import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, formatDistanceToNow } from "date-fns"
import api from "../lib/api"
import { useAuthStore } from "../store/auth"
import Layout from "../components/Layout"
import StatusBadge from "../components/StatusBadge"
import LoadingSpinner from "../components/LoadingSpinner"
import ErrorMessage from "../components/ErrorMessage"
import toast from "react-hot-toast"
import { ArrowLeft, Plus, Trash2, X } from "lucide-react"

type QuestionType = "YES_NO" | "TEXT" | "NUMBER" | "MULTIPLE_CHOICE"
interface Question { id: string; type: QuestionType; text: string; required: boolean; options?: string[] }

function SurveyBuilder({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get("/api/exams").then((r) => r.data) })
  const [form, setForm] = useState({ title: "", examId: "", deadline: "", recipientRoles: [] as string[], cities: [] as string[] })
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)

  function addQ(type: QuestionType) {
    setQuestions([...questions, { id: crypto.randomUUID(), type, text: "", required: false, options: type === "MULTIPLE_CHOICE" ? [""] : undefined }])
  }
  function updateQ(id: string, patch: Partial<Question>) {
    setQuestions(questions.map((q) => q.id === id ? { ...q, ...patch } : q))
  }

  async function dispatch() {
    if (!form.title || !form.deadline || !form.recipientRoles.length || !questions.length) {
      toast.error("Fill all required fields and add at least one question"); return
    }
    setLoading(true)
    try {
      await api.post("/api/surveys", { ...form, examId: form.examId || undefined, questions, deadline: new Date(form.deadline).toISOString() })
      toast.success("Survey dispatched"); qc.invalidateQueries({ queryKey: ["surveys"] }); onClose()
    } catch (e: any) { toast.error(e.response?.data?.error ?? "Failed") } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Create Survey</h3>
          <button onClick={onClose} aria-label="Close"
            className="ux4g-btn ux4g-btn-text-neutral ux4g-btn-sm"><X size={18} strokeWidth={2} aria-hidden /></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Survey Title *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full ux4g-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Response Deadline *</label>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full ux4g-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam (optional)</label>
              <select value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })}
                className="w-full ux4g-input">
                <option value="">None</option>
                {(exams ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recipient Roles *</label>
            <div className="flex gap-3 flex-wrap">
              {["CS", "VS", "IO"].map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.recipientRoles.includes(r)}
                    onChange={(e) => setForm({ ...form, recipientRoles: e.target.checked ? [...form.recipientRoles, r] : form.recipientRoles.filter((x) => x !== r) })} />
                  {r}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Questions</h4>
              <div className="flex gap-2">
                {(["YES_NO", "TEXT", "NUMBER", "MULTIPLE_CHOICE"] as QuestionType[]).map((t) => (
                  <button key={t} onClick={() => addQ(t)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">{t.replace(/_/g, " ")}</button>
                ))}
              </div>
            </div>
            {questions.length === 0 && <p className="text-sm text-neutral-600 py-4 text-center border-2 border-dashed border-gray-200 rounded-lg">Add questions using the buttons above.</p>}
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={q.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-4">{i + 1}.</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{q.type.replace(/_/g, " ")}</span>
                    <input value={q.text} onChange={(e) => updateQ(q.id, { text: e.target.value })} placeholder="Question text…"
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm" />
                    <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={q.required} onChange={(e) => updateQ(q.id, { required: e.target.checked })} /> Required
                    </label>
                    <button onClick={() => setQuestions(questions.filter((x) => x.id !== q.id))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                  {q.type === "MULTIPLE_CHOICE" && (
                    <div className="pl-6 space-y-1">
                      {(q.options ?? []).map((opt, oi) => (
                        <div key={oi} className="flex gap-2">
                          <input value={opt} onChange={(e) => { const o = [...(q.options ?? [])]; o[oi] = e.target.value; updateQ(q.id, { options: o }) }}
                            placeholder={`Option ${oi + 1}`} className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
                        </div>
                      ))}
                      <button onClick={() => updateQ(q.id, { options: [...(q.options ?? []), ""] })} className="text-xs text-navy underline">+ Add option</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
          <button onClick={dispatch} disabled={loading}
            className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-50">
            {loading ? "Dispatching…" : "Dispatch Survey"}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatsModal({ surveyId, onClose }: { surveyId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["survey-stats", surveyId],
    queryFn: () => api.get(`/api/surveys/${surveyId}/stats`).then((r) => r.data),
  })
  const remindMut = useMutation({
    mutationFn: () => api.post(`/api/surveys/${surveyId}/remind`),
    onSuccess: (res) => toast.success(`${res.data.reminded} reminders sent`),
  })
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold">Survey Results</h3>
          <button onClick={onClose} aria-label="Close"
            className="ux4g-btn ux4g-btn-text-neutral ux4g-btn-sm"><X size={18} strokeWidth={2} aria-hidden /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          {isLoading ? <LoadingSpinner /> : <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded p-3"><div className="text-xl font-bold">{data?.totalRecipients}</div><div className="text-xs text-gray-500">Recipients</div></div>
              <div className="bg-gray-50 rounded p-3"><div className="text-xl font-bold">{data?.totalResponses}</div><div className="text-xs text-gray-500">Responses</div></div>
              <div className="bg-gray-50 rounded p-3"><div className="text-xl font-bold">{data?.responseRate}%</div><div className="text-xs text-gray-500">Response Rate</div></div>
            </div>
            {Object.entries(data?.questionAggregation ?? {}).map(([key, values]: any) => (
              <div key={key} className="border border-gray-100 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700 mb-2">{key}</p>
                <p className="text-xs text-gray-500">{Array.isArray(values) ? values.join(", ") : String(values)}</p>
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => remindMut.mutate()} disabled={remindMut.isPending}
                className="px-4 py-2 bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-sm hover:bg-amber-200 disabled:opacity-50">
                {remindMut.isPending ? "Sending…" : "Send Reminders"}
              </button>
              <a href={`/api/surveys/${surveyId}/export?format=json`} target="_blank" rel="noreferrer"
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Export JSON</a>
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}

// Respond view for CS/VS/IO
function MySurveys() {
  const [active, setActive] = useState<any>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-surveys"],
    queryFn: () => api.get("/api/surveys/my").then((r) => r.data),
  })

  async function submitResponse(isDraft: boolean) {
    setSubmitting(true)
    try {
      await api.post(`/api/surveys/${active.id}/respond`, { answers, isDraft })
      toast.success(isDraft ? "Draft saved" : "Response submitted")
      if (!isDraft) { setActive(null); qc.invalidateQueries({ queryKey: ["my-surveys"] }) }
    } catch (e: any) { toast.error("Failed to submit") } finally { setSubmitting(false) }
  }

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message="Failed to load surveys" onRetry={refetch} />

  if (active) {
    const questions: Question[] = active.questions ?? []
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setActive(null)}
            className="ux4g-btn ux4g-btn-text-neutral ux4g-btn-sm inline-flex items-center gap-1.5">
            <ArrowLeft size={16} strokeWidth={2} aria-hidden /> Back</button>
          <h2 className="text-lg font-semibold text-gray-900">{active.title}</h2>
        </div>
        <p className="text-sm text-gray-500">Deadline: {format(new Date(active.deadline), "dd MMM yyyy")}</p>
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id ?? i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm font-medium mb-3">{i + 1}. {q.text} {q.required && <span className="text-red-500">*</span>}</p>
              {q.type === "YES_NO" && (
                <div className="flex gap-4">
                  {["Yes", "No"].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" name={q.id} checked={answers[q.text] === opt} onChange={() => setAnswers({ ...answers, [q.text]: opt })} />{opt}
                    </label>
                  ))}
                </div>
              )}
              {q.type === "TEXT" && <textarea rows={3} value={answers[q.text] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.text]: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />}
              {q.type === "NUMBER" && <input type="number" value={answers[q.text] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.text]: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />}
              {q.type === "MULTIPLE_CHOICE" && (q.options ?? []).map((opt) => (
                <label key={opt} className="flex items-center gap-2 mb-1 text-sm cursor-pointer">
                  <input type="checkbox" checked={(answers[q.text] ?? []).includes(opt)}
                    onChange={(e) => {
                      const prev = answers[q.text] ?? []
                      setAnswers({ ...answers, [q.text]: e.target.checked ? [...prev, opt] : prev.filter((x: string) => x !== opt) })
                    }} />{opt}
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => submitResponse(true)} disabled={submitting} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Save Draft</button>
          <button onClick={() => submitResponse(false)} disabled={submitting} className="px-6 py-2 bg-navy text-white rounded-lg text-sm">Submit Response</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">My Surveys</h1>
      {(data ?? []).length === 0 && <p className="text-neutral-600 py-8 text-center">No surveys assigned to you.</p>}
      {(data ?? []).map((s: any) => (
        <div key={s.id} className="ux4g-card ux4g-card-solid p-5 flex justify-between items-start">
          <div>
            <h3 className="font-medium text-gray-900">{s.title}</h3>
            <p className="text-xs text-neutral-600 mt-1">Deadline: {formatDistanceToNow(new Date(s.deadline), { addSuffix: true })}</p>
            {s.responses?.length > 0 && <p className="text-xs text-green-600 mt-1">Draft saved</p>}
          </div>
          <button onClick={() => { setActive(s); setAnswers(s.responses?.[0]?.answers ?? {}) }}
            className="px-4 py-2 bg-navy text-white rounded-lg text-sm shrink-0">
            {s.responses?.length ? "Continue" : "Respond"}
          </button>
        </div>
      ))}
    </div>
  )
}

export default function Surveys() {
  const { user } = useAuthStore()
  const role = user?.role ?? ""
  const canViewList = ["US", "SO", "DS", "JS"].includes(role)
  const isCreator = ["US", "SO"].includes(role)
  const isRespondent = ["CS", "VS", "IO"].includes(role)
  const [showCreate, setShowCreate] = useState(false)
  const [statsId, setStatsId] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["surveys"],
    queryFn: () => api.get("/api/surveys").then((r) => r.data),
    enabled: canViewList,
  })

  if (isRespondent) return <Layout><MySurveys /></Layout>

  if (!canViewList) return (
    <Layout>
      <div className="max-w-xl mx-auto mt-16 text-center text-neutral-600">
        <p className="text-lg font-medium">Surveys</p>
        <p className="text-sm mt-2">Surveys are managed by US/SO and responded to by CS/VS/IO.</p>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Surveys</h1>
          {isCreator && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg text-sm hover:bg-navy-light">
              <Plus size={16} /> Create Survey
            </button>
          )}
        </div>

        {isLoading && <LoadingSpinner />}
        {error && <ErrorMessage message="Failed to load surveys" onRetry={refetch} />}

        <div className="ux4g-card ux4g-card-solid overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ux4g-table w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["Title", "Deadline", "Status", "Responses", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!isLoading && (data ?? []).length === 0
                  ? <tr><td colSpan={5} className="px-4 py-12 text-center text-neutral-600">No surveys yet. Create your first survey →</td></tr>
                  : (data ?? []).map((s: any) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.title}</td>
                      <td className="px-4 py-3 text-gray-500">{format(new Date(s.deadline), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3">{s._count?.responses ?? 0}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setStatsId(s.id)} className="px-3 py-1 border border-gray-200 rounded text-xs hover:bg-gray-50">View Responses</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showCreate && <SurveyBuilder onClose={() => setShowCreate(false)} />}
      {statsId && <StatsModal surveyId={statsId} onClose={() => setStatsId(null)} />}
    </Layout>
  )
}
