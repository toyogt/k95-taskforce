import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { TASK_STATUS, STATUS_LABELS, STATUS_COLORS, SCORE_POINTS } from '../../lib/constants'
import { formatDate, formatTime, todayISO, calcScore } from '../../lib/helpers'
import toast from 'react-hot-toast'
import {
  CheckCircle2, Clock, AlertTriangle, HelpCircle, ChevronDown,
  ImagePlus, MessageSquare, MoreVertical, CheckSquare, Eye, Undo2, Filter
} from 'lucide-react'

export default function MyTasksPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [selectedTasks, setSelectedTasks] = useState(new Set())
  const [remarkModal, setRemarkModal] = useState(null)
  const [remark, setRemark] = useState('')
  const [ticketModal, setTicketModal] = useState(null)
  const [detailModal, setDetailModal] = useState(null)

  const today = todayISO()

  const loadTasks = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      let query = supabase
        .from('task_instances')
        .select('*, task_templates(title, allow_bulk_done, requires_image, requires_file)')
        .eq('assigned_to_id', profile.id)
        .order('planned_date', { ascending: true })
        .order('planned_time', { ascending: true })

      if (filter === 'pending') {
        query = query.in('status', ['pending', 'reopened', 'help_raised', 'protected_pending'])
          .eq('planned_date', today)
      } else if (filter === 'upcoming') {
        query = query.in('status', ['pending'])
          .gt('planned_date', today)
      } else if (filter === 'completed') {
        query = query.in('status', ['done_on_time', 'done_late'])
          .eq('planned_date', today)
      } else if (filter === 'missed') {
        query = query.eq('status', 'missed_locked')
      } else if (filter === 'all') {
        query = query.eq('planned_date', today)
      }

      const { data, error } = await query
      if (error) throw error
      setTasks(data || [])
    } catch (err) {
      toast.error('Failed to load tasks')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [profile?.id, filter, today])

  useEffect(() => { loadTasks() }, [loadTasks])

  async function markDone(taskId, remarkText = '') {
    try {
      const { error } = await supabase
        .from('task_instances')
        .update({
          status: 'done_on_time',
          completed_at: new Date().toISOString(),
          completed_by: profile.id,
          remark: remarkText || null,
          score_points: SCORE_POINTS.DONE_ON_TIME,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('assigned_to_id', profile.id)
        .eq('planned_date', today)

      if (error) throw error

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_user_id: profile.id,
        entity_type: 'task_instance',
        entity_id: taskId,
        action: 'task_marked_done',
        new_value: JSON.stringify({ status: 'done_on_time', remark: remarkText })
      })

      toast.success('Task marked as done!')
      loadTasks()
    } catch (err) {
      toast.error(err.message || 'Failed to mark done')
    }
  }

  async function undoDone(taskId) {
    try {
      const { error } = await supabase
        .from('task_instances')
        .update({
          status: 'reopened',
          completed_at: null,
          completed_by: null,
          score_points: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('assigned_to_id', profile.id)

      if (error) throw error

      await supabase.from('audit_logs').insert({
        actor_user_id: profile.id,
        entity_type: 'task_instance',
        entity_id: taskId,
        action: 'task_undone',
      })

      toast.success('Task reopened')
      loadTasks()
    } catch (err) {
      toast.error('Failed to undo')
    }
  }

  async function bulkMarkDone() {
    const eligible = tasks.filter(t =>
      selectedTasks.has(t.id) &&
      t.planned_date === today &&
      t.status === 'pending' &&
      !t.task_templates?.requires_image &&
      !t.task_templates?.requires_file &&
      t.task_templates?.allow_bulk_done !== false
    )

    if (eligible.length === 0) return toast.error('No eligible tasks selected')

    try {
      for (const task of eligible) {
        await supabase
          .from('task_instances')
          .update({
            status: 'done_on_time',
            completed_at: new Date().toISOString(),
            completed_by: profile.id,
            score_points: SCORE_POINTS.DONE_ON_TIME,
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id)
      }

      await supabase.from('audit_logs').insert({
        actor_user_id: profile.id,
        entity_type: 'task_instance',
        entity_id: eligible[0].id,
        action: 'bulk_mark_done',
        new_value: JSON.stringify({ count: eligible.length, ids: eligible.map(t => t.id) })
      })

      toast.success(`${eligible.length} tasks marked done!`)
      setSelectedTasks(new Set())
      loadTasks()
    } catch (err) {
      toast.error('Bulk done failed')
    }
  }

  function toggleSelect(id) {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const score = calcScore(tasks)
  const pendingCount = tasks.filter(t => ['pending', 'reopened'].includes(t.status)).length
  const doneCount = tasks.filter(t => ['done_on_time', 'done_late'].includes(t.status)).length
  const missedCount = tasks.filter(t => t.status === 'missed_locked').length

  const filters = [
    { key: 'pending', label: 'Pending', count: null },
    { key: 'upcoming', label: 'Upcoming', count: null },
    { key: 'completed', label: 'Completed', count: null },
    { key: 'missed', label: 'Missed', count: null },
    { key: 'all', label: 'All Today', count: null },
  ]

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Tasks</h1>
          <p className="page-subtitle">{formatDate(today)} — {tasks.length} tasks</p>
        </div>
        {selectedTasks.size > 0 && (
          <button className="btn btn-success" onClick={bulkMarkDone}>
            <CheckSquare size={16} /> Mark {selectedTasks.size} Done
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{pendingCount}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{doneCount}</div>
          <div className="stat-label">Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{missedCount}</div>
          <div className="stat-label">Missed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{score.pct}%</div>
          <div className="stat-label">Score</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {filters.map(f => (
          <button key={f.key} className={`tab ${filter === f.key ? 'active' : ''}`}
            onClick={() => { setFilter(f.key); setSelectedTasks(new Set()) }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <CheckCircle2 size={48} />
          <h3>{filter === 'pending' ? 'All caught up!' : 'No tasks found'}</h3>
          <p>{filter === 'pending' ? 'No pending tasks for today.' : 'Try a different filter.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map(task => (
            <div key={task.id} className="task-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Checkbox for bulk - only pending today tasks */}
                {filter === 'pending' && task.status === 'pending' && task.planned_date === today &&
                  !task.task_templates?.requires_image && task.task_templates?.allow_bulk_done !== false && (
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(task.id)}
                    onChange={() => toggleSelect(task.id)}
                    style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--accent)' }}
                  />
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span className="task-title">{task.title}</span>
                    <span className="badge" style={{
                      background: STATUS_COLORS[task.status] + '20',
                      color: STATUS_COLORS[task.status]
                    }}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </div>

                  <div className="task-meta">
                    <span><Clock size={12} /> {formatTime(task.planned_time)}</span>
                    <span>{formatDate(task.planned_date)}</span>
                    {task.description && <span style={{ color: 'var(--text-muted)' }}>— {task.description?.slice(0, 60)}</span>}
                  </div>

                  {task.remark && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      "{task.remark}"
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {task.status === 'pending' && task.planned_date === today && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => markDone(task.id)}
                        title="Mark Done">
                        <CheckCircle2 size={14} /> Done
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setRemarkModal(task.id); setRemark('') }}
                        title="Add Remark">
                        <MessageSquare size={14} />
                      </button>
                    </>
                  )}
                  {task.status === 'reopened' && task.planned_date === today && (
                    <button className="btn btn-success btn-sm" onClick={() => markDone(task.id)}>
                      <CheckCircle2 size={14} /> Done
                    </button>
                  )}
                  {['done_on_time', 'done_late'].includes(task.status) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => undoDone(task.id)} title="Undo">
                      <Undo2 size={14} />
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => setTicketModal(task)}
                    title="Help Ticket" style={{ color: 'var(--warning)' }}>
                    <HelpCircle size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Remark Modal */}
      {remarkModal && (
        <div className="modal-overlay" onClick={() => setRemarkModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Add Remark & Complete</h3>
            <div className="form-group">
              <label className="form-label">Remark (optional)</label>
              <textarea className="form-textarea" value={remark}
                onChange={e => setRemark(e.target.value)} placeholder="Any notes..." />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRemarkModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={() => { markDone(remarkModal, remark); setRemarkModal(null) }}>
                <CheckCircle2 size={16} /> Mark Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Ticket Modal */}
      {ticketModal && <HelpTicketModal task={ticketModal} profile={profile}
        onClose={() => setTicketModal(null)} onCreated={loadTasks} />}
    </div>
  )
}

function HelpTicketModal({ task, profile, onClose, onCreated }) {
  const [ticketType, setTicketType] = useState('general_query')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('help_tickets').insert({
        task_instance_id: task.id,
        requested_by: profile.id,
        ticket_type: ticketType,
        subject,
        description,
        status: 'open',
        score_protected: true
      })
      if (error) throw error

      // Update task status to protected
      await supabase.from('task_instances').update({
        status: 'protected_pending',
        is_score_excluded: true,
        updated_at: new Date().toISOString()
      }).eq('id', task.id)

      await supabase.from('audit_logs').insert({
        actor_user_id: profile.id,
        entity_type: 'help_ticket',
        entity_id: task.id,
        action: 'help_ticket_created',
        new_value: JSON.stringify({ ticket_type: ticketType, subject })
      })

      toast.success('Help ticket created!')
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Failed to create ticket')
    } finally {
      setLoading(false)
    }
  }

  const types = [
    { value: 'task_detail_change', label: 'Task Detail Change' },
    { value: 'time_change', label: 'Time Change' },
    { value: 'frequency_change', label: 'Frequency Change' },
    { value: 'reassignment_request', label: 'Reassignment Request' },
    { value: 'blocked_task', label: 'Blocked Task' },
    { value: 'task_deletion_request', label: 'Task Deletion Request' },
    { value: 'general_query', label: 'General Query' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Raise Help Ticket</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Task: {task.title}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Ticket Type</label>
            <select className="form-select" value={ticketType} onChange={e => setTicketType(e.target.value)}>
              {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)}
              required placeholder="Brief subject" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)}
              required placeholder="Describe the issue..." />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-warning" disabled={loading}>
              {loading ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
