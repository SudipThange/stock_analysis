import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth()
  const nav = useNavigate()
  return (
    <div className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand-link" style={{fontWeight:700}}>
          <img
            src="/assets/images/logo.png"
            alt="GenZ Investors"
            className="brand-logo"
          />
          <span className="brand-title">Gen<span className="brand-z">Z</span> Investors</span>
        </Link>
        <div className="nav-links">
          <NavLink to="/" end>Home</NavLink>
          {isAuthenticated && <NavLink to="/portfolios">Portfolios</NavLink>}
          {isAuthenticated && <NavLink to="/stocks">Stocks</NavLink>}
          {isAuthenticated && <NavLink to="/explore">Explore Dashboards</NavLink>}
          {isAuthenticated && <NavLink to="/explore-gold-silver">Explore Gold & Silver</NavLink>}
          {!isAuthenticated && <NavLink to="/login">Login</NavLink>}
          {isAuthenticated && (
            <button className="btn secondary" onClick={() => {logout(); nav('/')}}>Logout</button>
          )}
        </div>
      </div>
    </div>
  )
}
