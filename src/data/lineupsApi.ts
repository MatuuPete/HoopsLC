import { supabase } from '../lib/supabaseClient'
import type { SavedLineupSlot } from '../optimizer/types'

export interface SavedLineup {
  id: string
  title: string
  createdAt: string
  slots: SavedLineupSlot[]
}

interface LineupRow {
  id: string
  title: string
  created_at: string
  slots: SavedLineupSlot[]
}

function fromRow(row: LineupRow): SavedLineup {
  return { id: row.id, title: row.title, createdAt: row.created_at, slots: row.slots }
}

export async function listLineups(): Promise<SavedLineup[]> {
  const { data, error } = await supabase
    .from('lineups')
    .select('id, title, created_at, slots')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as LineupRow[]).map(fromRow)
}

export async function createLineup(
  slots: SavedLineupSlot[],
  title: string,
  userId: string,
): Promise<SavedLineup> {
  const { data, error } = await supabase
    .from('lineups')
    .insert({ user_id: userId, title, slots })
    .select('id, title, created_at, slots')
    .single()
  if (error) throw error
  return fromRow(data as LineupRow)
}

export async function updateLineupTitle(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('lineups').update({ title }).eq('id', id)
  if (error) throw error
}

export async function deleteLineup(id: string): Promise<void> {
  const { error } = await supabase.from('lineups').delete().eq('id', id)
  if (error) throw error
}
