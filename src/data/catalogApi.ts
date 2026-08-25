import { supabase } from '../lib/supabaseClient'
import type { Position } from '../optimizer/types'
import type { CatalogImportRow, CatalogPlayer } from '../catalog/types'

interface CatalogRow {
  id: string
  name: string
  positions: Position[]
  price: number
  offense: number
  defense: number
  updated_at: string
}

function fromRow(row: CatalogRow): CatalogPlayer {
  return {
    id: row.id,
    name: row.name,
    positions: row.positions,
    price: row.price,
    offense: row.offense,
    defense: row.defense,
    updatedAt: row.updated_at,
  }
}

export async function listCatalogPlayers(): Promise<CatalogPlayer[]> {
  const { data, error } = await supabase.from('player_catalog').select('*').order('name')
  if (error) throw error
  return (data as CatalogRow[]).map(fromRow)
}

export async function applyCatalogImport(rows: CatalogImportRow[]): Promise<void> {
  const { error } = await supabase.rpc('apply_catalog_import', { rows })
  if (error) throw error
}
