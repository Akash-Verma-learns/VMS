import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "./store/auth"
import Login from "./pages/Login"
import VSHome from "./pages/vs/VSHome"
import ReadinessChecklist from "./pages/vs/ReadinessChecklist"
import ExamDayReport from "./pages/vs/ExamDayReport"
import MaterialTracking from "./pages/vs/MaterialTracking"
import SurveyResponse from "./pages/vs/SurveyResponse"
import CSHome from "./pages/cs/CSHome"
import IOHome from "./pages/io/IOHome"
import IOInspection from "./pages/io/IOInspection"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* VS routes */}
        <Route path="/vs/home" element={<RequireAuth><VSHome /></RequireAuth>} />
        <Route path="/vs/readiness" element={<RequireAuth><ReadinessChecklist /></RequireAuth>} />
        <Route path="/vs/exam-day" element={<RequireAuth><ExamDayReport /></RequireAuth>} />
        <Route path="/vs/material" element={<RequireAuth><MaterialTracking /></RequireAuth>} />
        <Route path="/vs/survey" element={<RequireAuth><SurveyResponse /></RequireAuth>} />

        {/* CS routes */}
        <Route path="/cs/home" element={<RequireAuth><CSHome /></RequireAuth>} />
        <Route path="/cs/surveys" element={<RequireAuth><SurveyResponse /></RequireAuth>} />

        {/* IO routes */}
        <Route path="/io/home" element={<RequireAuth><IOHome /></RequireAuth>} />
        <Route path="/io/inspect" element={<RequireAuth><IOInspection /></RequireAuth>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
