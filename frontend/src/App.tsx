import { Route, Routes, Link } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Footer from './components/Footer'
import Login from './routes/Login'
import Portfolios from './routes/Portfolios'
import Stocks from './routes/Stocks'
import Explore from './routes/Explore'
import Dashboard from './routes/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  return (
    <AuthProvider>
      <Navbar />
      <Routes>
        <Route path="/" element={<>
          <Hero />
          <Features />
        </>} />
        <Route path="/login" element={<Login />} />
        <Route path="/portfolios" element={<ProtectedRoute><Portfolios /></ProtectedRoute>} />
        <Route path="/stocks" element={<ProtectedRoute><Stocks /></ProtectedRoute>} />
        <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
        <Route path="/dashboard/:ticker" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="*" element={<div className="container">Not found</div>} />
      </Routes>
      <Footer />
    </AuthProvider>
  )
}
