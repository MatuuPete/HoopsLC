import { useCallback, useEffect, useState } from 'react'
import type { CatalogImportRow, CatalogPlayer } from '../catalog/types'
import { applyCatalogImport, listCatalogPlayers } from './catalogApi'
import { useAuth } from '../auth/AuthContext'

export function useCatalog() {
  const { session } = useAuth()
  const [catalog, setCatalog] = useState<CatalogPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setCatalog(await listCatalogPlayers())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load player catalog')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) refresh()
  }, [session, refresh])

  async function importBatch(rows: CatalogImportRow[]) {
    await applyCatalogImport(rows)
    await refresh()
  }

  return { catalog, loading, error, refresh, importBatch }
}
