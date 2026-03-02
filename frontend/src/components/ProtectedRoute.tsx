import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { access } = useAuth()
  if (!access) return <Navigate to="/login" replace />
  return children
}
