import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { ATTENDANCE_STATUS } from '../../lib/constants'
import { formatDate, todayISO } from '../../lib/helpers'
import toast from 'react-hot-toast'
import { Calendar, UserCheck, UserX, Clock, Save } from 'lucide-react'

export default function AttendancePage() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [attendance, setAttendance] = useState({})
  const [date, setDate] = useState(todayISO())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [date])

  async function loadData() {
    setLoading(true)
    try {
      const [usersRes, attRes] = await Promise.all([
        supabase.from('profiles').select('id, name, department_id, departments(name)').eq('status', 'active'),
        supabase.from('attendance').select('*').eq('attendance_date', date)
      ])

      setUsers(usersRes.data || [])
      const attMap = {}
      ;(attRes.data || []).forEach(a => { attMap[a.user_id] = a })
      setAttendance(attMap)
    } catch (err) {
      toast.error('Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  function setStatus(userId, status) {
    setAttendance(prev => ({
      ...prev,
      [userId]: { ...prev[userId], user_id: userId, attendance_date: date, status }
    }))
  }

  async function saveAttendance() {
    setSaving(true)
    try {
      const records = Object.values(attendance).map(a => ({
        user_id: a.user_id,
        attendance_date: date,
        status: a.status || 'present',
        marked_by: profile.id
      }))

      // Upsert
      for (const rec of records) {
        await supabase.from('attendance').upsert(rec, {
          onConflict: 'user_id,attendance_date'
        })
      }

      // For absent users, cancel their pending tasks
      const absentUsers = records.filter(r => r.status === 'absent').map(r => r.user_id)
      if (absentUsers.length > 0) {
        await supabase.from('task_instances')
          .update({ status: 'skipped_approved', is_score_excluded: true, updated_at: new Date().toISOString() })
          .eq('planned_date', date)
          .in('status', ['pending'])
          .in('assigned_to_id', absentUsers)
      }

      await supabase.from('audit_logs').insert({
        actor_user_id: profile.id, entity_type: 'attendance',
        action: 'attendance_marked',
        new_value: JSON.stringify({ date, count: records.length })
      })

      toast.success('Attendance saved!')
    } catch (err) {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const statusBtn = (userId, status, label, color) => {
    const isActive = attendance[userId]?.status === status
    return (
      <button
        onClick={() => setStatus(userId, status)}
        className="btn btn-sm"
        style={{
          background: isActive ? color + '20' : 'transparent',
          color: isActive ? color : 'var(--text-muted)',
          border: `1px solid ${isActive ? color : 'var(--border)'}`,
          fontSize: 12
        }}>
        {label}
      </button>
    )
  }

  const stats = {
    present: Object.values(attendance).filter(a => a.status === 'present').length,
    absent: Object.values(attendance).filter(a => a.status === 'absent').length,
    leave: Object.values(attendance).filter(a => a.status === 'leave').length,
    halfDay: Object.values(attendance).filter(a => a.status === 'half_day').length,
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">{formatDate(date)}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="date" className="form-input" value={date}
            onChange={e => setDate(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="btn btn-primary" onClick={saveAttendance} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.present}</div>
          <div className="stat-label">Present</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.absent}</div>
          <div className="stat-label">Absent</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--info)' }}>{stats.leave}</div>
          <div className="stat-label">On Leave</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.halfDay}</div>
          <div className="stat-label">Half Day</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{u.departments?.name || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {statusBtn(u.id, 'present', 'Present', 'var(--success)')}
                        {statusBtn(u.id, 'absent', 'Absent', 'var(--danger)')}
                        {statusBtn(u.id, 'leave', 'Leave', 'var(--info)')}
                        {statusBtn(u.id, 'half_day', 'Half Day', 'var(--warning)')}
                      </div>
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
