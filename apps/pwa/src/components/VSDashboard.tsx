import { Link } from 'react-router-dom'

export function VSDashboard() {
  return (
    <div className="vs-dashboard">
      <div className="vs-header">
        <div className="vs-header-main">UPSC VMS – VS Portal</div>
        <div className="vs-header-sub">Ms. Anjali Verma &nbsp;|&nbsp; St. Xavier's College, Mumbai</div>
      </div>

      <div className="vs-section">
        <div className="vs-section-title">CSP 2026 – Your Tasks</div>
        <div className="vs-section-content vs-task-list">
          <Link to="/vs/checklist" className="vs-task-item text-green">
            Venue Readiness Checklist (Done)
          </Link>
          <div className="vs-task-item text-orange">Staff Requirement Form - Due 28 Apr</div>
          <div className="vs-task-item text-red">Exam Day Report - 25 May 2026</div>
          <div className="vs-task-item text-grey">Post Exam Material Dispatch (Locked)</div>
        </div>
      </div>

      <div className="vs-section">
        <div className="vs-section-title">Material Status</div>
        <div className="vs-section-content vs-material-list">
          <div className="vs-material-item text-navy"><strong>PIN: VMS-2026-4521 &nbsp;&nbsp;&nbsp; QR: Active</strong></div>
          <div className="vs-material-item text-green">OMR Receipt: Confirmed 22 Apr</div>
          <div className="vs-material-item text-green">SAL Packet: Confirmed 22 Apr</div>
          <div className="vs-material-item text-orange">Extra Stationery: Awaiting</div>
        </div>
      </div>

      <button className="vs-contact-btn">
        Contact My CS: Ramesh Iyer
      </button>

      <div className="vs-bottom-nav">
        <div className="nav-item active">Home</div>
        <div className="nav-item">Tasks</div>
        <div className="nav-item">Materials</div>
        <div className="nav-item">Profile</div>
      </div>
    </div>
  )
}
