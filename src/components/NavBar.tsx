import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo } from './Logo'

const baseLinks = [
  { to: '/players', label: 'Players' },
  { to: '/lineup', label: 'Lineup Builder' },
]

export function NavBar() {
  const { signOut, isAdmin } = useAuth()
  const links = isAdmin ? [...baseLinks, { to: '/admin/catalog', label: 'Catalog Admin' }] : baseLinks

  return (
    <nav className="flex items-center justify-between border-b border-border px-6 py-4">
      <Link to="/" className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
        <Logo className="w-5 h-5 text-text" />
        Six Man
      </Link>
      <div className="flex items-center gap-6">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center text-xs uppercase tracking-widest ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent mr-2" />
            {link.label}
          </NavLink>
        ))}
        <button onClick={() => signOut()} className="text-xs uppercase tracking-widest text-muted">
          Sign Out
        </button>
      </div>
    </nav>
  )
}
