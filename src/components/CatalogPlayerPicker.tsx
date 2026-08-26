import { useState } from 'react'
import { POSITIONS, type Position } from '../optimizer/types'
import type { CatalogPlayer } from '../catalog/types'

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
    <div className="border border-border bg-panel p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-widest text-muted">Choose a Player</h2>
        <button onClick={onCancel} className="text-xs uppercase tracking-widest text-muted underline">
          Cancel
        </button>
      </div>

      <input
        className="bg-bg border border-border px-2 py-1 text-text text-sm"
        placeholder="Search player..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-2 text-xs uppercase tracking-widest">
        {(['ALL', ...POSITIONS] as const).map((option) => (
          <button
            key={option}
            onClick={() => setPositionFilter(option)}
            className={positionFilter === option ? 'text-accent' : 'text-muted'}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
        {filtered.map((player) => (
          <button
            key={player.id}
            onClick={() => onSelect(player)}
            className="flex justify-between text-sm py-1 border-b border-border text-left"
          >
            <span>{player.name}</span>
            <span className="text-muted">{player.positions.join('/')}</span>
            <span>{player.price}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
