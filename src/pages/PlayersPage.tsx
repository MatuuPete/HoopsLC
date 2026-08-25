import { useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useCatalog } from '../data/useCatalog'
import { PlayerForm } from '../components/PlayerForm'
import { CatalogPlayerPicker } from '../components/CatalogPlayerPicker'
import { CatalogPlayerSalaryForm } from '../components/CatalogPlayerSalaryForm'
import { PlayerTable } from '../components/PlayerTable'
import type { Player, Position } from '../optimizer/types'
import type { CatalogPlayer } from '../catalog/types'
import type { NewPlayer } from '../data/playersApi'

type Mode =
  | { kind: 'closed' }
  | { kind: 'pick-catalog' }
  | { kind: 'add-catalog'; player: CatalogPlayer; position: Position }
  | { kind: 'edit-catalog'; player: Player }
  | { kind: 'x-form'; editing?: Player }

export function PlayersPage() {
  const { players, loading, error, addPlayer, editPlayer, removePlayer } = usePlayers()
  const { catalog } = useCatalog()
  const [mode, setMode] = useState<Mode>({ kind: 'closed' })

  async function handleXSubmit(player: NewPlayer) {
    if (mode.kind === 'x-form' && mode.editing) {
      await editPlayer(mode.editing.id, player)
    } else {
      await addPlayer(player)
    }
    setMode({ kind: 'closed' })
  }

  async function handleAddCatalogSubmit(player: CatalogPlayer, position: Position, baseSalary: number) {
    await addPlayer({
      name: player.name,
      position,
      isXPlayer: false,
      baseSalary,
      currentSalary: player.price,
      offense: player.offense,
      defense: player.defense,
      catalogPlayerId: player.id,
    })
    setMode({ kind: 'closed' })
  }

  async function handleEditCatalogSubmit(existing: Player, baseSalary: number) {
    await editPlayer(existing.id, {
      name: existing.name,
      position: existing.position,
      isXPlayer: false,
      baseSalary,
      currentSalary: existing.currentSalary,
      offense: existing.offense,
      defense: existing.defense,
      catalogPlayerId: existing.catalogPlayerId,
    })
    setMode({ kind: 'closed' })
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm uppercase tracking-widest text-muted">Players</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMode({ kind: 'pick-catalog' })}
            className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold"
          >
            Add From Catalog
          </button>
          <button
            onClick={() => setMode({ kind: 'x-form' })}
            className="border border-border px-4 py-2 uppercase tracking-widest text-xs"
          >
            Add X Player
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <p className="text-muted text-sm">Loading...</p>}

      {mode.kind === 'pick-catalog' && (
        <CatalogPlayerPicker
          catalog={catalog}
          onSelect={(player, position) => setMode({ kind: 'add-catalog', player, position })}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      )}

      {mode.kind === 'add-catalog' && (
        <CatalogPlayerSalaryForm
          name={mode.player.name}
          position={mode.position}
          price={mode.player.price}
          offense={mode.player.offense}
          defense={mode.player.defense}
          onSubmit={(baseSalary) => handleAddCatalogSubmit(mode.player, mode.position, baseSalary)}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      )}

      {mode.kind === 'edit-catalog' && (
        <CatalogPlayerSalaryForm
          name={mode.player.name}
          position={mode.player.position}
          price={mode.player.currentSalary}
          offense={mode.player.offense}
          defense={mode.player.defense}
          initialBaseSalary={mode.player.baseSalary}
          onSubmit={(baseSalary) => handleEditCatalogSubmit(mode.player, baseSalary)}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      )}

      {mode.kind === 'x-form' && (
        <PlayerForm
          initial={mode.editing}
          onSubmit={handleXSubmit}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      )}

      <PlayerTable
        players={players}
        onEdit={(player) =>
          setMode(player.isXPlayer ? { kind: 'x-form', editing: player } : { kind: 'edit-catalog', player })
        }
        onDelete={removePlayer}
      />
    </div>
  )
}
