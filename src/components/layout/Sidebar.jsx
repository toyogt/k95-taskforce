import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES } from '../../lib/constants'
import {
  LayoutDashboard, CheckSquare, Users, Settings, BarChart3,
  Calendar, HelpCircle, ClipboardList, Shield, Building2,
  Bell, FileText, LogOut, Menu, X, ChevronRight, UserCircle
} from 'lucide-react'
import { useState } from 'react'

export default function Sidebar() {
  const { profile, roles, hasRole, hasAnyRole, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    // Doer items
    { to: '/my-tasks', icon: CheckSquare, label: 'My Tasks', show: true },
    { to: '/my-score', icon: BarChart3, label: 'My Score', show: true },
    { to: '/help-tickets', icon: HelpCircle, label: 'Help Tickets', show: true },

    // PC items
    { to: '/pc-dashboard', icon: LayoutDashboard, label: 'PC Dashboard', show: hasAnyRole([ROLES.PC, ROLES.ADMIN, ROLES.SUPER_ADMIN]) },
    { to: '/attendance', icon: Calendar, label: 'Attendance', show: hasAnyRole([ROLES.PC, ROLES.ADMIN, ROLES.SUPER_ADMIN]) },
    { to: '/reassignments', icon: Users, label: 'Reassignments', show: hasAnyRole([ROLES.PC, ROLES.ADMIN, ROLES.SUPER_ADMIN]) },

    // Manager
    { to: '/team-dashboard', icon: ClipboardList, label: 'Team Dashboard', show: hasRole(ROLES.MANAGER) },

    // Admin
    { to: '/admin/dashboard', icon: Shield, label: 'Admin Dashboard', show: hasAnyRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]) },
    { to: '/admin/users', icon: Users, label: 'User Management', show: hasAnyRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]) },
    { to: '/admin/departments', icon: Building2, label: 'Departments', show: hasAnyRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]) },
    { to: '/admin/task-templates', icon: FileText, label: 'Task Templates', show: hasAnyRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]) },
    { to: '/admin/holidays', icon: Calendar, label: 'Holidays', show: hasAnyRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]) },
    { to: '/admin/reminders', icon: Bell, label: 'Reminders', show: hasAnyRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]) },
    { to: '/admin/audit-logs', icon: FileText, label: 'Audit Logs', show: hasAnyRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]) },

    // MD
    { to: '/md-dashboard', icon: BarChart3, label: 'MD Dashboard', show: hasRole(ROLES.MD) },
  ].filter(item => item.show)

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="btn btn-icon"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          position: 'fixed', top: 12, left: 12, zIndex: 200,
          display: 'none', background: 'var(--bg-card)',
          border: '1px solid var(--border)'
        }}
        id="mobile-menu-toggle"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <style>{`
        @media (max-width: 768px) {
          #mobile-menu-toggle { display: flex !important; }
        }
      `}</style>

      {/* Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
        />
      )}

      <nav className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div style={{
          padding: '20px 20px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, color: '#fff'
          }}>K95</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>TaskForce</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Accountability System</div>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 8, marginBottom: 2,
                fontSize: 14, fontWeight: 500, textDecoration: 'none',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                transition: 'all 0.15s ease'
              })}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* User footer */}
        <div style={{
          padding: '14px 16px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'var(--accent)'
          }}>
            {profile?.name?.split(' ').map(w => w[0]).join('').slice(0, 2) || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.name || 'User'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {roles.join(', ')}
            </div>
          </div>
          <button onClick={handleSignOut} className="btn btn-icon" style={{ color: 'var(--text-muted)' }} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </nav>
    </>
  )
}
