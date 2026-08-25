import { supabase } from '../lib/supabaseClient'

const DEFAULT_CAP = 3000

export async function getSalaryCap(): Promise<number> {
  const { data, error } = await supabase.from('settings').select('salary_cap').maybeSingle()
  if (error) throw error
  return data?.salary_cap ?? DEFAULT_CAP
}

export async function setSalaryCap(userId: string, salaryCap: number): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, salary_cap: salaryCap })
  if (error) throw error
}
