import { supabase } from '../lib/supabaseClient'

export async function getIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('is_admin').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.is_admin ?? false
}
