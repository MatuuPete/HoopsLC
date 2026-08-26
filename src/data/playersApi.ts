import { supabase } from '../lib/supabaseClient'
import type { Player } from '../optimizer/types'

interface PlayerRow {
  id: string
  user_id: string
  name: string
  positions: Player['positions']
  is_x_player: boolean
  base_salary: number
  current_salary: number
  offense: number
  defense: number
  catalog_player_id: string | null
}

function fromRow(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    positions: row.positions,
    isXPlayer: row.is_x_player,
    baseSalary: row.base_salary,
    currentSalary: row.current_salary,
    offense: row.offense,
    defense: row.defense,
    catalogPlayerId: row.catalog_player_id,
  }
}

export type NewPlayer = Omit<Player, 'id'>

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await supabase.from('players').select('*').order('name')
  if (error) throw error
  return (data as PlayerRow[]).map(fromRow)
}

export async function createPlayer(player: NewPlayer, userId: string): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert({
      user_id: userId,
      name: player.name,
      positions: player.positions,
      is_x_player: player.isXPlayer,
      base_salary: player.baseSalary,
      current_salary: player.currentSalary,
      offense: player.offense,
      defense: player.defense,
      catalog_player_id: player.catalogPlayerId,
    })
    .select()
    .single()
  if (error) throw error
  return fromRow(data as PlayerRow)
}

export async function updatePlayer(id: string, player: NewPlayer): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .update({
      name: player.name,
      positions: player.positions,
      is_x_player: player.isXPlayer,
      base_salary: player.baseSalary,
      current_salary: player.currentSalary,
      offense: player.offense,
      defense: player.defense,
      catalog_player_id: player.catalogPlayerId,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromRow(data as PlayerRow)
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}
