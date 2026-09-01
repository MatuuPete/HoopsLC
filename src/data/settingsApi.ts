import { supabase } from '../lib/supabaseClient'
import type { ObjectiveMode } from '../optimizer/types'

const DEFAULT_CAP = 3000

interface Settings {
  salaryCap: number
  requiredPlayerIds: string[]
  objectiveMode: ObjectiveMode
  offenseWeight: number
  savedLineupCount: number
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .select('salary_cap, required_player_ids, objective_mode, offense_weight, saved_lineup_count')
    .maybeSingle()
  if (error) throw error
  return {
    salaryCap: data?.salary_cap ?? DEFAULT_CAP,
    requiredPlayerIds: data?.required_player_ids ?? [],
    objectiveMode: (data?.objective_mode as ObjectiveMode) ?? 'power',
    offenseWeight: data?.offense_weight ?? 0.5,
    savedLineupCount: data?.saved_lineup_count ?? 0,
  }
}

export async function setSalaryCap(userId: string, salaryCap: number): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, salary_cap: salaryCap })
  if (error) throw error
}

export async function setRequiredPlayerIds(userId: string, requiredPlayerIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ user_id: userId, required_player_ids: requiredPlayerIds })
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
