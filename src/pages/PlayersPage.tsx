import { useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useCatalog } from '../data/useCatalog'
import { PlayerForm } from '../components/PlayerForm'
import { CatalogPlayerPicker } from '../components/CatalogPlayerPicker'
import { CatalogPlayerSalaryForm } from '../components/CatalogPlayerSalaryForm'
import { PlayerTable } from '../components/PlayerTable'
import { RosterPanel } from '../components/RosterPanel'
import type { Player } from '../optimizer/types'
import type { CatalogPlayer } from '../catalog/types'
import type { NewPlayer } from '../data/playersApi'
import { buttonPrimary, buttonSecondary } from '../components/ui'

type Mode =
  | { kind: 'closed' }
  | { kind: 'pick-catalog' }
  | { kind: 'add-catalog'; player: CatalogPlayer }
  | { kind: 'edit-catalog'; player: Player }
  | { kind: 'x-form'; editing?: Player }

export function PlayersPage() {
  const { players, loading, error, addPlayer, editPlayer, removePlayer } = usePlayers()
  const { catalog } = useCatalog()
  const [mode, setMode] = useState<Mode>({ kind: 'closed' })
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)

  function openEditor(player: Player) {
    setMode(player.isXPlayer ? { kind: 'x-form', editing: player } : { kind: 'edit-catalog', player })
  }

  async function handleDelete(id: string) {
    if (id === selectedPlayerId) setSelectedPlayerId(null)
    await removePlayer(id)
  }

  async function handleXSubmit(player: NewPlayer) {
    if (mode.kind === 'x-form' && mode.editing) {
      await editPlayer(mode.editing.id, player)
    } else {
      await addPlayer(player)
    }
    setMode({ kind: 'closed' })
  }

  async function handleAddCatalogSubmit(
    player: CatalogPlayer,
    baseSalary: number,
    positions: CatalogPlayer['positions'],
  ) {
    await addPlayer({
      name: player.name,
      positions,
      isXPlayer: false,
      xTier: null,
      baseSalary,
      currentSalary: player.price,
      offense: player.offense,
      defense: player.defense,
      catalogPlayerId: player.id,
    })
    setMode({ kind: 'closed' })
  }

  async function handleEditCatalogSubmit(
    existing: Player,
    baseSalary: number,
    positions: Player['positions'],
  ) {
    await editPlayer(existing.id, {
      name: existing.name,
      positions,
      isXPlayer: false,
      xTier: null,
      baseSalary,
      currentSalary: existing.currentSalary,
      offense: existing.offense,
      defense: existing.defense,
      catalogPlayerId: existing.catalogPlayerId,
    })
    setMode({ kind: 'closed' })
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 font-body sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-border pb-6">
        <div>
          <h1 className="font-display text-4xl uppercase leading-none tracking-wide text-text sm:text-5xl">
            Players
          </h1>
          <p className="mt-3 text-sm text-muted">
            {players.length === 1 ? '1 player' : `${players.length} players`} on your roster, priced at what
            you own them for.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode({ kind: 'x-form' })}
            className={buttonSecondary}
          >
            Add X Player
          </button>
          <button
            onClick={() => setMode({ kind: 'pick-catalog' })}
            className={buttonPrimary}
          >
            Add from catalog
          </button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          {error && (
            <p className="rounded-xl border border-red-400/25 bg-red-400/[0.05] px-5 py-4 text-sm text-red-300">
              {error}
            </p>
          )}

          {mode.kind === 'pick-catalog' && (
            <CatalogPlayerPicker
              catalog={catalog}
              onSelect={(player) => setMode({ kind: 'add-catalog', player })}
              onCancel={() => setMode({ kind: 'closed' })}
            />
          )}

          {mode.kind === 'add-catalog' && (
            <CatalogPlayerSalaryForm
              key={mode.player.id}
              name={mode.player.name}
              positions={mode.player.positions}
              price={mode.player.price}
              offense={mode.player.offense}
              defense={mode.player.defense}
              onSubmit={(baseSalary, positions) => handleAddCatalogSubmit(mode.player, baseSalary, positions)}
              onCancel={() => setMode({ kind: 'closed' })}
            />
          )}

          {mode.kind === 'edit-catalog' && (
            <CatalogPlayerSalaryForm
              key={mode.player.id}
              name={mode.player.name}
              positions={mode.player.positions}
              price={mode.player.currentSalary}
              offense={mode.player.offense}
              defense={mode.player.defense}
              initialBaseSalary={mode.player.baseSalary}
              onSubmit={(baseSalary, positions) => handleEditCatalogSubmit(mode.player, baseSalary, positions)}
              onCancel={() => setMode({ kind: 'closed' })}
            />
          )}

          {mode.kind === 'x-form' && (
            <PlayerForm
              key={mode.editing?.id ?? 'new'}
              initial={mode.editing}
              onSubmit={handleXSubmit}
              onCancel={() => setMode({ kind: 'closed' })}
            />
          )}

          {loading ? (
            <div className="rounded-xl border border-border bg-panel px-5 py-10 text-center text-sm text-muted">
              Loading roster…
            </div>
          ) : (
            <PlayerTable
              players={players}
              onEdit={openEditor}
              onDelete={handleDelete}
              onSelect={(player) =>
                setSelectedPlayerId((current) => (current === player.id ? null : player.id))
              }
              selectedId={selectedPlayerId ?? undefined}
            />
          )}
        </div>

        <div className="self-start lg:sticky lg:top-6">
          <RosterPanel
            players={players}
            selectedPlayerId={selectedPlayerId}
            onEdit={openEditor}
            onDelete={handleDelete}
            onClearSelection={() => setSelectedPlayerId(null)}
          />
        </div>
      </div>
    </div>
  )
}
