import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Hero() {
  const { access } = useAuth()

  return (
    <div className="hero">
      <div className="container hero-panel">
        <div className="hero-copy">
          <span className="pill">Django + React</span>
          <h1>Analyze portfolios with clean, fast insights</h1>
          <p>Secure login, manage portfolios and stocks, run analysis and explore interactive market charts.</p>
          <div className="hero-actions">
            <Link className="btn" to={access ? '/explore' : '/login'}>Get Started</Link>
            <Link className="btn secondary" to="/explore-gold-silver">Explore Gold & Silver</Link>
          </div>
        </div>
        <div className="hero-stats">
          <div className="card hero-stat-card">
            <div className="hero-stat-value">1Y</div>
            <div className="hero-stat-label">Metals trend coverage</div>
          </div>
          <div className="card hero-stat-card">
            <div className="hero-stat-value">3</div>
            <div className="hero-stat-label">Dashboard chart views</div>
          </div>
          <div className="card hero-stat-card">
            <div className="hero-stat-value">Live</div>
            <div className="hero-stat-label">Market-backed pricing</div>
          </div>
        </div>
      </div>
    </div>
  )
}
