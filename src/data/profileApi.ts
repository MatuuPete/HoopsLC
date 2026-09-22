import { supabase } from '../lib/supabaseClient'

export interface Profile {
  isAdmin: boolean
  username: string | null
}

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin, username')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return { isAdmin: data?.is_admin ?? false, username: data?.username ?? null }
}

export async function setUsername(username: string): Promise<void> {
  const { error } = await supabase.rpc('set_username', { new_username: username })
  if (error) {
    // 23505 = unique_violation on profiles_username_key
    if (error.code === '23505') throw new Error('That username is taken')
    throw error
  }
}
