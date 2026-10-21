import { useCallback, useEffect, useState } from 'react'
import { createClip, deleteClip, listClips, subscribeToClips, type Clip } from './clipsApi'
import { useAuth } from '../auth/AuthContext'

export function useClips() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const [clips, setClips] = useState<Clip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Background refreshes keep `loading` untouched so the list doesn't flash.
  const refresh = useCallback(async () => {
    try {
      setClips(await listClips())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clips')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    refresh()

    // Pick up clips saved on another device: live through Realtime, and
    // again whenever this tab comes back into view in case the socket dropped.
    const unsubscribe = subscribeToClips(refresh)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [userId, refresh])

  async function addClip(body: string) {
    if (!userId) return
    const created = await createClip(body, userId)
    setClips((prev) => [created, ...prev.filter((clip) => clip.id !== created.id)])
  }

  async function removeClip(id: string) {
    await deleteClip(id)
    setClips((prev) => prev.filter((clip) => clip.id !== id))
  }

  return { clips, loading, error, addClip, removeClip, refresh }
}
