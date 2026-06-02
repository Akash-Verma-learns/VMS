import { Routes, Route, Navigate } from 'react-router-dom'
import { SyncStatus } from './components/SyncStatus'
import { Checklist } from './components/Checklist'
import { RoleSwitcher } from './components/RoleSwitcher'
import { CSDashboard } from './components/CSDashboard'
import { IODashboard } from './components/IODashboard'
import { VSDashboard } from './components/VSDashboard'
import './App.css'

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>UPSC VMS</h1>
        <RoleSwitcher />
      </header>
      
      <SyncStatus />
      
      <main className="app-main" style={{ padding: 0 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/vs" replace />} />
          <Route path="/vs" element={<VSDashboard />} />
          <Route path="/vs/checklist" element={<div style={{padding: '1rem'}}><Checklist /></div>} />
          <Route path="/cs" element={<div style={{padding: '1rem'}}><CSDashboard /></div>} />
          <Route path="/io" element={<div style={{padding: '1rem'}}><IODashboard /></div>} />
        </Routes>
      </main>
      
      <footer className="app-footer">
        <p>&copy; 2026 Union Public Service Commission</p>
      </footer>
    </div>
  )
}

export default App
