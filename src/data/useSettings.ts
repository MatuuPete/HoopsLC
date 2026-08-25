import { useCallback, useEffect, useState } from 'react'
import { getSalaryCap, setSalaryCap } from './settingsApi'
import { useAuth } from '../auth/AuthContext'

export function useSettings() {
  const { session } = useAuth()
  const [salaryCap, setSalaryCapState] = useState(3000)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    setSalaryCapState(await getSalaryCap())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (session) refresh()
  }, [session, refresh])

  async function updateSalaryCap(value: number) {
    if (!session) return
    await setSalaryCap(session.user.id, value)
    setSalaryCapState(value)
  }

  return { salaryCap, loading, updateSalaryCap }
}
