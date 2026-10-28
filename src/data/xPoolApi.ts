import { supabase } from '../lib/supabaseClient'
import type { Position, XTier } from '../optimizer/types'
import type { XPoolImportRow, XPoolPlayer } from '../catalog/xPool'

interface XPoolRow {
  id: string
  name: string
  team: string
  positions: Position[]
  x_tier: XTier
  offense: number
  defense: number
}

function fromRow(row: XPoolRow): XPoolPlayer {
  return {
    id: row.id,
    name: row.name,
    team: row.team,
    positions: row.positions,
    tier: row.x_tier,
    offense: row.offense,
    defense: row.defense,
  }
}

export async function listXPool(): Promise<XPoolPlayer[]> {
  const { data, error } = await supabase.from('x_pool').select('*').order('name')
  if (error) throw error
  return (data as XPoolRow[]).map(fromRow)
}

export async function applyXPoolImport(rows: XPoolImportRow[]): Promise<void> {
  const { error } = await supabase.rpc('apply_x_pool_import', { rows })
  if (error) throw error
}
