import { useCallback, useEffect, useState } from 'react'
import {
  getSettings,
  setObjectiveMode,
  setOffenseWeight,
  setRequiredPlayerIds,
  setSalaryCap,
} from './settingsApi'
import type { ObjectiveMode } from '../optimizer/types'
import { useAuth } from '../auth/AuthContext'

export function useSettings() {
  const { session } = useAuth()
  const [salaryCap, setSalaryCapState] = useState(3000)
  const [requiredPlayerIds, setRequiredPlayerIdsState] = useState<string[]>([])
  const [objectiveMode, setObjectiveModeState] = useState<ObjectiveMode>('power')
  const [offenseWeight, setOffenseWeightState] = useState(0.5)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const settings = await getSettings()
    setSalaryCapState(settings.salaryCap)
    setRequiredPlayerIdsState(settings.requiredPlayerIds)
    setObjectiveModeState(settings.objectiveMode)
    setOffenseWeightState(settings.offenseWeight)
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

  async function updateRequiredPlayerIds(value: string[]) {
    if (!session) return
    await setRequiredPlayerIds(session.user.id, value)
    setRequiredPlayerIdsState(value)
  }

  async function updateObjectiveMode(value: ObjectiveMode) {
    if (!session) return
    await setObjectiveMode(session.user.id, value)
    setObjectiveModeState(value)
  }

  async function updateOffenseWeight(value: number) {
    if (!session) return
    await setOffenseWeight(session.user.id, value)
    setOffenseWeightState(value)
  }

  return {
    salaryCap,
    requiredPlayerIds,
    objectiveMode,
    offenseWeight,
    loading,
    updateSalaryCap,
    updateRequiredPlayerIds,
    updateObjectiveMode,
    updateOffenseWeight,
  }
}
