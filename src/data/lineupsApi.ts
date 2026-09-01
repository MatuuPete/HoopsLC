import { supabase } from '../lib/supabaseClient'
import type { SavedLineupSlot } from '../optimizer/types'

export interface SavedLineup {
  id: string
  createdAt: string
  slots: SavedLineupSlot[]
}

interface LineupRow {
  id: string
  created_at: string
  slots: SavedLineupSlot[]
}

function fromRow(row: LineupRow): SavedLineup {
  return { id: row.id, createdAt: row.created_at, slots: row.slots }
}

export async function listLineups(): Promise<SavedLineup[]> {
  const { data, error } = await supabase
    .from('lineups')
    .select('id, created_at, slots')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as LineupRow[]).map(fromRow)
}

export async function createLineup(slots: SavedLineupSlot[], userId: string): Promise<SavedLineup> {
  const { data, error } = await supabase
    .from('lineups')
    .insert({ user_id: userId, slots })
    .select('id, created_at, slots')
    .single()
  if (error) throw error
  return fromRow(data as LineupRow)
}

export async function deleteLineup(id: string): Promise<void> {
  const { error } = await supabase.from('lineups').delete().eq('id', id)
  if (error) throw error
}
