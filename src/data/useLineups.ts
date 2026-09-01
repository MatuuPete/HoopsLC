import { useCallback, useEffect, useState } from 'react'
import { createLineup, deleteLineup, listLineups, type SavedLineup } from './lineupsApi'
import type { SavedLineupSlot } from '../optimizer/types'
import { useAuth } from '../auth/AuthContext'

export function useLineups() {
  const { session } = useAuth()
  const [lineups, setLineups] = useState<SavedLineup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setLineups(await listLineups())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved lineups')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) refresh()
  }, [session, refresh])

  async function saveLineup(slots: SavedLineupSlot[]) {
    if (!session) return
    const created = await createLineup(slots, session.user.id)
    setLineups((prev) => [created, ...prev])
  }

  async function removeLineup(id: string) {
    await deleteLineup(id)
    setLineups((prev) => prev.filter((lineup) => lineup.id !== id))
  }

  return { lineups, loading, error, saveLineup, removeLineup, refresh }
}
