import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Building2, Plus, Edit2, Trash2, Save } from 'lucide-react'

export default function DepartmentManagement() {
  const { profile } = useAuth()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [headUserId, setHeadUserId] = useState('')
  const [officeStart, setOfficeStart] = useState('10:00')
  const [officeEnd, setOfficeEnd] = useState('18:00')
  const [users, setUsers] = useState([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [dRes, uRes] = await Promise.all([
        supabase.from('departments').select('*, profiles!departments_head_user_id_fkey(name)').order('name'),
        supabase.from('profiles').select('id, name').eq('status', 'active')
      ])
      setDepartments(dRes.data || [])
      setUsers(uRes.data || [])
    } catch (err) {
      toast.error('Failed to load')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditId(null); setName(''); setDescription(''); setHeadUserId('')
    setOfficeStart('10:00'); setOfficeEnd('18:00'); setShowModal(true)
  }

  function openEdit(dept) {
    setEditId(dept.id); setName(dept.name); setDescription(dept.description || '')
    setHeadUserId(dept.head_user_id || ''); setOfficeStart(dept.office_start_time || '10:00')
    setOfficeEnd(dept.office_end_time || '18:00'); setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    try {
      const record = {
        name, description: description || null,
        head_user_id: headUserId || null,
        office_start_time: officeStart, office_end_time: officeEnd
      }

      if (editId) {
        await supabase.from('departments').update(record).eq('id', editId)
      } else {
        await supabase.from('departments').insert(record)
      }

      await supabase.from('audit_logs').insert({
        actor_user_id: profile.id, entity_type: 'department',
        entity_id: editId, action: editId ? 'department_updated' : 'department_created',
        new_value: JSON.stringify(record)
      })

      toast.success(editId ? 'Department updated!' : 'Department created!')
      setShowModal(false)
      loadData()
    } catch (err) {
      toast.error(err.message || 'Failed to save')
    }
  }

  async function deleteDept(id, deptName) {
    if (!confirm(`Delete department "${deptName}"? Users in this department will become unassigned.`)) return
    try {
      await supabase.from('departments').delete().eq('id', id)
      toast.success('Deleted')
      loadData()
    } catch (err) {
      toast.error('Failed to delete — department may have assigned users')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">{departments.length} departments</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> New Department
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div className="grid-auto">
          {departments.map(d => (
            <div key={d.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{d.name}</h3>
                  {d.description && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{d.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-icon btn-ghost" onClick={() => openEdit(d)}><Edit2 size={14} /></button>
                  <button className="btn btn-icon btn-ghost" onClick={() => deleteDept(d.id, d.name)}
                    style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                <div>Head: {d.profiles?.name || 'Not assigned'}</div>
                <div>Hours: {d.office_start_time || '10:00'} – {d.office_end_time || '18:00'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{editId ? 'Edit' : 'New'} Department</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Department Head</label>
                <select className="form-select" value={headUserId} onChange={e => setHeadUserId(e.target.value)}>
                  <option value="">None</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Office Start</label>
                  <input type="time" className="form-input" value={officeStart} onChange={e => setOfficeStart(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Office End</label>
                  <input type="time" className="form-input" value={officeEnd} onChange={e => setOfficeEnd(e.target.value)} />
                </div>
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
