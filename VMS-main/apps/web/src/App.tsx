import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { PINManager } from './components/PINManager'
import { SurveyBuilder } from './components/SurveyBuilder'
import { SurveyDashboard } from './components/SurveyDashboard'
import { FaceCheckRunner } from './components/FaceCheckRunner'
import './App.css'

function App() {
  return (
    <Router>
      <div className="web-app-container">
        <header className="web-header">
          <h1>UPSC VMS — Admin Portal</h1>
          <nav className="web-nav">
            <Link to="/pins">PIN Management</Link>
            <Link to="/surveys">Surveys</Link>
            <Link to="/face-auth">Face Auth</Link>
          </nav>
        </header>

        <main className="web-main">
          <Routes>
            <Route path="/" element={<div style={{padding: '2rem'}}>Welcome to VMS Admin Portal</div>} />
            <Route path="/pins" element={<PINManager />} />
            <Route path="/surveys" element={<SurveyBuilder />} />
            <Route path="/survey/:id/dashboard" element={<SurveyDashboardWrapper />} />
            <Route path="/face-auth" element={<FaceCheckRunner />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

function SurveyDashboardWrapper() {
  // A simple wrapper to get the ID from URL if using react-router params
  // or we can just hardcode a selector in the dashboard.
  // For simplicity, SurveyDashboard accepts surveyId as a prop.
  // We can extract it from URL.
  const { useParams } = require('react-router-dom')
  const { id } = useParams()
  return <SurveyDashboard surveyId={id} />
}

export default App
