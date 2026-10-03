import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getSettings,
  setBenchEnabled,
  setBenchSize,
  setObjectiveMode,
  setOffenseWeight,
  setPlayerRoles,
  setSalaryCap,
  setSavedLineupCount,
} from './settingsApi'
import { MAX_BENCH_SIZE, type ObjectiveMode } from '../optimizer/types'
import type { PlayerRoleLists } from '../optimizer/playerRoles'
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
  const roleSaves = useRef<Promise<void>>(Promise.resolve())

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

  // Role buttons get clicked in quick succession, so the lists update on
  // screen right away (the next click builds on them) and saves are queued
  // so they reach the server in click order.
  function updatePlayerRoles(lists: PlayerRoleLists): Promise<void> {
    if (!session) return Promise.resolve()
    setRequiredPlayerIdsState(lists.requiredPlayerIds)
    setPreferredBenchPlayerIdsState(lists.preferredBenchPlayerIds)
    setUnavailablePlayerIdsState(lists.unavailablePlayerIds)
    const userId = session.user.id
    roleSaves.current = roleSaves.current.catch(() => {}).then(() => setPlayerRoles(userId, lists))
    return roleSaves.current
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
    updateObjectiveMode,
    updateOffenseWeight,
    updateSavedLineupCount,
    updateBenchEnabled,
    updateBenchSize,
    updatePlayerRoles,
  }
}
