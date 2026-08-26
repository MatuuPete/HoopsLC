import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { HomePage } from '../pages/HomePage'

/** Public landing page at "/" — signed-in users skip straight to their roster. */
export function HomeRoute() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (session) return <Navigate to="/players" replace />
  return <HomePage />
}
