import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { access, logout } = useAuth()
  const nav = useNavigate()
  return (
    <div className="navbar">
      <div className="container navbar-inner">
        <Link to="/" style={{fontWeight:700}}>StockAnalysis</Link>
        <div className="nav-links">
          <NavLink to="/" end>Home</NavLink>
          {access && <NavLink to="/portfolios">Portfolios</NavLink>}
          {access && <NavLink to="/stocks">Stocks</NavLink>}
          {access && <NavLink to="/explore">Explore</NavLink>}
          {!access && <NavLink to="/login">Login</NavLink>}
          {access && (
            <button className="btn secondary" onClick={() => {logout(); nav('/')}}>Logout</button>
          )}
        </div>
      </div>
    </div>
  )
}
