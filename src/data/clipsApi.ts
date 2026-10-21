import { supabase } from '../lib/supabaseClient'

export interface Clip {
  id: string
  body: string
  createdAt: string
}

interface ClipRow {
  id: string
  body: string
  created_at: string
}

function fromRow(row: ClipRow): Clip {
  return { id: row.id, body: row.body, createdAt: row.created_at }
}

export async function listClips(): Promise<Clip[]> {
  const { data, error } = await supabase
    .from('clips')
    .select('id, body, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ClipRow[]).map(fromRow)
}

export async function createClip(body: string, userId: string): Promise<Clip> {
  const { data, error } = await supabase
    .from('clips')
    .insert({ user_id: userId, body })
    .select('id, body, created_at')
    .single()
  if (error) throw error
  return fromRow(data as ClipRow)
}

export async function deleteClip(id: string): Promise<void> {
  const { error } = await supabase.from('clips').delete().eq('id', id)
  if (error) throw error
}

/** Calls `onChange` whenever a clip is added or removed on any device. Returns an unsubscribe. */
export function subscribeToClips(onChange: () => void): () => void {
  const channel = supabase
    .channel('clips')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clips' }, onChange)
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
