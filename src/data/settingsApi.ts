import { supabase } from '../lib/supabaseClient'
import { MAX_BENCH_SIZE, type ObjectiveMode } from '../optimizer/types'
import type { PlayerRoleLists } from '../optimizer/playerRoles'

const DEFAULT_CAP = 3000

interface Settings {
  salaryCap: number
  requiredPlayerIds: string[]
  unavailablePlayerIds: string[]
  objectiveMode: ObjectiveMode
  offenseWeight: number
  savedLineupCount: number
  benchEnabled: boolean
  benchSize: number
  preferredBenchPlayerIds: string[]
  legendEventEnabled: boolean
  big3Count: number
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .select(
      'salary_cap, required_player_ids, unavailable_player_ids, objective_mode, offense_weight, saved_lineup_count, bench_enabled, bench_size, preferred_bench_player_ids, legend_event_enabled, big3_count',
    )
    .maybeSingle()
  if (error) throw error
  return {
    salaryCap: data?.salary_cap ?? DEFAULT_CAP,
    requiredPlayerIds: data?.required_player_ids ?? [],
    unavailablePlayerIds: data?.unavailable_player_ids ?? [],
    objectiveMode: (data?.objective_mode as ObjectiveMode) ?? 'power',
    offenseWeight: data?.offense_weight ?? 0.5,
    savedLineupCount: data?.saved_lineup_count ?? 0,
    benchEnabled: data?.bench_enabled ?? false,
    benchSize: data?.bench_size ?? MAX_BENCH_SIZE,
    preferredBenchPlayerIds: data?.preferred_bench_player_ids ?? [],
    legendEventEnabled: data?.legend_event_enabled ?? false,
    big3Count: data?.big3_count ?? 0,
  }
}

export async function setSalaryCap(userId: string, salaryCap: number): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, salary_cap: salaryCap })
  if (error) throw error
}

export async function setObjectiveMode(userId: string, objectiveMode: ObjectiveMode): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, objective_mode: objectiveMode })
  if (error) throw error
}

export async function setOffenseWeight(userId: string, offenseWeight: number): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, offense_weight: offenseWeight })
  if (error) throw error
}

export async function setSavedLineupCount(userId: string, savedLineupCount: number): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ user_id: userId, saved_lineup_count: savedLineupCount })
  if (error) throw error
}

export async function setBenchEnabled(userId: string, benchEnabled: boolean): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, bench_enabled: benchEnabled })
  if (error) throw error
}

export async function setBenchSize(userId: string, benchSize: number): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, bench_size: benchSize })
  if (error) throw error
}

export async function setLegendEventEnabled(userId: string, legendEventEnabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ user_id: userId, legend_event_enabled: legendEventEnabled })
  if (error) throw error
}

export async function setBig3Count(userId: string, big3Count: number): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, big3_count: big3Count })
  if (error) throw error
}

/** Saves all three player-role lists in one write, so a role change never leaves them half-updated. */
export async function setPlayerRoles(userId: string, lists: PlayerRoleLists): Promise<void> {
  const { error } = await supabase.from('settings').upsert({
    user_id: userId,
    required_player_ids: lists.requiredPlayerIds,
    preferred_bench_player_ids: lists.preferredBenchPlayerIds,
    unavailable_player_ids: lists.unavailablePlayerIds,
  })
  if (error) throw error
}
