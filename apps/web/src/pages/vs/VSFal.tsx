import Layout from "../../components/Layout"
import { Info } from "lucide-react"

export default function VSFal() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Financial Advance Letter (FAL)</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-3">
          <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-800 text-sm">FAL issuance is managed by UPSC Officers</p>
            <p className="text-blue-700 text-sm mt-1">
              Financial Advance Letters are created and sanctioned by the Administration. Your Section Officer
              will notify you when a FAL has been issued for your venue. Contact your SO or DS if you have
              not received your advance for an upcoming examination.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
