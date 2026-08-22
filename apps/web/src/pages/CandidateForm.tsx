import { useState } from "react"
import { Check } from "lucide-react"
import axios from "axios"
import toast from "react-hot-toast"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001"

export default function CandidateForm() {
  const [examCodeInput, setExamCodeInput] = useState("")
  const [examInfo, setExamInfo] = useState<{ examCode: string; examName: string; cities: string[] } | null>(null)
  const [examLoading, setExamLoading] = useState(false)
  const [examError, setExamError] = useState("")

  const [form, setForm] = useState({
    rollNo: "", candidateName: "",
    priority1: "", priority2: "", priority3: "", priority4: "", priority5: "",
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleLoadExam() {
    const code = examCodeInput.trim().toUpperCase()
    if (!code) return
    setExamLoading(true)
    setExamError("")
    setExamInfo(null)
    setForm({ rollNo: "", candidateName: "", priority1: "", priority2: "", priority3: "", priority4: "", priority5: "" })
    try {
      const res = await axios.get(`${API_BASE}/api/candidates/exam-cities`, { params: { code } })
      if (res.data.cities.length === 0) {
        setExamError("No exam centres have been set up for this exam yet. Please check back later.")
        return
      }
      setExamInfo(res.data)
    } catch (err: any) {
      setExamError(err.response?.data?.error ?? "Exam not found. Please check the exam code.")
    } finally {
      setExamLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!examInfo || !form.rollNo || !form.priority1) {
      toast.error("Roll No and at least 1 city priority are required")
      return
    }
    setLoading(true)
    try {
      await axios.post(`${API_BASE}/api/candidates/preferences`, {
        examCode: examInfo.examCode,
        rollNo: form.rollNo.trim(),
        candidateName: form.candidateName.trim() || undefined,
        priority1: form.priority1,
        priority2: form.priority2 || undefined,
        priority3: form.priority3 || undefined,
        priority4: form.priority4 || undefined,
        priority5: form.priority5 || undefined,
      })
      setSubmitted(true)
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to submit. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
               style={{ background: "var(--ux4g-color-green-100)", color: "var(--ux4g-color-green-800)" }}>
            <Check size={32} strokeWidth={2.5} aria-hidden />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Preferences Submitted</h2>
          <p className="text-gray-500 text-sm">
            Your city preferences for Roll No <strong>{form.rollNo}</strong> ({examInfo?.examCode}) have been recorded.
            You can resubmit to update them before the deadline.
          </p>
          <button onClick={() => setSubmitted(false)}
            className="mt-6 px-6 py-2 bg-navy text-white rounded-lg text-sm">
            Update Preferences
          </button>
        </div>
      </div>
    )
  }

  const selectedCities = [form.priority1, form.priority2, form.priority3, form.priority4, form.priority5].filter(Boolean)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg">
        <div className="bg-navy text-white px-6 py-4 rounded-t-xl">
          <div className="font-bold text-lg">UPSC VMS</div>
          <div className="text-xs text-blue-200">Candidate City Preference Form</div>
        </div>

        <div className="p-6 space-y-4">
          {/* Grey on a blue tint washes out; this is an informational notice,
              so it uses UX4G's own alert rather than a hand-tinted box. */}
          <p className="ux4g-alert ux4g-alert-info text-xs">
            Rank your preferred exam centre cities (up to 5). Only cities with active centres for your exam are shown.
            Allotment is subject to availability. You can update your preferences before the submission deadline.
          </p>

          {/* Step 1: Enter exam code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam Code *</label>
            <div className="flex gap-2">
              <input
                value={examCodeInput}
                onChange={(e) => { setExamCodeInput(e.target.value); setExamError("") }}
                onKeyDown={(e) => e.key === "Enter" && handleLoadExam()}
                placeholder="e.g. UPSC/2030/CSP"
                className={`flex-1 border rounded-lg px-3 py-2 text-sm ${examError ? "border-red-400" : "border-gray-300"}`}
              />
              <button onClick={handleLoadExam} disabled={!examCodeInput.trim() || examLoading}
                className="px-4 py-2 bg-navy text-white rounded-lg text-sm disabled:opacity-40 shrink-0">
                {examLoading ? "Loading…" : "Load"}
              </button>
            </div>
            {examError && <p className="text-xs text-red-600 mt-1">{examError}</p>}
            {examInfo && (
              <p className="text-xs text-green-700 mt-1 font-medium">
                ✓ {examInfo.examName} — {examInfo.cities.length} centre cities available
              </p>
            )}
          </div>

          {/* Step 2: Fill preferences */}
          {examInfo && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number *</label>
                  <input value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })}
                    placeholder="Your UPSC Roll No"
                    className="w-full ux4g-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name (optional)</label>
                  <input value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
                    placeholder="As per admit card"
                    className="w-full ux4g-input" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">City Preferences</p>
                <p className="text-xs text-neutral-600">Only cities with confirmed exam centres are listed.</p>
                {(["priority1", "priority2", "priority3", "priority4", "priority5"] as const).map((key, idx) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-6 shrink-0 ${idx === 0 ? "text-navy" : "text-neutral-600"}`}>
                      #{idx + 1}
                    </span>
                    <select
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      required={idx === 0}
                      className="flex-1 ux4g-input"
                    >
                      <option value="">— {idx === 0 ? "Select (required)" : "Optional"} —</option>
                      {examInfo.cities.map((city) => (
                        <option key={city} value={city}
                          disabled={selectedCities.includes(city) && form[key] !== city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <button type="submit" disabled={loading || !form.rollNo || !form.priority1}
                className="w-full py-2.5 bg-navy text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {loading ? "Submitting…" : "Submit Preferences"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
