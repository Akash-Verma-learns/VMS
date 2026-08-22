import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import api from "../../lib/api"
import Layout from "../../components/Layout"
import toast from "react-hot-toast"
import { CheckCircle, Info } from "lucide-react"

export default function CSFal() {
  const [falId, setFalId] = useState("")
  const [acknowledged, setAcknowledged] = useState<any>(null)

  const ackMut = useMutation({
    mutationFn: () => api.patch(`/api/fal/${falId.trim()}/acknowledge`),
    onSuccess: (res) => {
      toast.success("FAL acknowledged successfully")
      setAcknowledged(res.data)
      setFalId("")
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to acknowledge"),
  })

  return (
    <Layout>
      <div className="max-w-xl mx-auto space-y-5">
        <h1 className="ux4g-heading-xl-strong">FAL Acknowledgement</h1>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>How it works:</strong> When a Financial Advance Letter is issued for your venue, the Section Officer will share the FAL ID with you.</p>
            <p>Paste the FAL ID below to acknowledge receipt of the advance.</p>
          </div>
        </div>

        {acknowledged && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
            <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-semibold">FAL Acknowledged</p>
              <p className="mt-1">Status updated to <strong>ACKNOWLEDGED</strong>. Your receipt of the advance has been recorded.</p>
            </div>
          </div>
        )}

        <div className="ux4g-card ux4g-card-solid p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">FAL ID *</label>
            <input
              value={falId}
              onChange={(e) => setFalId(e.target.value)}
              placeholder="Paste FAL UUID shared by your Section Officer…"
              className="w-full ux4g-input font-mono"
            />
            <p className="text-xs text-neutral-600 mt-1">
              The FAL ID is a UUID like: a1b2c3d4-e5f6-7890-abcd-ef1234567890
            </p>
          </div>
          <button
            onClick={() => ackMut.mutate()}
            disabled={!falId.trim() || ackMut.isPending}
            className="w-full py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {ackMut.isPending ? "Acknowledging…" : "Acknowledge Receipt"}
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">FAL Workflow</p>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            {["Created by ASO/SO", "Sanctioned by DS", "You Acknowledge"].map((step, i, arr) => (
              <span key={step} className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-navy text-white text-xs flex items-center justify-center shrink-0">{i + 1}</span>
                  {step}
                </span>
                {i < arr.length - 1 && <span className="text-gray-300">→</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
