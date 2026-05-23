import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/helpers'
import { FileText, Search, RefreshCw } from 'lucide-react'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')

  useEffect(() => { loadLogs() }, [filterAction])

  async function loadLogs() {
    setLoading(true)
    try {
      let query = supabase.from('audit_logs')
        .select('*, profiles!audit_logs_actor_user_id_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (filterAction) query = query.eq('action', filterAction)

      const { data } = await query
      setLogs(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = search
    ? logs.filter(l =>
        l.action?.toLowerCase().includes(search.toLowerCase()) ||
        l.profiles?.name?.toLowerCase().includes(search.toLowerCase()) ||
        l.entity_type?.toLowerCase().includes(search.toLowerCase())
      )
    : logs

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort()

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">System activity trail</p>
        </div>
        <button className="btn btn-ghost" onClick={loadLogs}><RefreshCw size={16} /> Refresh</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search logs..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" value={filterAction} onChange={e => setFilterAction(e.target.value)}
          style={{ maxWidth: 200 }}>
          <option value="">All Actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(l.created_at)}
                    </td>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{l.profiles?.name || 'System'}</td>
                    <td><span className="badge badge-accent">{l.action}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {l.entity_type} {l.entity_id ? `#${l.entity_id.slice(0, 8)}` : ''}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.new_value ? (typeof l.new_value === 'string' ? l.new_value : JSON.stringify(l.new_value)).slice(0, 80) : '—'}
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
