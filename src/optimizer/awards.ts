import type { Player } from './types'

export interface Award {
  award: string
  /** Badge label, e.g. "POTW". */
  short: string
  offense: number
  defense: number
}

/** The awards currently given out. */
const AWARD_TYPES = {
  playerOfTheWeek: { award: 'Player of the Week', short: 'POTW' },
  rookieOfTheWeek: { award: 'Rookie of the Week', short: 'ROTW' },
  playerOfTheMonth: { award: 'Player of the Month', short: 'POTM' },
  rookieOfTheMonth: { award: 'Rookie of the Month', short: 'ROTM' },
} as const

/**
 * Current award holders and the stat bonus each one grants. Bonuses stack on
 * top of a player's catalog offense/defense everywhere stats are totalled, and
 * in both lineup optimization modes. Keyed by lower-cased player name so
 * catalog and hand-entered players both match; update this table when the
 * awards change. Awards with no holder yet are simply left out.
 */
const AWARDS: Record<string, Award> = {
  'ty jerome': { ...AWARD_TYPES.playerOfTheWeek, offense: 5, defense: 0 },
  // Rookie of the Week: not awarded yet
  // Player of the Month: not awarded yet
  // Rookie of the Month: not awarded yet
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
