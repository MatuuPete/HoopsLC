import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getSettings,
  setBenchEnabled,
  setBig3,
  setSuperBig3PlayerIds,
  setTeamBig3Locks,
  setBenchSize,
  setLegendEventEnabled,
  setObjectiveMode,
  setOffenseWeight,
  setPlayerRoles,
  setSalaryCap,
  setSavedLineupCount,
} from './settingsApi'
import { MAX_BENCH_SIZE, type ObjectiveMode } from '../optimizer/types'
import type { PlayerRoleLists } from '../optimizer/playerRoles'
import { useAuth } from '../auth/AuthContext'
import type { Big3, Big3Mode } from '../optimizer/big3'

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
  const [legendEventEnabled, setLegendEventEnabledState] = useState(false)
  const [big3Mode, setBig3ModeState] = useState<Big3Mode>('off')
  const [big3Count, setBig3CountState] = useState(0)
  const [superBig3PlayerIds, setSuperBig3PlayerIdsState] = useState<string[]>([])
  const [teamBig3Locks, setTeamBig3LocksState] = useState<Big3[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const roleSaves = useRef<Promise<void>>(Promise.resolve())

  // A failed load would otherwise leave every setting on its default with no
  // sign anything went wrong, so the error is kept for the page to show.
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
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
      setLegendEventEnabledState(settings.legendEventEnabled)
      setBig3ModeState(settings.big3Mode)
      setBig3CountState(settings.big3Count)
      setSuperBig3PlayerIdsState(settings.superBig3PlayerIds)
      setTeamBig3LocksState(settings.teamBig3Locks)
      setError(null)
    } catch (err) {
      setError(`Couldn't load your settings: ${errorMessage(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  /** Runs a settings save, recording a failure instead of letting it vanish. */
  async function save(write: () => Promise<void>) {
    try {
      await write()
      return true
    } catch (err) {
      setError(`Couldn't save your settings: ${errorMessage(err)}`)
      return false
    }
  }

  useEffect(() => {
    if (session) refresh()
  }, [session, refresh])

  async function updateSalaryCap(value: number) {
    if (!session) return
    if (await save(() => setSalaryCap(session.user.id, value))) setSalaryCapState(value)
  }

  async function updateObjectiveMode(value: ObjectiveMode) {
    if (!session) return
    if (await save(() => setObjectiveMode(session.user.id, value))) setObjectiveModeState(value)
  }

  async function updateOffenseWeight(value: number) {
    if (!session) return
    if (await save(() => setOffenseWeight(session.user.id, value))) setOffenseWeightState(value)
  }

  async function updateSavedLineupCount(value: number) {
    if (!session) return
    if (await save(() => setSavedLineupCount(session.user.id, value))) setSavedLineupCountState(value)
  }

  async function updateBenchEnabled(value: boolean) {
    if (!session) return
    if (await save(() => setBenchEnabled(session.user.id, value))) setBenchEnabledState(value)
  }

  async function updateBenchSize(value: number) {
    if (!session) return
    if (await save(() => setBenchSize(session.user.id, value))) setBenchSizeState(value)
  }

  async function updateLegendEventEnabled(value: boolean) {
    if (!session) return
    if (await save(() => setLegendEventEnabled(session.user.id, value))) setLegendEventEnabledState(value)
  }

  /** Off clears the Team Big 3 count too, so turning it back on starts from 1. */
  async function updateBig3(mode: Big3Mode, count: number) {
    if (!session) return
    const nextCount = mode === 'off' ? 0 : count
    if (await save(() => setBig3(session.user.id, mode, nextCount))) {
      setBig3ModeState(mode)
      setBig3CountState(nextCount)
    }
  }

  async function updateTeamBig3Locks(locks: Big3[]) {
    if (!session) return
    if (await save(() => setTeamBig3Locks(session.user.id, locks))) setTeamBig3LocksState(locks)
  }

  async function updateSuperBig3PlayerIds(ids: string[]) {
    if (!session) return
    if (await save(() => setSuperBig3PlayerIds(session.user.id, ids))) setSuperBig3PlayerIdsState(ids)
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
    roleSaves.current = roleSaves.current.then(() => save(() => setPlayerRoles(userId, lists))).then(() => {})
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
    legendEventEnabled,
    big3Mode,
    big3Count,
    superBig3PlayerIds,
    teamBig3Locks,
    loading,
    error,
    updateSalaryCap,
    updateObjectiveMode,
    updateOffenseWeight,
    updateSavedLineupCount,
    updateBenchEnabled,
    updateBenchSize,
    updateLegendEventEnabled,
    updateBig3,
    updateSuperBig3PlayerIds,
    updateTeamBig3Locks,
    updatePlayerRoles,
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String(err.message)
  return 'unknown error'
}
