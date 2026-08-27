import type { Player } from '../optimizer/types'

interface PlayerChecklistProps {
  label: string
  players: Player[]
  selectedIds: string[]
  search: string
  onSearchChange: (value: string) => void
  onToggle: (playerId: string) => void
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
    <label className="flex items-center gap-2 normal-case tracking-normal text-text text-sm">
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
}: PlayerChecklistProps) {
  const query = search.toLowerCase()
  const matches = players.filter((p) => p.name.toLowerCase().includes(query))
  const matchIds = new Set(matches.map((p) => p.id))
  // Keep checked players visible even when the search filters them out, so
  // the picks you've already made stay in view. They're pinned below the
  // search matches.
  const selectedOffList = players.filter((p) => selectedIds.includes(p.id) && !matchIds.has(p.id))

  return (
    <div className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
      {label}
      <input
        className="bg-bg border border-border px-2 py-1 text-text normal-case tracking-normal text-sm"
        placeholder="Search player..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="border border-border bg-panel p-2 flex flex-col gap-1 max-h-48 overflow-y-auto">
        {players.length === 0 && <span className="text-muted normal-case">No owned players yet.</span>}
        {players.length > 0 && matches.length === 0 && selectedOffList.length === 0 && (
          <span className="text-muted normal-case">No players match "{search}".</span>
        )}
        {matches.map((p) => (
          <PlayerRow key={p.id} player={p} checked={selectedIds.includes(p.id)} onToggle={onToggle} />
        ))}
        {selectedOffList.length > 0 && matches.length > 0 && <div className="border-t border-border my-1" />}
        {selectedOffList.map((p) => (
          <PlayerRow key={p.id} player={p} checked onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}
