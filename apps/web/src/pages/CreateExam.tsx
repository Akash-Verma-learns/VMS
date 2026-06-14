import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { X, ChevronRight, ChevronLeft } from "lucide-react"
import api from "../lib/api"
import Layout from "../components/Layout"
import toast from "react-hot-toast"

const STEPS = ["Exam Details", "Sessions", "Centres", "Review"]

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center flex-1">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 ${i < current ? "bg-green-500 text-white" : i === current ? "bg-navy text-white" : "bg-gray-200 text-gray-500"}`}>
            {i < current ? "✓" : i + 1}
          </div>
          <div className={`text-xs ml-1 hidden sm:block ${i === current ? "text-navy font-medium" : "text-gray-400"}`}>{s}</div>
          {i < STEPS.length - 1 && <div className="flex-1 h-0.5 mx-2 bg-gray-200"><div className={`h-full bg-navy transition-all ${i < current ? "w-full" : "w-0"}`} /></div>}
        </div>
      ))}
    </div>
  )
}

const DRAFT_KEY = "vms-create-exam-draft"

export default function CreateExam() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") } catch { return {} }
  })
  const set = (k: string, v: any) => {
    setForm((f: any) => { const n = { ...f, [k]: v }; localStorage.setItem(DRAFT_KEY, JSON.stringify(n)); return n })
  }

  const [cities, setCities] = useState<string[]>(form.cities ?? [])
  const [cityInput, setCityInput] = useState("")

  function addCity() {
    if (cityInput && !cities.includes(cityInput)) {
      const next = [...cities, cityInput]
      setCities(next); set("cities", next); setCityInput("")
    }
  }

  function validate() {
    if (step === 0 && (!form.name || !form.examType || !form.scheduledDate)) {
      toast.error("Please fill all required fields"); return false
    }
    if (step === 1 && (!form.sessions)) {
      toast.error("Please select number of sessions"); return false
    }
    return true
  }

  async function submit() {
    setLoading(true)
    try {
      const year = form.year || new Date().getFullYear()
      const centres = cities.map((c) => ({ cityName: c, suggestedCapacity: 5000 }))
      const res = await api.post("/api/exams", {
        name: form.name,
        examType: form.examType,
        year: Number(year),
        scheduledDate: new Date(form.scheduledDate).toISOString(),
        sessions: Number(form.sessions) || 1,
        session1Start: form.s1Start, session1End: form.s1End,
        session2Start: form.s2Start, session2End: form.s2End,
        centres,
      })
      localStorage.removeItem(DRAFT_KEY)
      toast.success("Exam created successfully")
      navigate(`/exams/${res.data.id}`)
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to create exam")
    } finally { setLoading(false) }
  }

  const examCode = form.examType && form.year
    ? `UPSC/${form.year}/${form.examType?.slice(0, 3)?.toUpperCase()}`
    : "UPSC/YEAR/TYPE"

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Create New Examination</h1>
        <StepBar current={step} />

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          {step === 0 && (
            <>
              <h2 className="text-base font-semibold text-gray-800">Exam Details</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Examination Name *</label>
                <input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Civil Services Preliminary Examination" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Examination Type *</label>
                  <select value={form.examType ?? ""} onChange={(e) => set("examType", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select type</option>
                    <option value="PRELIMINARY">Preliminary</option>
                    <option value="MAINS">Mains</option>
                    <option value="INTERVIEW">Interview</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                  <input type="number" value={form.year ?? new Date().getFullYear()} onChange={(e) => set("year", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date *</label>
                <input type="date" value={form.scheduledDate ?? ""} onChange={(e) => set("scheduledDate", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-base font-semibold text-gray-800">Session Configuration</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Sessions *</label>
                <div className="flex gap-4">
                  {[1, 2].map((n) => (
                    <label key={n} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value={n} checked={Number(form.sessions) === n} onChange={() => set("sessions", n)} />
                      <span className="text-sm">{n} Session{n > 1 ? "s" : ""}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session 1 Start</label>
                  <input type="time" value={form.s1Start ?? ""} onChange={(e) => set("s1Start", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session 1 End</label>
                  <input type="time" value={form.s1End ?? ""} onChange={(e) => set("s1End", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              {Number(form.sessions) === 2 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Session 2 Start</label>
                    <input type="time" value={form.s2Start ?? ""} onChange={(e) => set("s2Start", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Session 2 End</label>
                    <input type="time" value={form.s2End ?? ""} onChange={(e) => set("s2End", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg px-4 py-2">
                <span className="text-xs text-gray-500">Exam Code Preview: </span>
                <span className="font-mono font-bold text-navy">{examCode}</span>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-base font-semibold text-gray-800">Centre Cities</h2>
              <div className="flex gap-2">
                <input value={cityInput} onChange={(e) => setCityInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCity()}
                  placeholder="Enter city name" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <button onClick={addCity} className="px-4 py-2 bg-navy text-white rounded-lg text-sm hover:bg-navy-light">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {cities.map((c) => (
                  <span key={c} className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 text-sm px-3 py-1 rounded-full">
                    {c}
                    <button onClick={() => { const n = cities.filter((x) => x !== c); setCities(n); set("cities", n) }}><X size={12} /></button>
                  </span>
                ))}
                {cities.length === 0 && <p className="text-sm text-gray-400">No cities added yet.</p>}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-base font-semibold text-gray-800">Review & Submit</h2>
              <dl className="space-y-3 text-sm">
                {[
                  ["Name", form.name], ["Type", form.examType], ["Year", form.year],
                  ["Scheduled Date", form.scheduledDate ? format(new Date(form.scheduledDate), "dd MMM yyyy") : "—"],
                  ["Sessions", form.sessions], ["Exam Code", examCode],
                  ["Cities", cities.join(", ") || "None"],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex gap-4 border-b border-gray-50 pb-2">
                    <dt className="w-36 font-medium text-gray-500">{k}</dt>
                    <dd className="text-gray-900">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>

        <div className="flex justify-between mt-4">
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                <ChevronLeft size={16} /> Back
              </button>
            )}
            <button onClick={() => { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, cities })); toast.success("Draft saved") }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Save Draft</button>
          </div>
          {step < 3
            ? <button onClick={() => validate() && setStep(step + 1)}
                className="flex items-center gap-1 px-4 py-2 bg-navy text-white rounded-lg text-sm hover:bg-navy-light">
                Next <ChevronRight size={16} />
              </button>
            : <button onClick={submit} disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {loading ? "Creating…" : "Create Exam"}
              </button>
          }
        </div>
      </div>
    </Layout>
  )
}
