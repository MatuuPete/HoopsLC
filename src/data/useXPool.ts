import { useCallback, useEffect, useState } from 'react'
import type { XPoolImportRow, XPoolPlayer } from '../catalog/xPool'
import { applyXPoolImport, listXPool } from './xPoolApi'
import { useAuth } from '../auth/AuthContext'

export function useXPool() {
  const { session } = useAuth()
  const [pool, setPool] = useState<XPoolPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setPool(await listXPool())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the X pool')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) refresh()
  }, [session, refresh])

  async function importBatch(rows: XPoolImportRow[]) {
    await applyXPoolImport(rows)
    await refresh()
  }

  return { pool, loading, error, refresh, importBatch }
}
