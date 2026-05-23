import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Mail, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { resetPassword } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
      toast.success('Reset link sent!')
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: 'var(--accent)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 22, color: '#fff', marginBottom: 16
          }}>K95</div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Reset Password</h1>
        </div>

        <div className="card" style={{ padding: 28 }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <Mail size={48} style={{ color: 'var(--success)', marginBottom: 16 }} />
              <h3 style={{ marginBottom: 8 }}>Check your email</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
                We've sent a password reset link to <strong>{email}</strong>
              </p>
              <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                <ArrowLeft size={16} /> Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
                Enter your email and we'll send you a link to reset your password.
              </p>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={email}
                  onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" />
              </div>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
                style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
                <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  <ArrowLeft size={12} style={{ verticalAlign: 'middle' }} /> Back to Login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
