import { Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Footer from './components/Footer'
import Login from './routes/Login'
import Portfolios from './routes/Portfolios'
import Stocks from './routes/Stocks'
import Explore from './routes/Explore'
import ExploreGoldSilver from './routes/ExploreGoldSilver'
import Dashboard from './routes/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  const location = useLocation()
  const showGraphBackground = location.pathname === '/login'

  return (
    <AuthProvider>
      <div className="app-shell">
        {showGraphBackground && (
          <div className="bg-graph-layer" aria-hidden="true">
            <svg className="bg-graph-svg" viewBox="0 0 1200 800" preserveAspectRatio="none">
              <defs>
                <marker id="bgArrowUp" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L8,4 L0,8 z" className="bg-arrow-up" />
                </marker>
                <marker id="bgArrowDown" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L8,4 L0,8 z" className="bg-arrow-down" />
                </marker>
              </defs>

              <line x1="200" y1="570" x2="200" y2="710" className="bg-candle-wick bg-bear" />
              <rect x="188" y="620" width="24" height="66" className="bg-candle-body bg-bear" />

              <line x1="260" y1="520" x2="260" y2="660" className="bg-candle-wick bg-bull" />
              <rect x="248" y="560" width="24" height="76" className="bg-candle-body bg-bull" />

              <line x1="320" y1="470" x2="320" y2="620" className="bg-candle-wick bg-bear" />
              <rect x="308" y="500" width="24" height="90" className="bg-candle-body bg-bear" />

              <line x1="380" y1="430" x2="380" y2="580" className="bg-candle-wick bg-bull" />
              <rect x="368" y="460" width="24" height="96" className="bg-candle-body bg-bull" />

              <line x1="440" y1="360" x2="440" y2="520" className="bg-candle-wick bg-bull" />
              <rect x="428" y="390" width="24" height="96" className="bg-candle-body bg-bull" />

              <line x1="500" y1="340" x2="500" y2="510" className="bg-candle-wick bg-bear" />
              <rect x="488" y="370" width="24" height="106" className="bg-candle-body bg-bear" />

              <line x1="560" y1="320" x2="560" y2="500" className="bg-candle-wick bg-bull" />
              <rect x="548" y="350" width="24" height="104" className="bg-candle-body bg-bull" />

              <line x1="620" y1="390" x2="620" y2="560" className="bg-candle-wick bg-bear" />
              <rect x="608" y="420" width="24" height="102" className="bg-candle-body bg-bear" />

              <line x1="680" y1="450" x2="680" y2="620" className="bg-candle-wick bg-bear" />
              <rect x="668" y="480" width="24" height="106" className="bg-candle-body bg-bear" />

              <line x1="740" y1="410" x2="740" y2="580" className="bg-candle-wick bg-bull" />
              <rect x="728" y="450" width="24" height="96" className="bg-candle-body bg-bull" />

              <line x1="800" y1="360" x2="800" y2="520" className="bg-candle-wick bg-bull" />
              <rect x="788" y="390" width="24" height="96" className="bg-candle-body bg-bull" />

              <line x1="860" y1="330" x2="860" y2="500" className="bg-candle-wick bg-bear" />
              <rect x="848" y="370" width="24" height="106" className="bg-candle-body bg-bear" />

              <line x1="920" y1="300" x2="920" y2="450" className="bg-candle-wick bg-bull" />
              <rect x="908" y="330" width="24" height="90" className="bg-candle-body bg-bull" />

              <line x1="980" y1="280" x2="980" y2="430" className="bg-candle-wick bg-bull" />
              <rect x="968" y="310" width="24" height="90" className="bg-candle-body bg-bull" />

              <line x1="1040" y1="250" x2="1040" y2="410" className="bg-candle-wick bg-bear" />
              <rect x="1028" y="280" width="24" height="102" className="bg-candle-body bg-bear" />

              <path d="M260 620 L520 390" className="bg-trend-line bg-trend-up" markerEnd="url(#bgArrowUp)" />
              <path d="M600 360 L710 300 L760 340 L820 290" className="bg-trend-line bg-trend-up" markerEnd="url(#bgArrowUp)" />
              <path d="M980 290 L1110 210" className="bg-trend-line bg-trend-up" markerEnd="url(#bgArrowUp)" />
              <path d="M290 330 L430 255 L520 315" className="bg-trend-line bg-trend-down" markerEnd="url(#bgArrowDown)" />
            </svg>
          </div>
        )}
        <div className="app-content">
          <Navbar />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<>
                <Hero />
                <Features />
              </>} />
              <Route path="/login" element={<Login />} />
              <Route path="/portfolios" element={<ProtectedRoute><Portfolios /></ProtectedRoute>} />
              <Route path="/stocks" element={<ProtectedRoute><Stocks /></ProtectedRoute>} />
              <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
              <Route path="/explore-gold-silver" element={<ProtectedRoute><ExploreGoldSilver /></ProtectedRoute>} />
              <Route path="/dashboard/:ticker" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="*" element={<div className="container">Not found</div>} />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
    </AuthProvider>
  )
}
