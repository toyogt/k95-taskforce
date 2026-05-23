import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDate, todayISO, calcScore } from '../../lib/helpers'
import { Shield, Users, CheckSquare, TrendingUp, Building2, Calendar } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, depts: 0, templates: 0, todayTasks: 0 })
  const [deptScores, setDeptScores] = useState([])
  const [topUsers, setTopUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const today = todayISO()

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)
    try {
      const [usersRes, deptsRes, templatesRes, todayTasksRes, scoresRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('departments').select('id, name'),
        supabase.from('task_templates').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('task_instances').select('*, profiles!task_instances_assigned_to_id_fkey(name, department_id)')
          .eq('planned_date', today),
        supabase.from('score_logs').select('*, profiles(name, department_id, departments(name))')
          .eq('period_type', 'daily').eq('score_date', today)
      ])

      setStats({
        users: usersRes.count || 0,
        depts: deptsRes.data?.length || 0,
        templates: templatesRes.count || 0,
        todayTasks: todayTasksRes.data?.length || 0
      })

      // Dept-wise scores
      const depts = deptsRes.data || []
      const tasks = todayTasksRes.data || []
      const dScores = depts.map(d => {
        const deptTasks = tasks.filter(t => t.profiles?.department_id === d.id)
        const score = calcScore(deptTasks)
        return { ...d, ...score, taskCount: deptTasks.length }
      }).filter(d => d.taskCount > 0).sort((a, b) => b.pct - a.pct)
      setDeptScores(dScores)

      // Top/bottom users by score
      const scores = scoresRes.data || []
      const sorted = scores.sort((a, b) => (b.score_percentage || 0) - (a.score_percentage || 0))
      setTopUsers(sorted.slice(0, 10))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Company-wide overview — {formatDate(today)}</p>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.users}</div>
          <div className="stat-label">Active Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--info)' }}>{stats.depts}</div>
          <div className="stat-label">Departments</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.templates}</div>
          <div className="stat-label">Task Templates</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.todayTasks}</div>
          <div className="stat-label">Today's Tasks</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Dept scores */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Department Scores — Today</h3>
          {deptScores.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No scores available yet.</p>
          ) : (
            deptScores.map(d => (
              <div key={d.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: d.pct >= 80 ? 'var(--success)' : d.pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                    {d.pct}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 3 }}>
                  <div style={{
                    height: '100%', borderRadius: 3, width: `${d.pct}%`,
                    background: d.pct >= 80 ? 'var(--success)' : d.pct >= 50 ? 'var(--warning)' : 'var(--danger)',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {d.taskCount} tasks • {d.earned}/{d.possible} points
                </div>
              </div>
            ))
          )}
        </div>

        {/* Top users */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Top Users — Today</h3>
          {topUsers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No scores calculated yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Dept</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map((u, i) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{u.profiles?.name || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.profiles?.departments?.name || '—'}</td>
                      <td>
                        <span className={`badge ${u.score_percentage >= 80 ? 'badge-success' : u.score_percentage >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                          {u.score_percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
