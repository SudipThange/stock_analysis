import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import TopSuccessPopup from '../components/TopSuccessPopup'

export default function Register() {
  const { register, isAuthenticated } = useAuth()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Name, email and password are required')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const ok = await register(name.trim(), email.trim(), password)
    if (!ok) {
      setError('Registration failed. Please check your details.')
      return
    }

    setSuccessOpen(true)
  }

  useEffect(() => {
    if (isAuthenticated) {
      nav('/portfolios', { replace: true })
    }
  }, [isAuthenticated, nav])

  return (
    <div className="container page" style={{ paddingTop: 48 }}>
      <TopSuccessPopup
        open={successOpen}
        title="Registration Successful"
        message="Your account has been created. Redirecting to login..."
        onDone={() => {
          setSuccessOpen(false)
          nav('/login', { replace: true })
        }}
      />
      <div className="card auth-card">
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Create Account</div>
        <div className="section-sub">Register to manage your own portfolios, stocks, and analytics dashboards.</div>
        <form onSubmit={onSubmit} className="grid">
          <input className="input" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />
          <input className="input" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <input className="input" placeholder="Confirm Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          {error && <div style={{ color: '#ef4444' }}>{error}</div>}
          <div style={{ color: 'var(--muted)' }}>
            Already have an account? <Link to="/login">Login</Link>
          </div>
          <button className="btn" type="submit">
            Register <ArrowRight size={16} style={{ marginLeft: 6 }} />
          </button>
        </form>
      </div>
    </div>
  )
}
