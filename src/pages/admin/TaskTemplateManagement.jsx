import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { FREQUENCY_TYPES, WEEKDAYS, WEEKDAY_LABELS } from '../../lib/constants'
import { formatDateTime } from '../../lib/helpers'
import toast from 'react-hot-toast'
import { FileText, Plus, Edit2, Trash2, Save, Copy, ToggleLeft, ToggleRight } from 'lucide-react'

export default function TaskTemplateManagement() {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState([])
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [deptId, setDeptId] = useState('')
  const [freqType, setFreqType] = useState('daily')
  const [freqDays, setFreqDays] = useState([])
  const [monthDay, setMonthDay] = useState(1)
  const [nthWeek, setNthWeek] = useState(1)
  const [nthWeekday, setNthWeekday] = useState('MON')
  const [plannedTime, setPlannedTime] = useState('10:00')
  const [deadlineTime, setDeadlineTime] = useState('18:00')
  const [allowBulk, setAllowBulk] = useState(true)
  const [requiresImage, setRequiresImage] = useState(false)
  const [isActive, setIsActive] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [tRes, uRes, dRes] = await Promise.all([
        supabase.from('task_templates').select('*, profiles!task_templates_default_assignee_id_fkey(name), departments(name)')
          .order('title'),
        supabase.from('profiles').select('id, name').eq('status', 'active'),
        supabase.from('departments').select('id, name')
      ])
      setTemplates(tRes.data || [])
      setUsers(uRes.data || [])
      setDepartments(dRes.data || [])
    } catch (err) {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditId(null); setTitle(''); setDescription(''); setAssigneeId(''); setDeptId('')
    setFreqType('daily'); setFreqDays([]); setMonthDay(1); setNthWeek(1); setNthWeekday('MON')
    setPlannedTime('10:00'); setDeadlineTime('18:00'); setAllowBulk(true); setRequiresImage(false)
    setIsActive(true); setShowModal(true)
  }

  function openEdit(t) {
    setEditId(t.id); setTitle(t.title); setDescription(t.description || '')
    setAssigneeId(t.default_assignee_id || ''); setDeptId(t.department_id || '')
    setFreqType(t.frequency_type || 'daily')
    const cfg = t.frequency_config || {}
    setFreqDays(cfg.days || []); setMonthDay(cfg.day_of_month || 1)
    setNthWeek(cfg.nth || 1); setNthWeekday(cfg.weekday || 'MON')
    setPlannedTime(t.planned_time || '10:00'); setDeadlineTime(t.deadline_time || '18:00')
    setAllowBulk(t.allow_bulk_done !== false); setRequiresImage(!!t.requires_image)
    setIsActive(t.is_active !== false); setShowModal(true)
  }

  function buildFreqConfig() {
    switch (freqType) {
      case 'weekly_days': return { days: freqDays }
      case 'monthly_date': return { day_of_month: monthDay }
      case 'monthly_nth_weekday': return { nth: nthWeek, weekday: nthWeekday }
      case 'last_weekday_of_month': return { weekday: nthWeekday }
      default: return {}
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    try {
      const record = {
        title, description: description || null,
        default_assignee_id: assigneeId || null,
        department_id: deptId || null,
        frequency_type: freqType,
        frequency_config: buildFreqConfig(),
        planned_time: plannedTime,
        deadline_time: deadlineTime,
        allow_bulk_done: allowBulk,
        requires_image: requiresImage,
        is_active: isActive,
        created_by: profile.id
      }

      if (editId) {
        await supabase.from('task_templates').update(record).eq('id', editId)
      } else {
        await supabase.from('task_templates').insert(record)
      }

      toast.success(editId ? 'Template updated!' : 'Template created!')
      setShowModal(false); loadData()
    } catch (err) {
      toast.error(err.message || 'Failed to save')
    }
  }

  async function toggleActive(id, current) {
    await supabase.from('task_templates').update({ is_active: !current }).eq('id', id)
    loadData()
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template? Future task instances will stop being generated.')) return
    try {
      await supabase.from('task_templates').delete().eq('id', id)
      toast.success('Deleted')
      loadData()
    } catch (err) {
      toast.error('Cannot delete — template may have associated instances')
    }
  }

  function toggleDay(day) {
    setFreqDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Task Templates</h1>
          <p className="page-subtitle">{templates.length} templates</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> New Template</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Assignee</th>
                  <th>Department</th>
                  <th>Frequency</th>
                  <th>Time</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id} style={{ opacity: t.is_active ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 600 }}>{t.title}</td>
                    <td style={{ fontSize: 13 }}>{t.profiles?.name || '—'}</td>
                    <td style={{ fontSize: 13 }}>{t.departments?.name || '—'}</td>
                    <td><span className="badge badge-accent">{t.frequency_type}</span></td>
                    <td style={{ fontSize: 13 }}>{t.planned_time}</td>
                    <td>
                      <button className="btn btn-icon" onClick={() => toggleActive(t.id, t.is_active)}
                        style={{ color: t.is_active ? 'var(--success)' : 'var(--text-muted)' }}>
                        {t.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(t)}><Edit2 size={13} /></button>
                        <button className="btn btn-sm btn-ghost" onClick={() => deleteTemplate(t.id)}
                          style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <h3 className="modal-title">{editId ? 'Edit' : 'New'} Task Template</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} required
                  placeholder="e.g., Check freezer temperature" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Detailed instructions..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Default Assignee</label>
                  <select className="form-select" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={deptId} onChange={e => setDeptId(e.target.value)}>
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Frequency */}
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select className="form-select" value={freqType} onChange={e => setFreqType(e.target.value)}>
                  <option value="daily">Daily (Mon-Sat)</option>
                  <option value="weekly_days">Specific Weekdays</option>
                  <option value="monthly_date">Monthly on Date</option>
                  <option value="monthly_nth_weekday">Monthly Nth Weekday</option>
                  <option value="last_weekday_of_month">Last Weekday of Month</option>
                  <option value="one_time">One-Time</option>
                </select>
              </div>

              {freqType === 'weekly_days' && (
                <div className="form-group">
                  <label className="form-label">Days</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {WEEKDAYS.filter(d => d !== 'SUN').map(day => (
                      <button key={day} type="button" className="btn btn-sm"
                        onClick={() => toggleDay(day)}
                        style={{
                          background: freqDays.includes(day) ? 'var(--accent)' : 'var(--bg-input)',
                          color: freqDays.includes(day) ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${freqDays.includes(day) ? 'var(--accent)' : 'var(--border)'}`
                        }}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {freqType === 'monthly_date' && (
                <div className="form-group">
                  <label className="form-label">Day of Month</label>
                  <input type="number" className="form-input" min="1" max="31" value={monthDay}
                    onChange={e => setMonthDay(parseInt(e.target.value))} style={{ maxWidth: 100 }} />
                </div>
              )}

              {(freqType === 'monthly_nth_weekday' || freqType === 'last_weekday_of_month') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {freqType === 'monthly_nth_weekday' && (
                    <div className="form-group">
                      <label className="form-label">Which Week</label>
                      <select className="form-select" value={nthWeek} onChange={e => setNthWeek(parseInt(e.target.value))}>
                        <option value={1}>1st</option><option value={2}>2nd</option>
                        <option value={3}>3rd</option><option value={4}>4th</option>
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Weekday</label>
                    <select className="form-select" value={nthWeekday} onChange={e => setNthWeekday(e.target.value)}>
                      {WEEKDAYS.filter(d => d !== 'SUN').map(d => (
                        <option key={d} value={d}>{WEEKDAY_LABELS[d]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Timing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Planned Time</label>
                  <input type="time" className="form-input" value={plannedTime} onChange={e => setPlannedTime(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline Time</label>
                  <input type="time" className="form-input" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)} />
                </div>
              </div>

              {/* Options */}
              <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                <label className="checkbox-wrap">
                  <input type="checkbox" checked={allowBulk} onChange={e => setAllowBulk(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Allow Bulk Done</span>
                </label>
                <label className="checkbox-wrap">
                  <input type="checkbox" checked={requiresImage} onChange={e => setRequiresImage(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Requires Image</span>
                </label>
                <label className="checkbox-wrap">
                  <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Active</span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Save size={16} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
