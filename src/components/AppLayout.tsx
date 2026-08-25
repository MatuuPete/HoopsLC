import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <NavBar />
      <Outlet />
    </div>
  )
}
