import { useState } from 'react'
import type { Player, Position } from '../optimizer/types'
import { TierBadge } from './LineupParts'
import { IconButton, PositionFilter, SearchInput, pencilPath, trashPath } from './ui'

interface PlayerTableProps {
  players: Player[]
  onEdit: (player: Player) => void
  onDelete: (id: string) => void
  onSelect?: (player: Player) => void
  selectedId?: string
}

const th = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted'
const numCell = 'px-4 py-3 text-right font-mono tabular-nums'

function SalaryChange({ player }: { player: Player }) {
  const delta = player.currentSalary - player.baseSalary
  if (delta === 0) return null
  const up = delta > 0
  return (
    <span className={`ml-2 text-[11px] ${up ? 'text-accent' : 'text-red-400'}`}>
      {up ? '+' : ''}
      {delta}
    </span>
  )
}

export function PlayerTable({ players, onEdit, onDelete, onSelect, selectedId }: PlayerTableProps) {
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState<Position | 'ALL'>('ALL')

  const query = search.toLowerCase()
  const visible = players.filter(
    (p) =>
      p.name.toLowerCase().includes(query) && (position === 'ALL' || p.positions.includes(position)),
  )

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-panel">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Search roster" label="Search roster" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <PositionFilter value={position} onChange={setPosition} />
          <span className="font-mono text-xs tabular-nums text-muted sm:hidden">{visible.length}</span>
        </div>
      </div>

      <div className="scrollbar-slim overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className={th}>Player</th>
              <th className={th}>Pos</th>
              <th className={`${th} text-right`}>Base</th>
              <th className={`${th} text-right`}>Current</th>
              <th className={`${th} text-right`}>Off</th>
              <th className={`${th} text-right`}>Def</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const selected = p.id === selectedId
              return (
                <tr
                  key={p.id}
                  onClick={onSelect ? () => onSelect(p) : undefined}
                  className={`group border-t border-border/70 transition-colors ${
                    onSelect ? 'cursor-pointer' : ''
                  } ${
                    selected
                      ? 'bg-accent/[0.06] shadow-[inset_2px_0_0_0_#22c55e]'
                      : 'hover:bg-white/[0.025]'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="flex min-w-0 items-center gap-2">
                      {onSelect ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelect(p)
                          }}
                          aria-pressed={selected}
                          className="truncate text-left font-medium text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {p.name}
                        </button>
                      ) : (
                        <span className="truncate font-medium text-text">{p.name}</span>
                      )}
                      {p.xTier && <TierBadge tier={p.xTier} />}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{p.positions.join('/')}</td>
                  <td className={`${numCell} text-muted`}>{p.baseSalary}</td>
                  <td className={`${numCell} text-text`}>
                    {p.currentSalary}
                    <SalaryChange player={p} />
                  </td>
                  <td className={`${numCell} text-text`}>{p.offense}</td>
                  <td className={`${numCell} text-text`}>{p.defense}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <span className="flex justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <IconButton label={`Edit ${p.name}`} onClick={() => onEdit(p)}>
                        {pencilPath}
                      </IconButton>
                      <IconButton label={`Delete ${p.name}`} tone="danger" onClick={() => onDelete(p.id)}>
                        {trashPath}
                      </IconButton>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {players.length === 0 && (
        <p className="border-t border-border px-4 py-10 text-center text-sm text-muted">
          Your roster is empty. Add a player from the catalog to get started.
        </p>
      )}
      {players.length > 0 && visible.length === 0 && (
        <p className="border-t border-border px-4 py-10 text-center text-sm text-muted">
          No players match these filters.
        </p>
      )}
    </section>
  )
}
