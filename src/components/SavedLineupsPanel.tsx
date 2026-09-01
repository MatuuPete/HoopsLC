import { useState, type KeyboardEvent } from 'react'
import type { SavedLineup } from '../data/lineupsApi'
import { summarizeSavedLineup } from '../optimizer/summarizeSavedLineup'

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
    <div className="border border-border bg-panel p-4 flex flex-col gap-3">
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={handleKeyDown}
              className="bg-bg border border-border px-2 py-1 text-text text-sm"
            />
          ) : (
            <button
              onClick={() => {
                setDraft(lineup.title)
                setEditing(true)
              }}
              className="text-sm text-text text-left uppercase tracking-widest truncate"
              title="Rename"
            >
              {lineup.title || 'Untitled'}
            </button>
          )}
          <span className="text-xs uppercase tracking-widest text-muted">
            {formatSavedAt(lineup.createdAt)}
          </span>
        </div>
        <button
          onClick={() => onDelete(lineup.id)}
          className="text-red-400 shrink-0"
          aria-label="Delete saved lineup"
        >
          &times;
        </button>
      </div>

      {lineup.slots.map((slot) => (
        <div key={slot.position} className="flex justify-between text-sm">
          <span className="text-muted uppercase tracking-widest">
            {slot.position}
            {slot.isXPlayer ? ' (X)' : ''}
          </span>
          <span>{slot.name}</span>
          <span>{slot.currentSalary}</span>
        </div>
      ))}

      <div className="border-t border-border pt-3 flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Power by Sal</span>
        <span>{totals.totalPowerBySal}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Base Salary</span>
        <span>{totals.totalBaseSalary}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Offense</span>
        <span>{totals.totalOffense}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Defense</span>
        <span>{totals.totalDefense}</span>
      </div>
    </div>
  )
}

export function SavedLineupsPanel({ lineups, error, onRename, onDelete }: SavedLineupsPanelProps) {
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h2 className="text-sm uppercase tracking-widest text-muted">Saved Lineups</h2>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {lineups.length === 0 && !error && <p className="text-muted text-sm">No saved lineups yet.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {lineups.map((lineup) => (
          <SavedLineupCard key={lineup.id} lineup={lineup} onRename={onRename} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}
