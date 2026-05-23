import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { TICKET_TYPE_LABELS, TICKET_STATUS } from '../../lib/constants'
import { formatDateTime } from '../../lib/helpers'
import toast from 'react-hot-toast'
import { HelpCircle, MessageCircle, Send } from 'lucide-react'

export default function HelpTicketsPage() {
  const { profile, hasAnyRole } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const isPC = hasAnyRole(['pc', 'admin', 'super_admin'])

  useEffect(() => { loadTickets() }, [profile?.id])

  async function loadTickets() {
    setLoading(true)
    try {
      let query = supabase
        .from('help_tickets')
        .select('*, task_instances(title, planned_date), profiles!help_tickets_requested_by_fkey(name)')
        .order('created_at', { ascending: false })

      if (!isPC) {
        query = query.eq('requested_by', profile.id)
      }

      const { data } = await query
      setTickets(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function loadComments(ticketId) {
    const { data } = await supabase
      .from('ticket_comments')
      .select('*, profiles(name)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function addComment() {
    if (!newComment.trim() || !selectedTicket) return
    try {
      await supabase.from('ticket_comments').insert({
        ticket_id: selectedTicket.id,
        comment_by: profile.id,
        comment_text: newComment.trim()
      })
      setNewComment('')
      loadComments(selectedTicket.id)
    } catch (err) {
      toast.error('Failed to add comment')
    }
  }

  async function updateTicketStatus(ticketId, newStatus) {
    try {
      const updates = { status: newStatus }
      if (['approved', 'rejected'].includes(newStatus)) updates.approved_by = profile.id
      if (['resolved', 'closed'].includes(newStatus)) updates.resolved_by = profile.id
      if (['resolved', 'closed'].includes(newStatus)) updates.resolved_at = new Date().toISOString()

      await supabase.from('help_tickets').update(updates).eq('id', ticketId)

      await supabase.from('audit_logs').insert({
        actor_user_id: profile.id,
        entity_type: 'help_ticket',
        entity_id: ticketId,
        action: `ticket_${newStatus}`,
      })

      toast.success(`Ticket ${newStatus}`)
      loadTickets()
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => ({ ...prev, status: newStatus }))
      }
    } catch (err) {
      toast.error('Failed to update ticket')
    }
  }

  const statusColor = {
    open: 'var(--warning)', in_review: 'var(--info)',
    approved: 'var(--success)', rejected: 'var(--danger)',
    resolved: 'var(--success)', closed: 'var(--text-muted)'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Help Tickets</h1>
          <p className="page-subtitle">{isPC ? 'All tickets' : 'Your tickets'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Ticket list */}
        <div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
          ) : tickets.length === 0 ? (
            <div className="empty-state">
              <HelpCircle size={48} /><h3>No tickets</h3>
              <p>Help tickets raised from tasks will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tickets.map(t => (
                <div key={t.id} className="task-card" onClick={() => { setSelectedTicket(t); loadComments(t.id) }}
                  style={{ borderColor: selectedTicket?.id === t.id ? 'var(--accent)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.subject}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {TICKET_TYPE_LABELS[t.ticket_type] || t.ticket_type} • {t.profiles?.name} • {formatDateTime(t.created_at)}
                      </div>
                      {t.task_instances && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                          Task: {t.task_instances.title}
                        </div>
                      )}
                    </div>
                    <span className="badge" style={{ background: statusColor[t.status] + '20', color: statusColor[t.status] }}>
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ticket detail + comments */}
        {selectedTicket && (
          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selectedTicket.subject}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {TICKET_TYPE_LABELS[selectedTicket.ticket_type]} — Status: {selectedTicket.status}
              </p>
              <p style={{ fontSize: 13, marginTop: 8 }}>{selectedTicket.description}</p>
            </div>

            {/* PC actions */}
            {isPC && ['open', 'in_review'].includes(selectedTicket.status) && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {selectedTicket.status === 'open' && (
                  <button className="btn btn-sm btn-ghost" onClick={() => updateTicketStatus(selectedTicket.id, 'in_review')}>Review</button>
                )}
                <button className="btn btn-sm btn-success" onClick={() => updateTicketStatus(selectedTicket.id, 'approved')}>Approve</button>
                <button className="btn btn-sm btn-danger" onClick={() => updateTicketStatus(selectedTicket.id, 'rejected')}>Reject</button>
                <button className="btn btn-sm btn-primary" onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}>Resolve</button>
              </div>
            )}

            {/* Comments */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Comments</h4>
              <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
                {comments.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No comments yet</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} style={{
                      marginBottom: 10, padding: 10, background: 'var(--bg-input)',
                      borderRadius: 8, fontSize: 13
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                        {c.profiles?.name || 'User'} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                          {formatDateTime(c.created_at)}</span>
                      </div>
                      {c.comment_text}
                    </div>
                  ))
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" value={newComment} onChange={e => setNewComment(e.target.value)}
                  placeholder="Add a comment..." onKeyDown={e => e.key === 'Enter' && addComment()} />
                <button className="btn btn-primary btn-sm" onClick={addComment}><Send size={14} /></button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
