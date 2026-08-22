import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import imageCompression from "browser-image-compression"
import api from "../../lib/api"
import { db } from "../../db/offline"
import PWALayout from "../../components/PWALayout"
import { useAuthStore } from "../../store/auth"
import BottomNav from "../../components/BottomNav"
import { navFor } from "../gate/GateNav"
import toast from "react-hot-toast"
import { v4 as uuid } from "uuid"



interface Section { id: string; title: string; items: string[] }
const SECTIONS: Section[] = [
  { id: "entry", title: "Entry & Security", items: ["Main gate security staff present", "ID verification setup", "CCTV cameras operational", "Metal detector functional"] },
  { id: "rooms", title: "Examination Rooms", items: ["Room numbering visible", "Seat numbering complete", "Invigilators briefed", "Clock visible from all seats"] },
  { id: "facilities", title: "Facilities", items: ["Toilets clean and functional", "Drinking water available", "Medical aid available", "Power backup tested"] },
  { id: "accessibility", title: "Accessibility", items: ["PwBD ramps accessible", "Dedicated seating arranged", "Scribe allocation confirmed"] },
]

export default function IOInspection() {
  const { user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const inspectionId = (location.state as any)?.inspectionId
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [findings, setFindings] = useState("")
  const [photos, setPhotos] = useState<{ name: string; size: string; dataUrl: string }[]>([])
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)

  async function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      try {
        const compressed = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1280, useWebWorker: true })
        const reader = new FileReader()
        reader.onload = () => setPhotos((prev) => [...prev, { name: file.name, size: (compressed.size / 1024).toFixed(0) + "KB", dataUrl: reader.result as string }])
        reader.readAsDataURL(compressed)
      } catch { toast.error("Failed to process " + file.name) }
    }
    e.target.value = ""
  }

  async function captureGeo() {
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoLoading(false) },
      () => { toast.error("Could not get location"); setGeoLoading(false) }
    )
  }

  const allItems = SECTIONS.flatMap((s) => s.items)
  const checkedCount = Object.values(checks).filter(Boolean).length

  async function submit() {
    if (photos.length < 5) { toast.error("Minimum 5 photos required"); return }
    if (!geo) { toast.error("Geo-location is required"); return }
    setSubmitting(true)
    const payload = { inspectionId, checks, findings, geoLat: geo.lat, geoLng: geo.lng, photoCount: photos.length }
    try {
      if (navigator.onLine) {
        await api.post(`/api/inspections/${inspectionId}/submit`, payload)
        toast.success("Inspection submitted")
        navigate("/io/home")
      } else {
        await db.pendingSync.add({ id: uuid(), type: "inspection", payload, status: "pending", createdAt: Date.now() })
        toast.success("Saved offline — will sync when connected")
        navigate("/io/home")
      }
    } catch (e: any) { toast.error(e.response?.data?.error ?? "Failed") } finally { setSubmitting(false) }
  }

  return (
    <>
      <PWALayout title="Inspection" back="/io/home">
        <div className="p-4 space-y-4">
          {/* Progress */}
          <div className="ux4g-card ux4g-card-solid p-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">Checklist progress</span>
            <span className="text-sm font-semibold text-navy">{checkedCount}/{allItems.length}</span>
          </div>

          {/* Sections */}
          {SECTIONS.map((section) => (
            <div key={section.id} className="ux4g-card ux4g-card-solid overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-700">{section.title}</div>
              <div className="divide-y divide-gray-50">
                {section.items.map((item) => (
                  <label key={item} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={!!checks[item]}
                      onChange={(e) => setChecks({ ...checks, [item]: e.target.checked })}
                      className="mt-0.5 rounded" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Findings */}
          <div className="ux4g-card ux4g-card-solid p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Findings & Observations</label>
            <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={4}
              placeholder="Note any issues, deficiencies, or observations…" className="w-full ux4g-input" />
          </div>

          {/* Photos */}
          <div className="ux4g-card ux4g-card-solid p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="ux4g-title-s-strong">Photos (min 5)</label>
              <span className={photos.length >= 5 ? "text-green-600 text-xs" : "text-red-500 text-xs"}>{photos.length}/5+</span>
            </div>
            <input type="file" accept="image/*" capture="environment" multiple onChange={addPhoto}
              className="text-sm file:mr-2 file:text-xs file:bg-navy file:text-white file:rounded file:border-0 file:px-2 file:py-1" />
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20 border border-gray-200 rounded-lg overflow-hidden">
                    <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-0.5">{p.size}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Geolocation */}
          <div className="ux4g-card ux4g-card-solid p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="ux4g-title-s-strong">Geolocation</p>
                {geo ? <p className="text-xs text-green-600">{geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}</p>
                  : <p className="text-xs text-neutral-600">Not captured</p>}
              </div>
              <button onClick={captureGeo} disabled={geoLoading}
                className="px-3 py-1.5 bg-navy text-white rounded-lg text-xs disabled:opacity-50">
                {geoLoading ? "Getting…" : geo ? "Update" : "Capture GPS"}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button onClick={submit} disabled={submitting}
            className="w-full py-3 bg-navy text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {submitting ? "Submitting…" : "Submit Inspection Report"}
          </button>
          {photos.length < 5 && <p className="text-xs text-center text-red-400">Need {5 - photos.length} more photo(s)</p>}
        </div>
      </PWALayout>
      <BottomNav items={navFor(user?.role)} />
    </>
  )
}
