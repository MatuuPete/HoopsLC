import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import { StatStrip } from './StatStrip'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg text-text pb-16">
      <NavBar />
      <Outlet />
      <StatStrip />
    </div>
  )
}
