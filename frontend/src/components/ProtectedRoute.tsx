import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, authReady } = useAuth()
  if (!authReady) return <div className="container" style={{ paddingTop: 24 }}>Loading...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}
