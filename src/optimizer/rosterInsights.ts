import type { Player, Position } from './types'
import { POSITIONS } from './types'

export interface CoverageEntry {
  position: Position
  count: number
}

/** How many owned players are eligible at each of the five positions. */
export function positionalCoverage(players: Player[]): CoverageEntry[] {
  return POSITIONS.map((position) => ({
    position,
    count: players.filter((p) => p.positions.includes(position)).length,
  }))
}

export interface ValueEntry {
  player: Player
  value: number
}

/**
 * Players ranked by power (offense + defense) per current-salary dollar, best
 * value first. X players are excluded: their salary is fixed at 999, so the
 * ratio is meaninglessly large and would always top the list.
 */
export function valueRanking(players: Player[]): ValueEntry[] {
  return players
    .filter((p) => !p.isXPlayer && p.currentSalary > 0)
    .map((p) => ({ player: p, value: (p.offense + p.defense) / p.currentSalary }))
    .sort((a, b) => b.value - a.value)
}

export interface MoverEntry {
  player: Player
  delta: number
}

/**
 * Players whose salary has changed since acquisition, ranked by the size of the
 * swing (largest first). delta = currentSalary - baseSalary.
 */
export function salaryMovers(players: Player[]): MoverEntry[] {
  return players
    .map((p) => ({ player: p, delta: p.currentSalary - p.baseSalary }))
    .filter((m) => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

export interface ValueRank {
  rank: number
  total: number
  value: number
}

/** Where one player sits in {@link valueRanking}, or null if not ranked. */
export function playerValueRank(players: Player[], id: string): ValueRank | null {
  const ranking = valueRanking(players)
  const index = ranking.findIndex((entry) => entry.player.id === id)
  if (index === -1) return null
  return { rank: index + 1, total: ranking.length, value: ranking[index].value }
}
