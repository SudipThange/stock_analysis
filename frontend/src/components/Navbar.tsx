import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, Menu, TrendingUp, X } from 'lucide-react'
import TopSuccessPopup from './TopSuccessPopup'

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoutPopupOpen, setLogoutPopupOpen] = useState(false)

  const handleLogout = () => {
    setMobileOpen(false)
    setLogoutPopupOpen(true)
  }

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, isAuthenticated])

  return (
    <div className="navbar">
      <TopSuccessPopup
        open={logoutPopupOpen}
        title="Logout Successful"
        message="You have been signed out."
        onDone={() => {
          setLogoutPopupOpen(false)
          logout()
          nav('/', { replace: true })
        }}
      />
      <div className={`container navbar-inner ${!isAuthenticated ? 'guest' : ''}`}>
        <Link to="/" className="brand-link">
          <span className="brand-logo" aria-hidden="true">
            <TrendingUp size={19} strokeWidth={2.4} />
          </span>
          <span className="brand-title">SmartInvestors</span>
        </Link>

        <button
          className="nav-toggle"
          type="button"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(prev => !prev)}
        >
          {mobileOpen ? <X size={19} /> : <Menu size={19} />}
        </button>

        <div className={`nav-links ${mobileOpen ? 'open' : ''}`}>
          <NavLink to="/" end onClick={() => setMobileOpen(false)}>Home</NavLink>
          {isAuthenticated && <NavLink to="/portfolios" onClick={() => setMobileOpen(false)}>Portfolios</NavLink>}
          {isAuthenticated && <NavLink to="/stocks" onClick={() => setMobileOpen(false)}>Stocks</NavLink>}
          {isAuthenticated && <NavLink to="/explore" onClick={() => setMobileOpen(false)}>Explore Dashboards</NavLink>}
          {isAuthenticated && <NavLink to="/explore-gold-silver" onClick={() => setMobileOpen(false)}>Explore Gold & Silver</NavLink>}
          {isAuthenticated && <NavLink to="/other-features" onClick={() => setMobileOpen(false)}>Other Features</NavLink>}
        </div>

        <div className={`nav-auth ${mobileOpen ? 'open' : ''}`}>
          {!isAuthenticated ? (
            <Link className="btn secondary nav-auth-btn" to="/login" onClick={() => setMobileOpen(false)}>
              Login
            </Link>
          ) : (
            <button className="btn secondary nav-auth-btn" onClick={handleLogout}>
              <LogOut size={16} style={{marginRight: 6}} /> Logout
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
