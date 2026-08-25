import { useCallback, useEffect, useState } from 'react'
import type { Player } from '../optimizer/types'
import { createPlayer, deletePlayer, listPlayers, updatePlayer, type NewPlayer } from './playersApi'
import { useAuth } from '../auth/AuthContext'

export function usePlayers() {
  const { session } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setPlayers(await listPlayers())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) refresh()
  }, [session, refresh])

  async function addPlayer(player: NewPlayer) {
    if (!session) return
    const created = await createPlayer(player, session.user.id)
    setPlayers((prev) => [...prev, created])
  }

  async function editPlayer(id: string, player: NewPlayer) {
    const updated = await updatePlayer(id, player)
    setPlayers((prev) => prev.map((p) => (p.id === id ? updated : p)))
  }

  async function removePlayer(id: string) {
    await deletePlayer(id)
    setPlayers((prev) => prev.filter((p) => p.id !== id))
  }

  return { players, loading, error, addPlayer, editPlayer, removePlayer, refresh }
}
