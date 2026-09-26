import { useState, type KeyboardEvent } from 'react'
import type { SavedLineup } from '../data/lineupsApi'
import { summarizeSavedLineup } from '../optimizer/summarizeSavedLineup'
import { POSITIONS } from '../optimizer/types'
import { Eyebrow, SlotRow } from './LineupParts'

interface SavedLineupsPanelProps {
  lineups: SavedLineup[]
  error: string | null
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="font-mono text-sm tabular-nums text-text">{value}</span>
    </div>
  )
}

function SavedLineupCard({
  lineup,
  onRename,
  onDelete,
}: {
  lineup: SavedLineup
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(lineup.title)
  const totals = summarizeSavedLineup(lineup.slots)

  function commit() {
    const next = draft.trim()
    if (next && next !== lineup.title) onRename(lineup.id, next)
    else setDraft(lineup.title)
    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') {
      setDraft(lineup.title)
      setEditing(false)
    }
  }

  return (
    <article className="group rounded-xl border border-border bg-panel">
      <header className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {editing ? (
            <input
              autoFocus
              aria-label="Lineup name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={handleKeyDown}
              className="-mx-1.5 rounded-md border border-accent/60 bg-bg px-1.5 py-0.5 text-[15px] font-medium text-text focus:outline-none"
            />
          ) : (
            <button
              onClick={() => {
                setDraft(lineup.title)
                setEditing(true)
              }}
              className="-mx-1.5 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-[15px] font-medium text-text hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              title="Rename lineup"
            >
              <span className="truncate">{lineup.title || 'Untitled'}</span>
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                fill="none"
                aria-hidden
              >
                <path d="M11 2.5 13.5 5 6 12.5H3.5V10L11 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <span className="text-xs text-muted">{formatSavedAt(lineup.createdAt)}</span>
        </div>
        <button
          onClick={() => onDelete(lineup.id)}
          className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-red-400/10 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
          aria-label={`Delete ${lineup.title || 'saved lineup'}`}
          title="Delete lineup"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      <ul className="mt-2 divide-y divide-white/[0.05] px-4">
        {[...lineup.slots]
          .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position))
          .map((slot) => (
          <SlotRow
            key={slot.position}
            size="sm"
            slot={{
              position: slot.position,
              name: slot.name,
              xTier: slot.isXPlayer ? (slot.xTier ?? 'standard') : null,
              salary: slot.baseSalary,
              offense: slot.offense,
              defense: slot.defense,
            }}
          />
        ))}
      </ul>

      <div className="mt-2 grid grid-cols-4 gap-2 border-t border-border px-4 py-3">
        <Total label="Base" value={totals.totalBaseSalary} />
        <Total label="TPower" value={totals.totalPowerBySal} />
        <Total label="Off" value={totals.totalOffense} />
        <Total label="Def" value={totals.totalDefense} />
      </div>
    </article>
  )
}

export function SavedLineupsPanel({ lineups, error, onRename, onDelete }: SavedLineupsPanelProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Saved lineups</Eyebrow>
        {lineups.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-muted">{lineups.length}</span>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {lineups.length === 0 && !error && (
        <p className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted">
          No saved lineups yet. Save a calculated lineup to lock its players out of the next one.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {lineups.map((lineup) => (
          <SavedLineupCard key={lineup.id} lineup={lineup} onRename={onRename} onDelete={onDelete} />
        ))}
      </div>
    </section>
  )
}
