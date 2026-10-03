import { useState, type KeyboardEvent } from 'react'
import type { SavedLineup } from '../data/lineupsApi'
import { summarizeSavedLineup } from '../optimizer/summarizeSavedLineup'
import { POSITIONS } from '../optimizer/types'
import { BenchRow, Eyebrow, SlotRow } from './LineupParts'

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
  const [showBench, setShowBench] = useState(false)
  const totals = summarizeSavedLineup(lineup.slots, lineup.bench)
  const benchSalary = lineup.bench.reduce((sum, player) => sum + player.baseSalary, 0)
  const benchId = `bench-${lineup.id}`

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
              award: slot.award ?? null,
            }}
          />
        ))}
      </ul>

      {lineup.bench.length > 0 && (
        <div className="mt-1 border-t border-white/[0.05] px-4">
          <button
            onClick={() => setShowBench((v) => !v)}
            aria-expanded={showBench}
            aria-controls={benchId}
            className="-mx-1.5 flex w-[calc(100%+0.75rem)] items-center justify-between gap-2 rounded-md px-1.5 py-2 text-muted transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Bench</span>
              <span className="rounded-full bg-white/[0.08] px-1.5 font-mono text-[11px] tabular-nums text-text">
                {lineup.bench.length}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs tabular-nums">{benchSalary}</span>
              <svg
                viewBox="0 0 16 16"
                className={`h-3 w-3 transition-transform ${showBench ? 'rotate-180' : ''}`}
                fill="none"
                aria-hidden
              >
                <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          {showBench && (
            <ul id={benchId} className="divide-y divide-white/[0.05] pb-1">
              {lineup.bench.map((player) => (
                <BenchRow
                  key={player.playerId}
                  size="sm"
                  player={{
                    id: player.playerId,
                    name: player.name,
                    positions: player.positions,
                    salary: player.baseSalary,
                    offense: player.offense,
                    defense: player.defense,
                    award: player.award ?? null,
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}

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
