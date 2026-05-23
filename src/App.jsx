import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'

// Auth pages
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'

// Doer pages
import MyTasksPage from './pages/doer/MyTasksPage'
import MyScorePage from './pages/doer/MyScorePage'
import HelpTicketsPage from './pages/doer/HelpTicketsPage'

// PC pages
import PCDashboard from './pages/pc/PCDashboard'
import AttendancePage from './pages/pc/AttendancePage'
import ReassignmentsPage from './pages/pc/ReassignmentsPage'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import DepartmentManagement from './pages/admin/DepartmentManagement'
import TaskTemplateManagement from './pages/admin/TaskTemplateManagement'
import HolidayManagement from './pages/admin/HolidayManagement'
import AuditLogsPage from './pages/admin/AuditLogsPage'

// MD pages
import MDDashboard from './pages/md/MDDashboard'

export default function App() {
  return (
    <BrowserRouter basename="/taskforce">
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #313244' },
          success: { iconTheme: { primary: '#16a34a', secondary: '#1e1e2e' } },
          error: { iconTheme: { primary: '#dc2626', secondary: '#1e1e2e' } },
        }} />

        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected — Doer (all authenticated users) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/my-tasks" replace />} />
              <Route path="/my-tasks" element={<MyTasksPage />} />
              <Route path="/my-score" element={<MyScorePage />} />
              <Route path="/help-tickets" element={<HelpTicketsPage />} />
            </Route>
          </Route>

          {/* Protected — PC */}
          <Route element={<ProtectedRoute allowedRoles={['pc', 'admin', 'super_admin']} />}>
            <Route element={<AppLayout />}>
              <Route path="/pc" element={<PCDashboard />} />
              <Route path="/pc/attendance" element={<AttendancePage />} />
              <Route path="/pc/reassignments" element={<ReassignmentsPage />} />
            </Route>
          </Route>

          {/* Protected — Admin */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/departments" element={<DepartmentManagement />} />
              <Route path="/admin/templates" element={<TaskTemplateManagement />} />
              <Route path="/admin/holidays" element={<HolidayManagement />} />
              <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            </Route>
          </Route>

          {/* Protected — MD */}
          <Route element={<ProtectedRoute allowedRoles={['md', 'admin', 'super_admin']} />}>
            <Route element={<AppLayout />}>
              <Route path="/md" element={<MDDashboard />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/my-tasks" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
