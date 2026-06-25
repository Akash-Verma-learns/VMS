import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "./components/ProtectedRoute"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import ExamList from "./pages/ExamList"
import CreateExam from "./pages/CreateExam"
import ExamDetail from "./pages/ExamDetail"
import Approvals from "./pages/Approvals"
import FAL from "./pages/FAL"
import Finance from "./pages/Finance"
import Inspections from "./pages/Inspections"
import Surveys from "./pages/Surveys"
import Reports from "./pages/Reports"
import Cockpit from "./pages/Cockpit"
import FaceAuth from "./pages/FaceAuth"
import CSDashboard from "./pages/cs/CSDashboard"
import VenueManagement from "./pages/cs/VenueManagement"
import CSBills from "./pages/cs/CSBills"
import CSFal from "./pages/cs/CSFal"
import VSDashboard from "./pages/vs/VSDashboard"
import VSFal from "./pages/vs/VSFal"
import CandidatePreferences from "./pages/CandidatePreferences"
import CandidateForm from "./pages/CandidateForm"

const HQ = ["JS", "DS", "US", "SO", "ASO"]
const HQ_SENIOR = ["JS", "DS", "US", "SO"]
const ALL_ROLES = ["JS", "DS", "US", "SO", "ASO", "CS", "VS", "IO"]

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* HQ Dashboard */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={HQ}>
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* Exams */}
        <Route path="/exams" element={
          <ProtectedRoute allowedRoles={HQ}>
            <ExamList />
          </ProtectedRoute>
        } />
        <Route path="/exams/create" element={
          <ProtectedRoute allowedRoles={["ASO", "SO", "US", "DS", "JS"]}>
            <CreateExam />
          </ProtectedRoute>
        } />
        <Route path="/exams/:id" element={
          <ProtectedRoute allowedRoles={HQ}>
            <ExamDetail />
          </ProtectedRoute>
        } />

        {/* Approvals */}
        <Route path="/approvals" element={
          <ProtectedRoute allowedRoles={HQ}>
            <Approvals />
          </ProtectedRoute>
        } />

        {/* FAL */}
        <Route path="/fal" element={
          <ProtectedRoute allowedRoles={HQ}>
            <FAL />
          </ProtectedRoute>
        } />

        {/* Finance */}
        <Route path="/finance" element={
          <ProtectedRoute allowedRoles={HQ_SENIOR}>
            <Finance />
          </ProtectedRoute>
        } />

        {/* Inspections */}
        <Route path="/inspections" element={
          <ProtectedRoute allowedRoles={HQ_SENIOR}>
            <Inspections />
          </ProtectedRoute>
        } />

        {/* Surveys */}
        <Route path="/surveys" element={
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <Surveys />
          </ProtectedRoute>
        } />

        {/* Reports */}
        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={HQ_SENIOR}>
            <Reports />
          </ProtectedRoute>
        } />

        {/* Cockpit */}
        <Route path="/cockpit" element={
          <ProtectedRoute allowedRoles={["JS", "DS", "US"]}>
            <Cockpit />
          </ProtectedRoute>
        } />

        {/* Face Auth */}
        <Route path="/faceauth" element={
          <ProtectedRoute allowedRoles={["JS", "DS", "US"]}>
            <FaceAuth />
          </ProtectedRoute>
        } />

        {/* CS routes */}
        <Route path="/cs/dashboard" element={
          <ProtectedRoute allowedRoles={["CS"]}>
            <CSDashboard />
          </ProtectedRoute>
        } />
        <Route path="/cs/venues" element={
          <ProtectedRoute allowedRoles={["CS"]}>
            <VenueManagement />
          </ProtectedRoute>
        } />
        <Route path="/cs/bills" element={
          <ProtectedRoute allowedRoles={["CS"]}>
            <CSBills />
          </ProtectedRoute>
        } />
        <Route path="/cs/fal" element={
          <ProtectedRoute allowedRoles={["CS"]}>
            <CSFal />
          </ProtectedRoute>
        } />
        <Route path="/cs/surveys" element={
          <ProtectedRoute allowedRoles={["CS"]}>
            <Surveys />
          </ProtectedRoute>
        } />

        {/* VS routes */}
        <Route path="/vs/dashboard" element={
          <ProtectedRoute allowedRoles={["VS"]}>
            <VSDashboard />
          </ProtectedRoute>
        } />
        <Route path="/vs/fal" element={
          <ProtectedRoute allowedRoles={["VS"]}>
            <VSFal />
          </ProtectedRoute>
        } />
        <Route path="/vs/surveys" element={
          <ProtectedRoute allowedRoles={["VS"]}>
            <Surveys />
          </ProtectedRoute>
        } />

        {/* Candidate city preferences — public, no auth */}
        <Route path="/candidate/preferences" element={<CandidateForm />} />

        {/* Officer view: candidate preferences per exam */}
        <Route path="/preferences" element={
          <ProtectedRoute allowedRoles={["SO", "US", "DS", "JS", "ASO"]}>
            <CandidatePreferences />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
