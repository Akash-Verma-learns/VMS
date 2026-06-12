export function CSDashboard() {
  return (
    <div className="dashboard-container">
      <h2>City Overview: Mumbai</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-num">72</span>
          <span className="stat-label">Total Venues</span>
        </div>
        <div className="stat-card success">
          <span className="stat-num">68</span>
          <span className="stat-label">Confirmed</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-num">4</span>
          <span className="stat-label">Pending</span>
        </div>
      </div>

      <h3 className="section-title">Action Required</h3>
      <ul className="action-list">
        <li className="action-item warning-text">Review 3 VS Readiness Reports</li>
        <li className="action-item warning-text">Verify 8 VS Bills Submitted</li>
      </ul>

      <h3 className="section-title">Material and Logistics</h3>
      <div className="logistics-card">
        <p>OMR Packets Dispatched: 72 of 72</p>
        <p>SAL Envelopes Dispatched: 72 of 72</p>
      </div>

      <button className="submit-btn" style={{ marginTop: '2rem' }}>
        Submit City-Level Bills to UPSC
      </button>
    </div>
  )
}
