import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import TopSuccessPopup from '../components/TopSuccessPopup'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [holdRedirect, setHoldRedirect] = useState(false)
  const [loginPopupOpen, setLoginPopupOpen] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setHoldRedirect(true)
    const ok = await login(email, password)
    if (!ok) {
      setHoldRedirect(false)
      setError('Invalid credentials')
      return
    }
    setLoginPopupOpen(true)
  }

  useEffect(() => {
    if (isAuthenticated && !holdRedirect && !loginPopupOpen) {
      nav('/portfolios', { replace: true })
    }
  }, [isAuthenticated, holdRedirect, loginPopupOpen, nav])

  return (
    <div className="container page" style={{paddingTop:48}}>
      <TopSuccessPopup
        open={loginPopupOpen}
        title="Login Successful"
        message="Welcome back. Redirecting to your dashboards..."
        onDone={() => {
          setLoginPopupOpen(false)
          setHoldRedirect(false)
          nav('/portfolios', { replace: true })
        }}
      />
      <div className="card auth-card">
        <div style={{fontSize:22, fontWeight:700, marginBottom:12}}>Login</div>
        <div className="section-sub">Sign in to access your portfolios, stocks, and analytics dashboards.</div>
        <form onSubmit={onSubmit} className="grid">
          <input className="input" placeholder="Username or Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="input" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          {error && <div style={{color:'#ef4444'}}>{error}</div>}
          <div style={{ color: 'var(--muted)' }}>
            New here? <Link to="/register">Create an account</Link>
          </div>
          <button className="btn" type="submit">
            Login <ArrowRight size={16} style={{marginLeft: 6}} />
          </button>
        </form>
      </div>
    </div>
  )
}
