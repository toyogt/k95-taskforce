import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/helpers'
import { BarChart3, TrendingUp, Calendar, Award } from 'lucide-react'

export default function MyScorePage() {
  const { profile } = useAuth()
  const [scores, setScores] = useState([])
  const [period, setPeriod] = useState('daily')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    loadScores()
  }, [profile?.id, period])

  async function loadScores() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('score_logs')
        .select('*')
        .eq('user_id', profile.id)
        .eq('period_type', period)
        .order('score_date', { ascending: false })
        .limit(30)
      setScores(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const latestScore = scores[0]
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, sc) => s + (sc.score_percentage || 0), 0) / scores.length)
    : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Score</h1>
          <p className="page-subtitle">Track your performance</p>
        </div>
      </div>

      {/* Score overview */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>
            {latestScore?.score_percentage || 0}%
          </div>
          <div className="stat-label">Latest Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{avgScore}%</div>
          <div className="stat-label">Average</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {latestScore?.done_on_time || 0}
          </div>
          <div className="stat-label">On Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {latestScore?.missed || 0}
          </div>
          <div className="stat-label">Missed</div>
        </div>
      </div>

      {/* Period tabs */}
      <div className="tabs">
        {['daily', 'weekly', 'monthly'].map(p => (
          <button key={p} className={`tab ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Score history */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : scores.length === 0 ? (
        <div className="empty-state">
          <BarChart3 size={48} />
          <h3>No scores yet</h3>
          <p>Scores will appear once tasks are calculated.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total</th>
                  <th>On Time</th>
                  <th>Late</th>
                  <th>Missed</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {scores.map(s => (
                  <tr key={s.id}>
                    <td>{formatDate(s.score_date)}</td>
                    <td>{s.total_tasks}</td>
                    <td style={{ color: 'var(--success)' }}>{s.done_on_time}</td>
                    <td style={{ color: 'var(--warning)' }}>{s.done_late}</td>
                    <td style={{ color: 'var(--danger)' }}>{s.missed}</td>
                    <td>
                      <span className={`badge ${s.score_percentage >= 80 ? 'badge-success' :
                        s.score_percentage >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                        {s.score_percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
