import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, username, profileLoading } = useAuth()

  if (loading || profileLoading) return null
  if (!session) return <Navigate to="/" replace />
  if (!username) return <Navigate to="/welcome" replace />
  return <>{children}</>
}
