import type { Player } from './types'

export interface Award {
  award: string
  /** Badge label, e.g. "MVP". */
  short: string
  offense: number
  defense: number
}

/**
 * Season awards and the stat bonus each one grants. Bonuses stack on top of
 * a player's catalog offense/defense everywhere stats are totalled, and in
 * both lineup optimization modes. Keyed by lower-cased player name so catalog
 * and hand-entered players both match; update this table when the awards
 * change.
 */
const AWARDS: Record<string, Award> = {
  'shai gilgeous-alexander': { award: 'MVP', short: 'MVP', offense: 10, defense: 5 },
  'karl-anthony towns': { award: 'NBA Champion', short: 'CHAMP', offense: 5, defense: 5 },
  'jalen brunson': { award: 'NBA Champion', short: 'CHAMP', offense: 10, defense: 5 },
  'victor wembanyama': { award: 'Defensive Player of the Year', short: 'DPOY', offense: 0, defense: 10 },
  'og anunoby': { award: 'NBA Champion', short: 'CHAMP', offense: 5, defense: 5 },
  'keldon johnson': { award: 'Sixth Man of the Year', short: '6MOY', offense: 5, defense: 5 },
  'cooper flagg': { award: 'Rookie of the Year', short: 'ROY', offense: 5, defense: 5 },
  'nickeil alexander-walker': { award: 'Most Improved Player', short: 'MIP', offense: 5, defense: 5 },
}

export function awardFor(name: string): Award | null {
  return AWARDS[name.trim().toLowerCase()] ?? null
}

/** Offense including any award bonus. */
export function effectiveOffense(player: Pick<Player, 'name' | 'offense'>): number {
  return player.offense + (awardFor(player.name)?.offense ?? 0)
}

/** Defense including any award bonus. */
export function effectiveDefense(player: Pick<Player, 'name' | 'defense'>): number {
  return player.defense + (awardFor(player.name)?.defense ?? 0)
}
