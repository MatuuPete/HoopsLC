import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo } from './Logo'

const baseLinks = [
  { to: '/players', label: 'Players' },
  { to: '/lineup', label: 'Lineup Builder' },
  { to: '/guide', label: 'How It Works' },
]

const adminLinks = [
  { to: '/admin/catalog', label: 'Catalog Admin' },
  { to: '/admin/clipboard', label: 'Clipboard' },
]

export function NavBar() {
  const { signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const links = isAdmin ? [...baseLinks, ...adminLinks] : baseLinks

  return (
    <nav className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border px-4 py-4 sm:px-6">
      <Link to="/" className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
        <Logo className="w-5 h-5 text-text" />
        Six Man
      </Link>
      <div className="scrollbar-slim -mx-4 flex w-full items-center gap-6 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex shrink-0 items-center whitespace-nowrap text-xs uppercase tracking-widest ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent mr-2" />
            {link.label}
          </NavLink>
        ))}
        <button
          onClick={async () => {
            await signOut()
            navigate('/', { replace: true })
          }}
          className="shrink-0 whitespace-nowrap text-xs uppercase tracking-widest text-muted">
          Sign Out
        </button>
      </div>
    </nav>
  )
}
