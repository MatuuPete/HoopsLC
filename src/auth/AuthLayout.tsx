import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

/** Half-court line drawing for the brand panel, basket at the top: baseline, paint, free-throw circle, rim and arc. */
function CourtLines() {
  return (
    <svg
      viewBox="0 0 500 470"
      className="pointer-events-none absolute inset-x-0 top-0 w-full -translate-y-[5%] text-white/[0.07]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M0 470V0h500v470" strokeOpacity="0.6" />
      <rect x="170" y="0" width="160" height="190" />
      <circle cx="250" cy="190" r="60" />
      <path d="M190 190a60 60 0 0 0 120 0" strokeDasharray="10 10" transform="rotate(180 250 190)" />
      <path d="M220 40h60" />
      <circle cx="250" cy="52" r="9" stroke="#E8590C" strokeOpacity="0.55" />
      <path d="M30 0v140a220 220 0 0 0 440 0V0" />
    </svg>
  )
}

interface AuthLayoutProps {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-bg font-body text-text lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link
          to="/"
          className="flex w-fit items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Logo className="h-6 w-6 text-text" />
          <span className="font-mono text-sm font-semibold tracking-[0.2em]">SIX MAN</span>
        </Link>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
          </div>
        </main>

        {footer && <div className="text-center text-xs text-muted">{footer}</div>}
      </div>

      <aside className="relative hidden overflow-hidden border-l border-border bg-panel lg:block">
        <CourtLines />
        <div className="relative flex h-full flex-col justify-end p-14 xl:p-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Lineup optimizer</p>
          <p className="mt-6 max-w-md font-display text-6xl uppercase leading-[0.95] tracking-wide text-text xl:text-7xl">
            Every roster has a sixth man.
          </p>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted">
            Add the players you own, set your salary cap, and get the strongest five you can field.
          </p>
        </div>
      </aside>
    </div>
  )
}

/** Horizontal rule with a centred label, used between Google and email sign-in. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
