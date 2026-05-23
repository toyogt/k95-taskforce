import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { REASSIGNMENT_TYPES } from '../../lib/constants'
import { formatDate, formatDateTime, todayISO } from '../../lib/helpers'
import toast from 'react-hot-toast'
import { Users, Plus, ArrowRight, Clock, X } from 'lucide-react'

export default function ReassignmentsPage() {
  const { profile } = useAuth()
  const [reassignments, setReassignments] = useState([])
  const [users, setUsers] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Form state
  const [reassignType, setReassignType] = useState('single_task')
  const [fromUser, setFromUser] = useState('')
  const [toUser, setToUser] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [rRes, uRes, tRes] = await Promise.all([
        supabase.from('reassignments').select(`
          *, from_user:profiles!reassignments_from_user_id_fkey(name),
          to_user:profiles!reassignments_to_user_id_fkey(name),
          task_templates(title)
        `).order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('id, name').eq('status', 'active'),
        supabase.from('task_templates').select('id, title').eq('is_active', true)
      ])
      setReassignments(rRes.data || [])
      setUsers(uRes.data || [])
      setTemplates(tRes.data || [])
    } catch (err) {
      toast.error('Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (fromUser === toUser) return toast.error('From and To user cannot be the same')

    try {
      const record = {
        from_user_id: fromUser,
        to_user_id: toUser,
        reassignment_type: reassignType,
        reason,
        created_by: profile.id,
        start_date: startDate,
        end_date: endDate || null,
        template_id: reassignType === 'single_task' ? templateId : null,
        status: 'active'
      }

      const { error } = await supabase.from('reassignments').insert(record)
      if (error) throw error

      // Update task instances if specific date or date range
      if (reassignType === 'single_task' && templateId) {
        await supabase.from('task_instances')
          .update({ assigned_to_id: toUser, status: 'reassigned', updated_at: new Date().toISOString() })
          .eq('template_id', templateId)
          .eq('assigned_to_id', fromUser)
          .eq('planned_date', startDate)
          .eq('status', 'pending')
      } else if (reassignType === 'specific_date') {
        await supabase.from('task_instances')
          .update({ assigned_to_id: toUser, updated_at: new Date().toISOString() })
          .eq('assigned_to_id', fromUser)
          .eq('planned_date', startDate)
          .in('status', ['pending'])
      } else if (reassignType === 'date_range' && endDate) {
        await supabase.from('task_instances')
          .update({ assigned_to_id: toUser, updated_at: new Date().toISOString() })
          .eq('assigned_to_id', fromUser)
          .gte('planned_date', startDate)
          .lte('planned_date', endDate)
          .in('status', ['pending'])
      }

      await supabase.from('audit_logs').insert({
        actor_user_id: profile.id, entity_type: 'reassignment',
        action: 'task_reassigned',
        new_value: JSON.stringify({ from: fromUser, to: toUser, type: reassignType })
      })

      toast.success('Tasks reassigned!')
      setShowModal(false)
      loadData()
    } catch (err) {
      toast.error(err.message || 'Failed to reassign')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reassignments</h1>
          <p className="page-subtitle">Transfer tasks between team members</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Reassignment
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : reassignments.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <h3>No reassignments yet</h3>
          <p>Use the button above to reassign tasks.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Task/Template</th>
                  <th>Date Range</th>
                  <th>Reason</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {reassignments.map(r => (
                  <tr key={r.id}>
                    <td><span className="badge badge-accent">{r.reassignment_type}</span></td>
                    <td style={{ fontWeight: 500 }}>{r.from_user?.name || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{r.to_user?.name || '—'}</td>
                    <td style={{ fontSize: 13 }}>{r.task_templates?.title || 'All tasks'}</td>
                    <td style={{ fontSize: 13 }}>
                      {formatDate(r.start_date)}
                      {r.end_date && <> → {formatDate(r.end_date)}</>}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.reason || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">New Reassignment</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={reassignType} onChange={e => setReassignType(e.target.value)}>
                  <option value="single_task">Single Task</option>
                  <option value="specific_date">All Tasks on Date</option>
                  <option value="date_range">Date Range</option>
                  <option value="permanent">Permanent</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">From User</label>
                  <select className="form-select" value={fromUser} onChange={e => setFromUser(e.target.value)} required>
                    <option value="">Select...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">To User</label>
                  <select className="form-select" value={toUser} onChange={e => setToUser(e.target.value)} required>
                    <option value="">Select...</option>
                    {users.filter(u => u.id !== fromUser).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              {reassignType === 'single_task' && (
                <div className="form-group">
                  <label className="form-label">Task Template</label>
                  <select className="form-select" value={templateId} onChange={e => setTemplateId(e.target.value)} required>
                    <option value="">Select task...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input type="date" className="form-input" value={startDate}
                    onChange={e => setStartDate(e.target.value)} required />
                </div>
                {['date_range'].includes(reassignType) && (
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input type="date" className="form-input" value={endDate}
                      onChange={e => setEndDate(e.target.value)} required />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <textarea className="form-textarea" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Why are tasks being reassigned?" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <ArrowRight size={16} /> Reassign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
