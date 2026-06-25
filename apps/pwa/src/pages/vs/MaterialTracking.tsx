import { useState, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import jsQR from "jsqr"
import api from "../../lib/api"
import { db } from "../../db/offline"
import PWALayout from "../../components/PWALayout"
import BottomNav from "../../components/BottomNav"
import toast from "react-hot-toast"
import { v4 as uuid } from "uuid"

const VS_NAV = [
  { label: "Home", icon: "🏠", path: "/vs/home" },
  { label: "Readiness", icon: "✅", path: "/vs/readiness" },
  { label: "Exam Day", icon: "📋", path: "/vs/exam-day" },
  { label: "Material", icon: "📦", path: "/vs/material" },
  { label: "Survey", icon: "📝", path: "/vs/survey" },
]

export default function MaterialTracking() {
  const qc = useQueryClient()
  const [pin, setPin] = useState("")
  const [qrResult, setQrResult] = useState("")
  const [step, setStep] = useState<"scan" | "pin" | "confirm" | "cctv" | "dispatch">("scan")
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [venueId, setVenueId] = useState("")
  const [examId, setExamId] = useState("")

  async function startQrScan() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        scanFrame()
      }
    } catch { toast.error("Camera access denied") }
  }

  function scanFrame() {
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) { requestAnimationFrame(scanFrame); return }
    const ctx = canvas.getContext("2d")!
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imgData.data, imgData.width, imgData.height)
    if (code) {
      setQrResult(code.data); streamRef.current?.getTracks().forEach((t) => t.stop()); setStep("pin")
      toast.success("QR scanned: " + code.data.slice(0, 20))
    } else requestAnimationFrame(scanFrame)
  }

  async function confirmMaterial(type: "POST_EXAM_DISPATCHED" | "RECEIVED") {
    setLoading(true)
    const payload = { pin, eventType: type }
    try {
      if (navigator.onLine) {
        await api.post("/api/materials/confirm", payload)
        toast.success(type === "RECEIVED" ? "Material received confirmed" : "Material dispatched confirmed")
        qc.invalidateQueries({ queryKey: ["vs-checkpoints"] })
      } else {
        await db.pendingSync.add({ id: uuid(), type: "material", payload, status: "pending", createdAt: Date.now() })
        toast.success("Saved offline")
      }
      setStep(type === "POST_EXAM_DISPATCHED" ? "cctv" : "confirm")
    } catch (e: any) { toast.error(e.response?.data?.error ?? "Failed") } finally { setLoading(false) }
  }

  async function submitCCTV() {
    setLoading(true)
    try {
      if (navigator.onLine) {
        await api.post("/api/field/checkpoint", { venueId, type: "CCTV_ARCHIVAL_CONFIRMATION", data: { confirmedAt: new Date().toISOString() } })
        toast.success("CCTV archival confirmed")
        setStep("dispatch")
      } else {
        await db.pendingSync.add({ id: uuid(), type: "checkpoint", payload: { venueId, type: "CCTV_ARCHIVAL_CONFIRMATION", data: {} }, status: "pending", createdAt: Date.now() })
        toast.success("Saved offline")
      }
    } catch { toast.error("Failed") } finally { setLoading(false) }
  }

  async function submitDispatch() {
    setLoading(true)
    try {
      await confirmMaterial("POST_EXAM_DISPATCHED")
    } finally { setLoading(false) }
  }

  return (
    <>
      <PWALayout title="Material Tracking" back="/vs/home">
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

          {/* Scan step */}
          {step === "scan" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <h2 className="font-semibold text-navy">Step 1: Scan Material QR Code</h2>
              <video ref={videoRef} className="w-full rounded-lg aspect-video bg-black object-cover" playsInline />
              <canvas ref={canvasRef} className="hidden" />
              <button onClick={startQrScan} className="w-full py-2.5 bg-navy text-white rounded-xl text-sm font-medium">
                📷 Start Camera Scan
              </button>
              <div className="text-center text-gray-400 text-xs">or</div>
              <input value={qrResult} onChange={(e) => setQrResult(e.target.value)} placeholder="Enter QR code manually"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              {qrResult && <button onClick={() => setStep("pin")} className="w-full py-2 border border-navy text-navy rounded-xl text-sm">Use This Code →</button>}
            </div>
          )}

          {/* PIN step */}
          {step === "pin" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <h2 className="font-semibold text-navy">Step 2: Enter Security PIN</h2>
              <p className="text-xs text-gray-500">QR: {qrResult.slice(0, 30)}…</p>
              <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)}
                placeholder="6-digit PIN" className="w-full border border-gray-300 rounded-lg px-3 py-3 text-center text-xl tracking-widest" />
              <div className="flex gap-3">
                <button onClick={() => { setPin(""); setStep("scan") }} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm">Back</button>
                <button onClick={() => confirmMaterial("RECEIVED")} disabled={pin.length < 4 || loading}
                  className="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {loading ? "Confirming…" : "Confirm Receipt"}
                </button>
              </div>
            </div>
          )}

          {/* CCTV step */}
          {step === "cctv" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <h2 className="font-semibold text-navy">Step 3: CCTV Archival</h2>
              <p className="text-sm text-gray-600">Confirm that CCTV footage has been archived and secured before material dispatch.</p>
              <button onClick={submitCCTV} disabled={loading}
                className="w-full py-2.5 bg-teal text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {loading ? "Confirming…" : "Confirm CCTV Archival"}
              </button>
            </div>
          )}

          {/* Dispatch step */}
          {step === "dispatch" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <h2 className="font-semibold text-navy">Step 4: Post-Exam Dispatch</h2>
              <button onClick={submitDispatch} disabled={loading}
                className="w-full py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {loading ? "Dispatching…" : "Confirm Material Dispatch"}
              </button>
            </div>
          )}
        </div>
      </PWALayout>
      <BottomNav items={VS_NAV} />
    </>
  )
}
