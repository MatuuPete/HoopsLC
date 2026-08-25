import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function AdminRoute({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAuth()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/players" replace />
  return <>{children}</>
}
