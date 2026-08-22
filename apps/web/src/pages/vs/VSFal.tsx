import Layout from "../../components/Layout"
import { Info } from "lucide-react"

export default function VSFal() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="ux4g-heading-xl-strong">Financial Advance Letter (FAL)</h1>
        <div className="ux4g-alert ux4g-alert-info" role="status">
          <span className="ux4g-alert-icon"><Info size={20} strokeWidth={2} aria-hidden /></span>
          <div className="ux4g-alert-content">
            <p className="ux4g-alert-title">FAL issuance is managed by UPSC officers</p>
            <p className="ux4g-alert-message">
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
