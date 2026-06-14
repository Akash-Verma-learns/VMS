import type { ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequireRole } from './auth/guards'
import { AppLayout } from './components/AppLayout'
import { NAV_SECTIONS } from './config/nav'
import { DashboardPage } from './pages/DashboardPage'
import { FeatureStubPage } from './pages/FeatureStubPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { LoginPage } from './pages/LoginPage'
// Internal portal
import { ExamsListPage } from './pages/internal/ExamsListPage'
import { ExamCreatePage } from './pages/internal/ExamCreatePage'
import { ExamDetailPage } from './pages/internal/ExamDetailPage'
import { CentreManagementPage } from './pages/internal/CentreManagementPage'
import { VenueReviewQueuePage } from './pages/internal/VenueReviewQueuePage'
import { ApprovalsPage } from './pages/internal/ApprovalsPage'
import { FalPage } from './pages/internal/FalPage'
import { AdvanceCalcPage } from './pages/internal/AdvanceCalcPage'
import { BillsPage } from './pages/internal/BillsPage'
import { UserManagementPage } from './pages/internal/UserManagementPage'
// External portal
import { VenueBankPage } from './pages/external/VenueBankPage'
import { AssignmentsPage } from './pages/external/AssignmentsPage'
import { DiffPage } from './pages/external/DiffPage'
import { SubmitPage } from './pages/external/SubmitPage'
import { ExternalBillsPage } from './pages/external/ExternalBillsPage'
import { FalAckPage } from './pages/external/FalAckPage'
import './App.css'

// Path -> page component. Any nav path without an entry falls back to a stub.
const ROUTE_COMPONENTS: Record<string, ComponentType> = {
  '/exams/new': ExamCreatePage,
  '/exams': ExamsListPage,
  '/centres': CentreManagementPage,
  '/venues/review': VenueReviewQueuePage,
  '/approvals': ApprovalsPage,
  '/fal': FalPage,
  '/finance/advance': AdvanceCalcPage,
  '/finance/bills': BillsPage,
  '/users': UserManagementPage,
  '/venue-bank': VenueBankPage,
  '/assignments': AssignmentsPage,
  '/assignments/diff': DiffPage,
  '/assignments/submit': SubmitPage,
  '/external/bills': ExternalBillsPage,
  '/external/fal': FalAckPage,
}

const FEATURE_ROUTES = NAV_SECTIONS.flatMap((s) => s.items).filter((i) => i.path !== '/dashboard')

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        {/* Exam detail isn't a nav item but is reachable from the exams list */}
        <Route
          path="/exams/:id"
          element={<RequireRole roles={['ASO', 'SO', 'US', 'DS', 'JS']}><ExamDetailPage /></RequireRole>}
        />

        {FEATURE_ROUTES.map((item) => {
          const Page = ROUTE_COMPONENTS[item.path] ?? FeatureStubPage
          return (
            <Route
              key={item.path}
              path={item.path}
              element={<RequireRole roles={item.roles}><Page /></RequireRole>}
            />
          )
        })}
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
