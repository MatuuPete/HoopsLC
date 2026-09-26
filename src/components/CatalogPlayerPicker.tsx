import { useState } from 'react'
import type { Position } from '../optimizer/types'
import type { CatalogPlayer } from '../catalog/types'
import { FormCard, PositionFilter, SearchInput } from './ui'

interface CatalogPlayerPickerProps {
  catalog: CatalogPlayer[]
  onSelect: (player: CatalogPlayer) => void
  onCancel: () => void
}

export function CatalogPlayerPicker({ catalog, onSelect, onCancel }: CatalogPlayerPickerProps) {
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState<Position | 'ALL'>('ALL')

  const filtered = catalog.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(search.toLowerCase())
    const matchesPosition = positionFilter === 'ALL' || player.positions.includes(positionFilter)
    return matchesSearch && matchesPosition
  })

  return (
    <FormCard eyebrow="Add from catalog" title="Choose a player" onClose={onCancel}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-64">
            <SearchInput value={search} onChange={setSearch} placeholder="Search catalog" label="Search catalog" />
          </div>
          <PositionFilter value={positionFilter} onChange={setPositionFilter} />
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-bg">
          <div className="grid grid-cols-[minmax(0,1fr)_5rem_4rem] gap-3 border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            <span>Player</span>
            <span>Pos</span>
            <span className="text-right">Price</span>
          </div>
          <div className="scrollbar-slim max-h-80 overflow-y-auto p-1">
            {filtered.map((player) => (
              <button
                key={player.id}
                onClick={() => onSelect(player)}
                className="grid w-full grid-cols-[minmax(0,1fr)_5rem_4rem] items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="truncate text-text">{player.name}</span>
                <span className="font-mono text-xs text-muted">{player.positions.join('/')}</span>
                <span className="text-right font-mono text-xs tabular-nums text-text">{player.price}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted">
                {catalog.length === 0 ? 'The catalog is empty.' : 'No catalog players match these filters.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </FormCard>
  )
}
