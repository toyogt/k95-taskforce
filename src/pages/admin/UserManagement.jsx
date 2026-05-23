import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES, ROLE_LABELS, ROLE_COLORS } from '../../lib/constants'
import { formatDateTime } from '../../lib/helpers'
import toast from 'react-hot-toast'
import { Users, Plus, Edit2, Trash2, Shield, Save, X } from 'lucide-react'

export default function UserManagement() {
  const { profile: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [allRoles, setAllRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(null)

  // Form
  const [editName, setEditName] = useState('')
  const [editDept, setEditDept] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const [editRoles, setEditRoles] = useState([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [uRes, dRes, rRes] = await Promise.all([
        supabase.from('profiles').select('*, departments(name), user_roles(roles(role_name))').order('name'),
        supabase.from('departments').select('id, name'),
        supabase.from('roles').select('id, role_name')
      ])
      setUsers(uRes.data || [])
      setDepartments(dRes.data || [])
      setAllRoles(rRes.data || [])
    } catch (err) {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  function openEdit(user) {
    setEditModal(user)
    setEditName(user.name || '')
    setEditDept(user.department_id || '')
    setEditStatus(user.status || 'active')
    setEditRoles(user.user_roles?.map(ur => ur.roles.role_name) || [])
  }

  async function saveUser(e) {
    e.preventDefault()
    try {
      // Update profile
      await supabase.from('profiles').update({
        name: editName,
        department_id: editDept || null,
        status: editStatus,
        updated_at: new Date().toISOString()
      }).eq('id', editModal.id)

      // Update roles: delete all then re-insert
      await supabase.from('user_roles').delete().eq('user_id', editModal.id)
      const roleRecords = editRoles.map(roleName => {
        const role = allRoles.find(r => r.role_name === roleName)
        return { user_id: editModal.id, role_id: role?.id }
      }).filter(r => r.role_id)
      if (roleRecords.length > 0) {
        await supabase.from('user_roles').insert(roleRecords)
      }

      await supabase.from('audit_logs').insert({
        actor_user_id: currentUser.id, entity_type: 'profile',
        entity_id: editModal.id, action: 'user_updated',
        new_value: JSON.stringify({ name: editName, status: editStatus, roles: editRoles })
      })

      toast.success('User updated!')
      setEditModal(null)
      loadData()
    } catch (err) {
      toast.error(err.message || 'Failed to update')
    }
  }

  function toggleRole(roleName) {
    setEditRoles(prev =>
      prev.includes(roleName) ? prev.filter(r => r !== roleName) : [...prev, roleName]
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{users.length} users</p>
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
                  <th>Email</th>
                  <th>Department</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ fontSize: 13 }}>{u.departments?.name || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {u.user_roles?.map((ur, i) => (
                          <span key={i} className="badge" style={{
                            background: ROLE_COLORS[ur.roles.role_name] + '20',
                            color: ROLE_COLORS[ur.roles.role_name]
                          }}>{ROLE_LABELS[ur.roles.role_name]}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-success' : u.status === 'inactive' ? 'badge-danger' : 'badge-warning'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(u)}>
                        <Edit2 size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Edit User</h3>
            <form onSubmit={saveUser}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-select" value={editDept} onChange={e => setEditDept(e.target.value)}>
                  <option value="">No Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending_approval">Pending Approval</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Roles</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {allRoles.map(r => (
                    <label key={r.id} className="checkbox-wrap"
                      style={{ padding: '6px 12px', borderRadius: 6, background: editRoles.includes(r.role_name) ? ROLE_COLORS[r.role_name] + '20' : 'var(--bg-input)',
                        border: `1px solid ${editRoles.includes(r.role_name) ? ROLE_COLORS[r.role_name] : 'var(--border)'}` }}>
                      <input type="checkbox" checked={editRoles.includes(r.role_name)}
                        onChange={() => toggleRole(r.role_name)} />
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{ROLE_LABELS[r.role_name]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Save size={16} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
