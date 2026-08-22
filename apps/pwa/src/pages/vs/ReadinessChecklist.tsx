import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import imageCompression from "browser-image-compression"
import api from "../../lib/api"
import { db } from "../../db/offline"
import PWALayout from "../../components/PWALayout"
import BottomNav from "../../components/BottomNav"
import toast from "react-hot-toast"
import clsx from "clsx"
import { v4 as uuid } from "uuid"
import { Home, ClipboardCheck, ClipboardList, Package, FileText, Camera } from "lucide-react"

const VS_NAV = [
  { label: "Home", icon: Home, path: "/vs/home" },
  { label: "Readiness", icon: ClipboardCheck, path: "/vs/readiness" },
  { label: "Exam Day", icon: ClipboardList, path: "/vs/exam-day" },
  { label: "Material", icon: Package, path: "/vs/material" },
  { label: "Survey", icon: FileText, path: "/vs/survey" },
]

interface ChecklistItem { id: string; category: string; label: string; mandatory: boolean; completed?: boolean }

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: "1", category: "Infrastructure", label: "Seating arrangement verified", mandatory: true },
  { id: "2", category: "Infrastructure", label: "Toilets clean and functional", mandatory: true },
  { id: "3", category: "Infrastructure", label: "Drinking water available", mandatory: true },
  { id: "4", category: "Security", label: "CCTV cameras operational", mandatory: true },
  { id: "5", category: "Security", label: "Metal detector tested", mandatory: true },
  { id: "6", category: "Security", label: "Jammer device installed and tested", mandatory: true },
  { id: "7", category: "Power", label: "Generator tested", mandatory: true },
  { id: "8", category: "Power", label: "UPS backup verified", mandatory: false },
  { id: "9", category: "Staff", label: "Invigilators briefed", mandatory: true },
  { id: "10", category: "Staff", label: "Room allocation done", mandatory: true },
  { id: "11", category: "Accessibility", label: "PwBD ramps accessible", mandatory: true },
  { id: "12", category: "Accessibility", label: "Dedicated seating for PwBD candidates", mandatory: true },
]

export default function ReadinessChecklist() {
  const qc = useQueryClient()
  const [drillMode, setDrillMode] = useState(false)
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [examId, setExamId] = useState("")

  const [venueId, setVenueId] = useState("")

  const items = DEFAULT_ITEMS
  const categories = [...new Set(items.map((i) => i.category))]
  const mandatoryTotal = items.filter((i) => i.mandatory).length
  const mandatoryDone = items.filter((i) => i.mandatory && completed.has(i.id)).length

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try {
      await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1280, useWebWorker: true })
      toast.success("Photo captured and compressed")
    } catch { toast.error("Failed to process photo") }
  }

  async function saveOffline() {
    const draft = { id: uuid(), venueId: venueId || "unknown", items: items.map((i) => ({ ...i, completed: completed.has(i.id) })), savedAt: Date.now() }
    await db.readinessDrafts.put(draft)
    toast.success("Saved offline — will sync when online")
  }

  async function submitReadiness() {
    if (!examId) { toast.error("Select exam first"); return }
    if (mandatoryDone < mandatoryTotal) { toast.error("Complete all mandatory items first"); return }
    setSubmitting(true)
    try {
      const checklistData = items.map((i) => ({ id: i.id, label: i.label, completed: completed.has(i.id) }))
      const payload = { examId, venueId, checklistData, isDrillMode: drillMode }
      if (navigator.onLine) {
        await api.post("/api/field/readiness", payload)
        toast.success(drillMode ? "Drill readiness recorded" : "Readiness submitted")
        qc.invalidateQueries({ queryKey: ["vs-readiness"] })
      } else {
        await db.pendingSync.add({ id: uuid(), type: "readiness", payload, status: "pending", createdAt: Date.now() })
        toast.success("Saved offline — will sync when connected")
      }
    } catch (e: any) { toast.error(e.response?.data?.error ?? "Failed to submit") } finally { setSubmitting(false) }
  }

  return (
    <>
      <PWALayout title="Venue Readiness" back="/vs/home">
        <div className="p-4 space-y-4">
          {/* Exam + Venue IDs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Session Details</p>
            <input value={examId} onChange={(e) => setExamId(e.target.value)}
              placeholder="Exam ID (paste UUID from officer)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
            <input value={venueId} onChange={(e) => setVenueId(e.target.value)}
              placeholder="Venue ID (paste UUID from CS)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>

          {/* Drill mode toggle */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Drill Mode</p>
              <p className="text-xs text-gray-500">Practice run — won't count as official</p>
            </div>
            <button onClick={() => setDrillMode(!drillMode)}
              className={clsx("w-12 h-6 rounded-full transition-colors relative", drillMode ? "bg-amber-500" : "bg-gray-300")}>
              <span className={clsx("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", drillMode ? "right-0.5" : "left-0.5")} />
            </button>
          </div>

          {/* Progress */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Mandatory Items</span>
              <span className={mandatoryDone === mandatoryTotal ? "text-green-600" : "text-amber-600"}>{mandatoryDone}/{mandatoryTotal}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${mandatoryTotal ? (mandatoryDone / mandatoryTotal) * 100 : 0}%` }} />
            </div>
          </div>

          {/* Checklist */}
          {categories.map((cat) => (
            <div key={cat} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button onClick={() => setOpenCategory(openCategory === cat ? null : cat)}
                className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <span>{cat}</span>
                <span>{openCategory === cat ? "▲" : "▼"}</span>
              </button>
              {(openCategory === cat || openCategory === null) && (
                <div className="border-t border-gray-100">
                  {items.filter((i) => i.category === cat).map((item) => {
                    const done = completed.has(item.id)
                    return (
                      <label key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={done}
                          onChange={(e) => {
                            const next = new Set(completed)
                            e.target.checked ? next.add(item.id) : next.delete(item.id)
                            setCompleted(next)
                          }}
                          className="mt-0.5 rounded" />
                        <span className="text-sm flex-1">
                          {item.label}
                          {item.mandatory && <span className="ml-1 text-red-400 text-xs">*</span>}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Photo capture */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><Camera size={16} /> Supporting Photos</p>
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto}
              className="text-sm text-gray-600 file:mr-3 file:text-xs file:bg-navy file:text-white file:rounded file:border-0 file:px-2 file:py-1" />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={saveOffline} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium">Save Draft</button>
            <button onClick={submitReadiness} disabled={submitting || !examId}
              className="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {submitting ? "Submitting…" : drillMode ? "Submit Drill" : "Submit Readiness"}
            </button>
          </div>
        </div>
      </PWALayout>
      <BottomNav items={VS_NAV} />
    </>
  )
}
