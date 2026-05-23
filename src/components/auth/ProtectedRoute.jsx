import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, profile, roles, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.status === 'pending_approval') {
    return (
      <div className="loading-screen">
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Account Pending Approval</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Your account is awaiting admin approval. You'll receive a notification once approved.
          </p>
        </div>
      </div>
    )
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasAccess = allowedRoles.some(r => roles.includes(r))
    if (!hasAccess) return <Navigate to="/my-tasks" replace />
  }

  return children
}
