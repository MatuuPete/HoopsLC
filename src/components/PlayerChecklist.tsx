import type { Player } from '../optimizer/types'

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
    <label className="flex items-center gap-2 normal-case tracking-normal text-text text-sm rounded-md px-2 py-1 hover:bg-white/5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={() => onToggle(player.id)} />
      {player.name} ({player.positions.join('/')})
      {!player.isXPlayer && <span className="text-muted"> · {player.baseSalary} base</span>}
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

  return (
    <div className="rounded-lg border border-white/10 bg-[#161616] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted">
        <span>{label}</span>
        {selectedIds.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-accent normal-case tracking-normal text-xs"
          >
            Clear All
          </button>
        )}
      </div>

      <input
        className="bg-bg border border-white/10 rounded-md px-2 py-1 text-text normal-case tracking-normal text-sm"
        placeholder="Search player..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <div className="scrollbar-slim flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1">
        {players.length === 0 && <span className="text-muted normal-case px-2 py-1">No owned players yet.</span>}
        {players.length > 0 && matches.length === 0 && selectedOffList.length === 0 && (
          <span className="text-muted normal-case px-2 py-1">No players match "{search}".</span>
        )}
        {matches.map((p) => (
          <PlayerRow key={p.id} player={p} checked={selectedIds.includes(p.id)} onToggle={onToggle} />
        ))}
        {selectedOffList.length > 0 && matches.length > 0 && <div className="border-t border-white/10 my-1" />}
        {selectedOffList.map((p) => (
          <PlayerRow key={p.id} player={p} checked onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}
