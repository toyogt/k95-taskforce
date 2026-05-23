import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { STATUS_LABELS, STATUS_COLORS, SCORE_POINTS } from '../../lib/constants'
import { formatDate, formatTime, todayISO, calcScore } from '../../lib/helpers'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, Clock, AlertTriangle, CheckCircle2,
  ChevronDown, Search, Filter, Bell, RefreshCw, XCircle
} from 'lucide-react'

export default function PCDashboard() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('all')
  const [filterUser, setFilterUser] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [departments, setDepartments] = useState([])
  const [lateApprovalModal, setLateApprovalModal] = useState(null)
  const today = todayISO()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [tasksRes, usersRes, deptsRes] = await Promise.all([
        supabase.from('task_instances')
          .select('*, task_templates(title), profiles!task_instances_assigned_to_id_fkey(name, department_id)')
          .eq('planned_date', today)
          .order('planned_time', { ascending: true }),
        supabase.from('profiles').select('id, name, department_id, status').eq('status', 'active'),
        supabase.from('departments').select('id, name')
      ])
      setTasks(tasksRes.data || [])
      setUsers(usersRes.data || [])
      setDepartments(deptsRes.data || [])
    } catch (err) {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  async function allowLateCompletion(taskId) {
    try {
      await supabase.from('task_instances').update({
        status: 'pending',
        allow_late_done: true,
        updated_at: new Date().toISOString()
      }).eq('id', taskId)

      await supabase.from('audit_logs').insert({
        actor_user_id: profile.id, entity_type: 'task_instance',
        entity_id: taskId, action: 'late_completion_allowed'
      })

      toast.success('Late completion allowed')
      setLateApprovalModal(null)
      loadData()
    } catch (err) {
      toast.error('Failed')
    }
  }

  async function sendManualReminder(userId) {
    try {
      const user = users.find(u => u.id === userId)
      await supabase.from('reminder_logs').insert({
        user_id: userId, reminder_type: 'manual',
        sent_by: profile.id, sent_at: new Date().toISOString(),
        channel: 'email', status: 'sent'
      })
      toast.success(`Reminder sent to ${user?.name || 'user'}`)
    } catch (err) {
      toast.error('Failed to send reminder')
    }
  }

  // Filter tasks
  let filteredTasks = tasks
  if (filterUser) filteredTasks = filteredTasks.filter(t => t.assigned_to_id === filterUser)
  if (filterDept) filteredTasks = filteredTasks.filter(t => t.profiles?.department_id === filterDept)
  if (view === 'pending') filteredTasks = filteredTasks.filter(t => ['pending', 'reopened'].includes(t.status))
  if (view === 'done') filteredTasks = filteredTasks.filter(t => ['done_on_time', 'done_late'].includes(t.status))
  if (view === 'missed') filteredTasks = filteredTasks.filter(t => t.status === 'missed_locked')
  if (view === 'help') filteredTasks = filteredTasks.filter(t => ['help_raised', 'protected_pending'].includes(t.status))

  // Stats
  const total = tasks.length
  const pending = tasks.filter(t => ['pending', 'reopened'].includes(t.status)).length
  const done = tasks.filter(t => ['done_on_time', 'done_late'].includes(t.status)).length
  const missed = tasks.filter(t => t.status === 'missed_locked').length
  const helpRaised = tasks.filter(t => ['help_raised', 'protected_pending'].includes(t.status)).length

  // User-wise stats
  const userStats = users.map(u => {
    const userTasks = tasks.filter(t => t.assigned_to_id === u.id)
    const score = calcScore(userTasks)
    return {
      ...u,
      total: userTasks.length,
      pending: userTasks.filter(t => ['pending', 'reopened'].includes(t.status)).length,
      done: userTasks.filter(t => ['done_on_time', 'done_late'].includes(t.status)).length,
      missed: userTasks.filter(t => t.status === 'missed_locked').length,
      score: score.pct
    }
  }).filter(u => u.total > 0).sort((a, b) => b.pending - a.pending)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">PC Dashboard</h1>
          <p className="page-subtitle">{formatDate(today)} — {total} total tasks</p>
        </div>
        <button className="btn btn-ghost" onClick={loadData}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card" onClick={() => setView('all')} style={{ cursor: 'pointer' }}>
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card" onClick={() => setView('pending')} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card" onClick={() => setView('done')} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{done}</div>
          <div className="stat-label">Done</div>
        </div>
        <div className="stat-card" onClick={() => setView('missed')} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{missed}</div>
          <div className="stat-label">Missed</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select className="form-select" value={filterUser} onChange={e => setFilterUser(e.target.value)}
          style={{ maxWidth: 200 }}>
          <option value="">All Users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="form-select" value={filterDept} onChange={e => setFilterDept(e.target.value)}
          style={{ maxWidth: 200 }}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="tabs" style={{ border: 'none', marginBottom: 0 }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'done', label: 'Done' },
            { key: 'missed', label: 'Missed' },
            { key: 'help', label: `Help (${helpRaised})` },
          ].map(v => (
            <button key={v.key} className={`tab ${view === v.key ? 'active' : ''}`}
              onClick={() => setView(v.key)}>{v.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          {/* Task list */}
          <div>
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                Tasks ({filteredTasks.length})
              </h3>
              {filteredTasks.length === 0 ? (
                <div className="empty-state" style={{ padding: 30 }}>
                  <p>No tasks match the current filters.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Assigned To</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 500 }}>{t.title}</td>
                          <td style={{ fontSize: 13 }}>{t.profiles?.name || '—'}</td>
                          <td style={{ fontSize: 13 }}>{formatTime(t.planned_time)}</td>
                          <td>
                            <span className="badge" style={{
                              background: STATUS_COLORS[t.status] + '20',
                              color: STATUS_COLORS[t.status]
                            }}>{STATUS_LABELS[t.status]}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {t.status === 'missed_locked' && (
                                <button className="btn btn-sm btn-ghost"
                                  onClick={() => setLateApprovalModal(t)} title="Allow Late Completion">
                                  <Clock size={12} /> Allow Late
                                </button>
                              )}
                              <button className="btn btn-sm btn-ghost"
                                onClick={() => sendManualReminder(t.assigned_to_id)} title="Send Reminder">
                                <Bell size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* User-wise summary */}
          <div>
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>User Summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {userStats.map(u => (
                  <div key={u.id} onClick={() => setFilterUser(filterUser === u.id ? '' : u.id)}
                    style={{
                      padding: 12, borderRadius: 8, cursor: 'pointer',
                      background: filterUser === u.id ? 'var(--accent-soft)' : 'var(--bg-input)',
                      border: filterUser === u.id ? '1px solid var(--accent)' : '1px solid transparent'
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</span>
                      <span className={`badge ${u.score >= 80 ? 'badge-success' : u.score >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                        {u.score}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--warning)' }}>{u.pending} pending</span>
                      <span style={{ color: 'var(--success)' }}>{u.done} done</span>
                      <span style={{ color: 'var(--danger)' }}>{u.missed} missed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Late Approval Modal */}
      {lateApprovalModal && (
        <div className="modal-overlay" onClick={() => setLateApprovalModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Allow Late Completion</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              This will reopen the task "<strong>{lateApprovalModal.title}</strong>" and allow
              {' '}{lateApprovalModal.profiles?.name} to complete it. The score will be recorded as
              "Done Late" (60 points instead of 100).
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setLateApprovalModal(null)}>Cancel</button>
              <button className="btn btn-warning" onClick={() => allowLateCompletion(lateApprovalModal.id)}>
                <Clock size={16} /> Allow Late Completion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
