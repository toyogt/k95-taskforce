import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDate, calcScore, todayISO } from '../../lib/helpers'
import { ROLE_LABELS, STATUS_COLORS, STATUS_LABELS } from '../../lib/constants'
import { useAuth } from '../../contexts/AuthContext'
import {
  BarChart3, TrendingUp, Users, Building2, Award, AlertTriangle,
  ChevronDown, ChevronUp, Calendar, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function MDDashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('today') // today | week | month
  const [companyStats, setCompanyStats] = useState({ total: 0, done: 0, missed: 0, pending: 0, score: 0 })
  const [deptRankings, setDeptRankings] = useState([])
  const [userRankings, setUserRankings] = useState([])
  const [recentMissed, setRecentMissed] = useState([])
  const [trends, setTrends] = useState([])
  const [expandedDept, setExpandedDept] = useState(null)
  const [activeTab, setActiveTab] = useState('overview') // overview | departments | users | trends

  useEffect(() => { fetchDashboard() }, [period])

  async function fetchDashboard() {
    setLoading(true)
    try {
      const today = todayISO()

      // Build date range based on period
      let dateFrom = today, dateTo = today
      if (period === 'week') {
        const d = new Date()
        d.setDate(d.getDate() - d.getDay() + 1)
        dateFrom = d.toISOString().split('T')[0]
      } else if (period === 'month') {
        dateFrom = today.slice(0, 8) + '01'
      }

      // Fetch all task instances in range
      const { data: tasks, error: tErr } = await supabase
        .from('task_instances')
        .select(`
          id, status, due_date, completed_at, is_score_excluded,
          task_template:task_template_id (title, department_id),
          assigned_user:assigned_to (id, full_name, department_id)
        `)
        .gte('due_date', dateFrom)
        .lte('due_date', dateTo)

      if (tErr) throw tErr
      const allTasks = tasks || []

      // Company-wide stats
      const done = allTasks.filter(t => ['done_on_time', 'done_late'].includes(t.status)).length
      const missed = allTasks.filter(t => t.status === 'missed_locked').length
      const pending = allTasks.filter(t => ['pending', 'reopened'].includes(t.status)).length
      const scoreData = calcScore(allTasks)
      setCompanyStats({ total: allTasks.length, done, missed, pending, score: scoreData.pct })

      // Department rankings
      const { data: depts } = await supabase.from('departments').select('id, name')
      const deptMap = {}
      ;(depts || []).forEach(d => { deptMap[d.id] = { ...d, tasks: [] } })

      allTasks.forEach(t => {
        const deptId = t.task_template?.department_id || t.assigned_user?.department_id
        if (deptId && deptMap[deptId]) deptMap[deptId].tasks.push(t)
      })

      const deptRanks = Object.values(deptMap).map(d => {
        const sc = calcScore(d.tasks)
        return {
          id: d.id,
          name: d.name,
          total: d.tasks.length,
          done: d.tasks.filter(t => ['done_on_time', 'done_late'].includes(t.status)).length,
          missed: d.tasks.filter(t => t.status === 'missed_locked').length,
          score: sc.pct,
          tasks: d.tasks
        }
      }).sort((a, b) => b.score - a.score)
      setDeptRankings(deptRanks)

      // User rankings
      const userMap = {}
      allTasks.forEach(t => {
        const uid = t.assigned_user?.id
        if (!uid) return
        if (!userMap[uid]) userMap[uid] = { id: uid, name: t.assigned_user.full_name, tasks: [] }
        userMap[uid].tasks.push(t)
      })

      const userRanks = Object.values(userMap).map(u => {
        const sc = calcScore(u.tasks)
        return {
          id: u.id,
          name: u.name,
          total: u.tasks.length,
          done: u.tasks.filter(t => ['done_on_time', 'done_late'].includes(t.status)).length,
          missed: u.tasks.filter(t => t.status === 'missed_locked').length,
          onTime: u.tasks.filter(t => t.status === 'done_on_time').length,
          late: u.tasks.filter(t => t.status === 'done_late').length,
          score: sc.pct
        }
      }).sort((a, b) => b.score - a.score)
      setUserRankings(userRanks)

      // Recent missed tasks
      const missedTasks = allTasks
        .filter(t => t.status === 'missed_locked')
        .sort((a, b) => new Date(b.due_date) - new Date(a.due_date))
        .slice(0, 10)
      setRecentMissed(missedTasks)

      // Weekly trends (last 4 weeks)
      if (period === 'month') {
        const trendData = []
        for (let w = 3; w >= 0; w--) {
          const wEnd = new Date()
          wEnd.setDate(wEnd.getDate() - (w * 7))
          const wStart = new Date(wEnd)
          wStart.setDate(wStart.getDate() - 6)
          const wTasks = allTasks.filter(t => {
            const d = new Date(t.due_date)
            return d >= wStart && d <= wEnd
          })
          const sc = calcScore(wTasks)
          trendData.push({
            label: `Week ${4 - w}`,
            score: sc.pct,
            total: wTasks.length,
            done: wTasks.filter(t => ['done_on_time', 'done_late'].includes(t.status)).length
          })
        }
        setTrends(trendData)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  function getScoreColor(score) {
    if (score >= 90) return '#16a34a'
    if (score >= 70) return '#f59e0b'
    if (score >= 50) return '#ea580c'
    return '#dc2626'
  }

  function getRankBadge(i) {
    if (i === 0) return '🥇'
    if (i === 1) return '🥈'
    if (i === 2) return '🥉'
    return `#${i + 1}`
  }

  if (loading) {
    return <div className="page-container"><div className="loading-spinner">Loading dashboard...</div></div>
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Management Dashboard</h1>
          <p className="page-subtitle">Company-wide accountability overview</p>
        </div>
        <div className="filter-group">
          {['today', 'week', 'month'].map(p => (
            <button key={p} className={`filter-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}>
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Company Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
            <BarChart3 size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Company Score</span>
            <span className="stat-value" style={{ color: getScoreColor(companyStats.score) }}>
              {companyStats.score}%
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(22,163,106,0.15)', color: '#16a34a' }}>
            <Award size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{companyStats.done}/{companyStats.total}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Missed</span>
            <span className="stat-value">{companyStats.missed}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <Calendar size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Pending</span>
            <span className="stat-value">{companyStats.pending}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'departments', label: 'Departments', icon: Building2 },
          { key: 'users', label: 'User Rankings', icon: Users },
          { key: 'trends', label: 'Trends', icon: TrendingUp },
        ].map(tab => (
          <button key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}>
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid-2col">
          {/* Top Departments */}
          <div className="card">
            <div className="card-header">
              <h3>Department Rankings</h3>
            </div>
            <div className="card-body">
              {deptRankings.length === 0 ? (
                <p className="empty-state">No department data</p>
              ) : deptRankings.slice(0, 5).map((dept, i) => (
                <div key={dept.id} className="ranking-row">
                  <span className="rank-badge">{getRankBadge(i)}</span>
                  <div className="rank-info">
                    <span className="rank-name">{dept.name}</span>
                    <span className="rank-detail">{dept.done}/{dept.total} done</span>
                  </div>
                  <div className="rank-score" style={{ color: getScoreColor(dept.score) }}>
                    {dept.score}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Users */}
          <div className="card">
            <div className="card-header">
              <h3>Top Performers</h3>
            </div>
            <div className="card-body">
              {userRankings.length === 0 ? (
                <p className="empty-state">No user data</p>
              ) : userRankings.slice(0, 5).map((user, i) => (
                <div key={user.id} className="ranking-row">
                  <span className="rank-badge">{getRankBadge(i)}</span>
                  <div className="rank-info">
                    <span className="rank-name">{user.name}</span>
                    <span className="rank-detail">{user.onTime} on time, {user.late} late</span>
                  </div>
                  <div className="rank-score" style={{ color: getScoreColor(user.score) }}>
                    {user.score}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Missed */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <h3>Recent Missed Tasks</h3>
              <span className="badge badge-danger">{recentMissed.length}</span>
            </div>
            <div className="card-body">
              {recentMissed.length === 0 ? (
                <p className="empty-state">No missed tasks — great!</p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Assigned To</th>
                        <th>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentMissed.map(t => (
                        <tr key={t.id}>
                          <td>{t.task_template?.title || '—'}</td>
                          <td>{t.assigned_user?.full_name || '—'}</td>
                          <td>{formatDate(t.due_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div className="card">
          <div className="card-body">
            {deptRankings.map((dept, i) => (
              <div key={dept.id} className="dept-accordion">
                <div className="ranking-row clickable"
                  onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}>
                  <span className="rank-badge">{getRankBadge(i)}</span>
                  <div className="rank-info">
                    <span className="rank-name">{dept.name}</span>
                    <span className="rank-detail">
                      {dept.total} tasks · {dept.done} done · {dept.missed} missed
                    </span>
                  </div>
                  <div className="rank-score" style={{ color: getScoreColor(dept.score) }}>
                    {dept.score}%
                  </div>
                  {expandedDept === dept.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
                {expandedDept === dept.id && (
                  <div className="dept-detail">
                    {dept.tasks.length === 0 ? (
                      <p className="empty-state">No tasks in this period</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm">
                          <thead>
                            <tr><th>Task</th><th>Assigned To</th><th>Status</th><th>Due</th></tr>
                          </thead>
                          <tbody>
                            {dept.tasks.map(t => (
                              <tr key={t.id}>
                                <td>{t.task_template?.title || '—'}</td>
                                <td>{t.assigned_user?.full_name || '—'}</td>
                                <td>
                                  <span className="badge" style={{
                                    background: STATUS_COLORS[t.status] + '20',
                                    color: STATUS_COLORS[t.status]
                                  }}>
                                    {STATUS_LABELS[t.status] || t.status}
                                  </span>
                                </td>
                                <td>{formatDate(t.due_date)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Total</th>
                    <th>On Time</th>
                    <th>Late</th>
                    <th>Missed</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {userRankings.map((user, i) => (
                    <tr key={user.id}>
                      <td>{getRankBadge(i)}</td>
                      <td className="fw-medium">{user.name}</td>
                      <td>{user.total}</td>
                      <td style={{ color: '#16a34a' }}>{user.onTime}</td>
                      <td style={{ color: '#ea580c' }}>{user.late}</td>
                      <td style={{ color: '#dc2626' }}>{user.missed}</td>
                      <td>
                        <span className="fw-bold" style={{ color: getScoreColor(user.score) }}>
                          {user.score}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="card">
          <div className="card-header">
            <h3>Weekly Score Trend</h3>
          </div>
          <div className="card-body">
            {period !== 'month' ? (
              <p className="empty-state">Select "This Month" to view weekly trends</p>
            ) : trends.length === 0 ? (
              <p className="empty-state">No trend data available</p>
            ) : (
              <div className="trend-bars">
                {trends.map((w, i) => (
                  <div key={i} className="trend-item">
                    <div className="trend-bar-container">
                      <div className="trend-bar" style={{
                        height: `${Math.max(w.score, 5)}%`,
                        background: getScoreColor(w.score)
                      }} />
                    </div>
                    <span className="trend-label">{w.label}</span>
                    <span className="trend-score" style={{ color: getScoreColor(w.score) }}>
                      {w.score}%
                    </span>
                    <span className="trend-detail">{w.done}/{w.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
