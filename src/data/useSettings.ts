import { useCallback, useEffect, useState } from 'react'
import {
  getSettings,
  setBenchEnabled,
  setBenchSize,
  setObjectiveMode,
  setOffenseWeight,
  setPreferredBenchPlayerIds,
  setRequiredPlayerIds,
  setSalaryCap,
  setSavedLineupCount,
  setUnavailablePlayerIds,
} from './settingsApi'
import { MAX_BENCH_SIZE, type ObjectiveMode } from '../optimizer/types'
import { useAuth } from '../auth/AuthContext'

export function useSettings() {
  const { session } = useAuth()
  const [salaryCap, setSalaryCapState] = useState(3000)
  const [requiredPlayerIds, setRequiredPlayerIdsState] = useState<string[]>([])
  const [unavailablePlayerIds, setUnavailablePlayerIdsState] = useState<string[]>([])
  const [objectiveMode, setObjectiveModeState] = useState<ObjectiveMode>('power')
  const [offenseWeight, setOffenseWeightState] = useState(0.5)
  const [savedLineupCount, setSavedLineupCountState] = useState(0)
  const [benchEnabled, setBenchEnabledState] = useState(false)
  const [benchSize, setBenchSizeState] = useState(MAX_BENCH_SIZE)
  const [preferredBenchPlayerIds, setPreferredBenchPlayerIdsState] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const settings = await getSettings()
    setSalaryCapState(settings.salaryCap)
    setRequiredPlayerIdsState(settings.requiredPlayerIds)
    setUnavailablePlayerIdsState(settings.unavailablePlayerIds)
    setObjectiveModeState(settings.objectiveMode)
    setOffenseWeightState(settings.offenseWeight)
    setSavedLineupCountState(settings.savedLineupCount)
    setBenchEnabledState(settings.benchEnabled)
    setBenchSizeState(settings.benchSize)
    setPreferredBenchPlayerIdsState(settings.preferredBenchPlayerIds)
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

  async function updateUnavailablePlayerIds(value: string[]) {
    if (!session) return
    await setUnavailablePlayerIds(session.user.id, value)
    setUnavailablePlayerIdsState(value)
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

  async function updateSavedLineupCount(value: number) {
    if (!session) return
    await setSavedLineupCount(session.user.id, value)
    setSavedLineupCountState(value)
  }

  async function updateBenchEnabled(value: boolean) {
    if (!session) return
    await setBenchEnabled(session.user.id, value)
    setBenchEnabledState(value)
  }

  async function updateBenchSize(value: number) {
    if (!session) return
    await setBenchSize(session.user.id, value)
    setBenchSizeState(value)
  }

  async function updatePreferredBenchPlayerIds(value: string[]) {
    if (!session) return
    await setPreferredBenchPlayerIds(session.user.id, value)
    setPreferredBenchPlayerIdsState(value)
  }

  return {
    salaryCap,
    requiredPlayerIds,
    unavailablePlayerIds,
    objectiveMode,
    offenseWeight,
    savedLineupCount,
    benchEnabled,
    benchSize,
    preferredBenchPlayerIds,
    loading,
    updateSalaryCap,
    updateRequiredPlayerIds,
    updateUnavailablePlayerIds,
    updateObjectiveMode,
    updateOffenseWeight,
    updateSavedLineupCount,
    updateBenchEnabled,
    updateBenchSize,
    updatePreferredBenchPlayerIds,
  }
}
