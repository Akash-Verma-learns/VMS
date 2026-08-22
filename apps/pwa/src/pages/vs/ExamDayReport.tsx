import { useState } from "react"
import api from "../../lib/api"
import { db } from "../../db/offline"
import PWALayout from "../../components/PWALayout"
import BottomNav from "../../components/BottomNav"
import toast from "react-hot-toast"
import clsx from "clsx"
import { v4 as uuid } from "uuid"
import { Home, ClipboardCheck, ClipboardList, Package, FileText, Check, Circle, ArrowLeft } from "lucide-react"

const VS_NAV = [
  { label: "Home", icon: Home, path: "/vs/home" },
  { label: "Readiness", icon: ClipboardCheck, path: "/vs/readiness" },
  { label: "Exam Day", icon: ClipboardList, path: "/vs/exam-day" },
  { label: "Material", icon: Package, path: "/vs/material" },
  { label: "Survey", icon: FileText, path: "/vs/survey" },
]

interface Checkpoint {
  type: string
  label: string
  fields: { key: string; label: string; type: "number" | "text" | "boolean" }[]
}

const CHECKPOINTS: Checkpoint[] = [
  { type: "EXAM_DAY_GATE_CLOSURE", label: "Gate Closure", fields: [{ key: "gateClosedAt", label: "Gate closed at (HH:MM)", type: "text" }, { key: "candidatesPresent", label: "Candidates present", type: "number" }] },
  { type: "EXAM_DAY_SECURITY", label: "Security Check", fields: [{ key: "verifiedCount", label: "Candidates biometrically verified", type: "number" }, { key: "exceptionsCount", label: "Exceptions (manual verification)", type: "number" }] },
  { type: "EXAM_DAY_PAPER_OPENING", label: "Paper Opening", fields: [{ key: "paperOpenedAt", label: "Papers opened at (HH:MM)", type: "text" }, { key: "openedBy", label: "Opened by", type: "text" }] },
  { type: "EXAM_DAY_SESSION_START", label: "Session Start", fields: [{ key: "jammerActive", label: "Jammer active?", type: "boolean" }, { key: "jammerId", label: "Jammer model/ID", type: "text" }] },
  { type: "EXAM_DAY_ATTENDANCE", label: "Attendance", fields: [{ key: "totalAttendance", label: "Total attendance", type: "number" }, { key: "pwbdCount", label: "PwBD candidates attended", type: "number" }, { key: "absentCount", label: "Absent candidates", type: "number" }] },
  { type: "EXAM_DAY_SESSION_END", label: "Session End", fields: [{ key: "sessionEndTime", label: "Session ended at (HH:MM)", type: "text" }, { key: "unfairMeansCount", label: "UFM cases (if any)", type: "number" }] },
]

export default function ExamDayReport() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<Record<string, Record<string, any>>>({})
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const [examId, setExamId] = useState("")
  const [venueId, setVenueId] = useState("")

  const cp = CHECKPOINTS[step]

  function updateField(key: string, val: any) {
    setData((prev) => ({ ...prev, [cp.type]: { ...(prev[cp.type] ?? {}), [key]: val } }))
  }

  async function submitCheckpoint() {
    if (!venueId || !examId) { toast.error("Select exam first"); return }
    setLoading(true)
    const payload = { venueId, examId, type: cp.type, data: data[cp.type] ?? {} }
    try {
      if (navigator.onLine) {
        await api.post("/api/field/checkpoint", payload)
        toast.success(`${cp.label} submitted`)
      } else {
        await db.pendingSync.add({ id: uuid(), type: "checkpoint", payload, status: "pending", createdAt: Date.now() })
        toast.success("Saved offline")
      }
      setSubmitted((prev) => new Set([...prev, cp.type]))
      if (step < CHECKPOINTS.length - 1) setStep(step + 1)
    } catch (e: any) { toast.error(e.response?.data?.error ?? "Failed to submit") } finally { setLoading(false) }
  }

  return (
    <>
      <PWALayout title="Exam Day Report" back="/vs/home">
        <div className="p-4 space-y-4">
          {/* Exam + Venue IDs */}
          <div className="ux4g-card ux4g-card-solid p-3 space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Session Details</p>
            <input value={examId} onChange={(e) => setExamId(e.target.value)}
              placeholder="Exam ID (paste UUID from officer)"
              className="w-full ux4g-input font-mono" />
            <input value={venueId} onChange={(e) => setVenueId(e.target.value)}
              placeholder="Venue ID (paste UUID from CS)"
              className="w-full ux4g-input font-mono" />
          </div>

          {/* Progress track */}
          <div className="flex gap-1">
            {CHECKPOINTS.map((c, i) => (
              <button key={c.type} onClick={() => setStep(i)}
                className={clsx("flex-1 h-1.5 rounded-full transition-colors",
                  submitted.has(c.type) ? "bg-green-500" : i === step ? "bg-navy" : "bg-gray-200")} />
            ))}
          </div>
          <p className="text-xs text-center text-gray-500">Step {step + 1} of {CHECKPOINTS.length}: {cp.label}</p>

          {/* Checkpoint form */}
          <div className="ux4g-card ux4g-card-solid p-4 space-y-4">
            <h2 className="font-semibold text-navy flex items-center gap-2">
              {submitted.has(cp.type) && <Check size={16} className="text-green-500" strokeWidth={3} />}
              {cp.label}
            </h2>
            {cp.fields.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                {f.type === "boolean" ? (
                  <div className="flex gap-4">
                    {["Yes", "No"].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name={f.key} checked={(data[cp.type]?.[f.key] === (opt === "Yes"))}
                          onChange={() => updateField(f.key, opt === "Yes")} />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input type={f.type === "number" ? "number" : "text"} inputMode={f.type === "number" ? "numeric" : "text"}
                    value={data[cp.type]?.[f.key] ?? ""}
                    onChange={(e) => updateField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                    className="w-full ux4g-input" />
                )}
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <button onClick={() => setStep(step - 1)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm flex items-center justify-center gap-1"><ArrowLeft size={16} /> Back</button>
              )}
              <button onClick={submitCheckpoint} disabled={loading || !examId}
                className="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {loading ? "Submitting…" : submitted.has(cp.type) ? "Re-submit" : "Submit & Next"}
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="ux4g-card ux4g-card-solid p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Submitted Checkpoints</h3>
            <div className="space-y-1">
              {CHECKPOINTS.map((c) => (
                <div key={c.type} className="flex items-center gap-2 text-sm">
                  {submitted.has(c.type)
                    ? <Check size={14} className="text-green-500" strokeWidth={3} />
                    : <Circle size={14} className="text-gray-300" />}
                  <span className={submitted.has(c.type) ? "text-gray-700" : "text-neutral-600"}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PWALayout>
      <BottomNav items={VS_NAV} />
    </>
  )
}
