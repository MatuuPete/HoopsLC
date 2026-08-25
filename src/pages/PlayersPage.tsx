import { useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { PlayerForm } from '../components/PlayerForm'
import { PlayerTable } from '../components/PlayerTable'
import type { Player } from '../optimizer/types'
import type { NewPlayer } from '../data/playersApi'

export function PlayersPage() {
  const { players, loading, error, addPlayer, editPlayer, removePlayer } = usePlayers()
  const [editing, setEditing] = useState<Player | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function handleSubmit(player: NewPlayer) {
    if (editing) {
      await editPlayer(editing.id, player)
    } else {
      await addPlayer(player)
    }
    setEditing(null)
    setShowForm(false)
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm uppercase tracking-widest text-muted">Players</h1>
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold"
        >
          Add Player
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <p className="text-muted text-sm">Loading...</p>}

      {showForm && (
        <PlayerForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
        />
      )}

      <PlayerTable
        players={players}
        onEdit={(player) => {
          setEditing(player)
          setShowForm(true)
        }}
        onDelete={removePlayer}
      />
    </div>
  )
}
