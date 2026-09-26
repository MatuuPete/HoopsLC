import type { ReactNode } from 'react'
import { POSITIONS, type Position } from '../optimizer/types'
import { Eyebrow } from './LineupParts'

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export const buttonPrimary = `inline-flex items-center justify-center gap-2 rounded-lg bg-text px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`

export const buttonSecondary = `inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:border-muted hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`

export const buttonDanger = `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/10 ${focusRing}`

export const inputClass =
  'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted/70 transition-colors focus:border-accent/60 focus:outline-none'

/** Number inputs without browser spinners, in the data face. */
export const numberInputClass = `${inputClass} font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor}>
        <Eyebrow>{label}</Eyebrow>
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

/** Toggle buttons for the five positions; a player can hold several. */
export function PositionPicker({
  selected,
  onToggle,
}: {
  selected: Position[]
  onToggle: (position: Position) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Positions">
      {POSITIONS.map((p) => {
        const on = selected.includes(p)
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(p)}
            className={`rounded-md border py-2 font-mono text-sm transition-colors ${focusRing} ${
              on
                ? 'border-accent/70 bg-accent/10 text-text'
                : 'border-border text-muted hover:border-muted hover:text-text'
            }`}
          >
            {p}
          </button>
        )
      })}
    </div>
  )
}

/** Pill filter for the roster and catalog lists. */
export function PositionFilter({
  value,
  onChange,
}: {
  value: Position | 'ALL'
  onChange: (value: Position | 'ALL') => void
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Filter by position">
      {(['ALL', ...POSITIONS] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${focusRing} ${
            value === option ? 'bg-white/[0.09] text-text' : 'text-muted hover:text-text'
          }`}
        >
          {option === 'ALL' ? 'All' : option}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-bg px-3 focus-within:border-accent/60">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-muted" fill="none" aria-hidden>
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        aria-label={label}
        className="w-full bg-transparent py-2 text-sm text-text placeholder:text-muted/70 focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/** Card wrapper for the add / edit forms that open above the roster. */
export function FormCard({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string
  title?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-panel">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow>{eyebrow}</Eyebrow>
          {title && <h2 className="truncate text-lg font-medium text-text">{title}</h2>}
        </div>
        <IconButton label="Close" onClick={onClose}>
          <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </IconButton>
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function IconButton({
  label,
  onClick,
  tone = 'default',
  children,
}: {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors ${focusRing} ${
        tone === 'danger' ? 'hover:bg-red-400/10 hover:text-red-400' : 'hover:bg-white/[0.06] hover:text-text'
      }`}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
        {children}
      </svg>
    </button>
  )
}

export const pencilPath = (
  <path d="M11 2.5 13.5 5 6 12.5H3.5V10L11 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
)

export const trashPath = (
  <path
    d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
)
