import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const ok = await login(email, password)
    if (!ok) setError('Invalid credentials')
    else nav('/portfolios')
  }

  return (
    <div className="container page" style={{paddingTop:48}}>
      <div className="card auth-card">
        <div style={{fontSize:22, fontWeight:700, marginBottom:12}}>Admin Login</div>
        <div className="section-sub">Sign in to manage portfolios, stocks, and analytics dashboards.</div>
        <form onSubmit={onSubmit} className="grid">
          <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="input" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          {error && <div style={{color:'#ef4444'}}>{error}</div>}
          <button className="btn" type="submit">Login</button>
        </form>
      </div>
    </div>
  )
}
