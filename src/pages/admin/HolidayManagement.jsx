import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/helpers'
import toast from 'react-hot-toast'
import { Calendar, Plus, Trash2, Save } from 'lucide-react'

export default function HolidayManagement() {
  const { profile } = useAuth()
  const [holidays, setHolidays] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [scope, setScope] = useState('company')
  const [deptId, setDeptId] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => { loadData() }, [year])

  async function loadData() {
    setLoading(true)
    try {
      const [hRes, dRes] = await Promise.all([
        supabase.from('holidays').select('*, departments(name)')
          .gte('holiday_date', `${year}-01-01`).lte('holiday_date', `${year}-12-31`)
          .order('holiday_date'),
        supabase.from('departments').select('id, name')
      ])
      setHolidays(hRes.data || [])
      setDepartments(dRes.data || [])
    } catch (err) {
      toast.error('Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    try {
      await supabase.from('holidays').insert({
        name, holiday_date: date, scope,
        department_id: scope === 'department' ? deptId : null,
        created_by: profile.id
      })
      toast.success('Holiday added!')
      setShowModal(false); setName(''); setDate(''); loadData()
    } catch (err) {
      toast.error(err.message || 'Failed')
    }
  }

  async function deleteHoliday(id) {
    if (!confirm('Remove this holiday?')) return
    await supabase.from('holidays').delete().eq('id', id)
    toast.success('Removed')
    loadData()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Holidays</h1>
          <p className="page-subtitle">{holidays.length} holidays in {year}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="form-select" value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ width: 100 }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Holiday
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : holidays.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} /><h3>No holidays defined for {year}</h3>
          <p>Add holidays to ensure tasks are properly adjusted.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Name</th><th>Scope</th><th>Department</th><th></th></tr></thead>
              <tbody>
                {holidays.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 500 }}>{formatDate(h.holiday_date)}</td>
                    <td>{h.name}</td>
                    <td><span className={`badge ${h.scope === 'company' ? 'badge-accent' : 'badge-info'}`}>{h.scope}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{h.departments?.name || '—'}</td>
                    <td>
                      <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }}
                        onClick={() => deleteHoliday(h.id)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Add Holiday</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Holiday Name</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} required
                  placeholder="e.g., Republic Day" />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Scope</label>
                <select className="form-select" value={scope} onChange={e => setScope(e.target.value)}>
                  <option value="company">Company-wide</option>
                  <option value="department">Department-specific</option>
                </select>
              </div>
              {scope === 'department' && (
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={deptId} onChange={e => setDeptId(e.target.value)} required>
                    <option value="">Select...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
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
