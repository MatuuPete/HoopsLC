import type { Player } from '../optimizer/types'
import { TierBadge } from './LineupParts'

interface PlayerChecklistProps {
  label: string
  players: Player[]
  selectedIds: string[]
  search: string
  onSearchChange: (value: string) => void
  onToggle: (playerId: string) => void
  onClearAll: () => void
}

function PlayerRow({
  player,
  checked,
  onToggle,
}: {
  player: Player
  checked: boolean
  onToggle: (playerId: string) => void
}) {
  return (
    <label
      className={`group relative grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors ${
        checked ? 'bg-accent/[0.08]' : 'hover:bg-white/[0.04]'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(player.id)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
          checked ? 'border-accent bg-accent' : 'border-muted/50 group-hover:border-muted'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-ink" fill="none">
            <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={`truncate ${checked ? 'text-text' : 'text-text/90'}`}>{player.name}</span>
        {player.xTier && <TierBadge tier={player.xTier} />}
        <span className="shrink-0 font-mono text-[11px] text-muted">{player.positions.join('/')}</span>
      </span>
      <span className="font-mono text-xs tabular-nums text-muted">
        {player.isXPlayer ? '' : player.baseSalary}
      </span>
    </label>
  )
}

export function PlayerChecklist({
  label,
  players,
  selectedIds,
  search,
  onSearchChange,
  onToggle,
  onClearAll,
}: PlayerChecklistProps) {
  const query = search.toLowerCase()
  const matches = players.filter((p) => p.name.toLowerCase().includes(query))
  const matchIds = new Set(matches.map((p) => p.id))
  // Keep checked players visible even when the search filters them out, so
  // the picks you've already made stay in view. They're pinned below the
  // search matches.
  const selectedOffList = players.filter((p) => selectedIds.includes(p.id) && !matchIds.has(p.id))
  const selectedCount = players.filter((p) => selectedIds.includes(p.id)).length

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex items-center gap-2 border-b border-border px-3">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-muted" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          aria-label={`Search ${label.toLowerCase()}`}
          className="w-full bg-transparent py-2.5 text-sm text-text placeholder:text-muted/70 focus:outline-none"
          placeholder="Search players"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {selectedCount > 0 && (
          <button
            onClick={onClearAll}
            className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Clear {selectedCount}
          </button>
        )}
      </div>

      <div className="scrollbar-slim flex max-h-56 flex-col gap-px overflow-y-auto p-1.5">
        {players.length === 0 && <span className="px-2.5 py-2 text-sm text-muted">No owned players yet.</span>}
        {players.length > 0 && matches.length === 0 && selectedOffList.length === 0 && (
          <span className="px-2.5 py-2 text-sm text-muted">No players match “{search}”.</span>
        )}
        {matches.map((p) => (
          <PlayerRow key={p.id} player={p} checked={selectedIds.includes(p.id)} onToggle={onToggle} />
        ))}
        {selectedOffList.length > 0 && matches.length > 0 && <div className="mx-2.5 my-1 border-t border-border" />}
        {selectedOffList.map((p) => (
          <PlayerRow key={p.id} player={p} checked onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}
