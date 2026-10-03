import { effectiveDefense, effectiveOffense } from '../optimizer/awards'
import { POSITIONS, type Player } from '../optimizer/types'

export type SortKey =
  | 'power'
  | 'offense'
  | 'defense'
  | 'value'
  | 'salary'
  | 'market'
  | 'gain'
  | 'tier'
  | 'position'
  | 'name'

export type SortDir = 'asc' | 'desc'

export interface PlayerSort {
  key: SortKey
  dir: SortDir
}

export type SortGroup = 'Strength' | 'Salary' | 'Roster'

interface SortOption {
  label: string
  /** Column-style label shown next to a player's sorted value. */
  short: string
  group: SortGroup
  /** The direction a key starts in when picked: strongest, priciest or A first. */
  defaultDir: SortDir
  /** What each direction means in words, for the direction button. */
  dirLabel: Record<SortDir, string>
}

const HIGH_LOW: Record<SortDir, string> = { desc: 'High to low', asc: 'Low to high' }

export const SORT_OPTIONS: Record<SortKey, SortOption> = {
  power: { label: 'Power', short: 'PWR', group: 'Strength', defaultDir: 'desc', dirLabel: HIGH_LOW },
  offense: { label: 'Offense', short: 'OFF', group: 'Strength', defaultDir: 'desc', dirLabel: HIGH_LOW },
  defense: { label: 'Defense', short: 'DEF', group: 'Strength', defaultDir: 'desc', dirLabel: HIGH_LOW },
  value: { label: 'Power per 100 salary', short: 'VAL', group: 'Salary', defaultDir: 'desc', dirLabel: HIGH_LOW },
  salary: { label: 'Your salary', short: 'SAL', group: 'Salary', defaultDir: 'desc', dirLabel: HIGH_LOW },
  market: { label: 'Market price', short: 'MKT', group: 'Salary', defaultDir: 'desc', dirLabel: HIGH_LOW },
  gain: { label: 'Price change', short: 'CHG', group: 'Salary', defaultDir: 'desc', dirLabel: HIGH_LOW },
  tier: {
    label: 'X tier',
    short: 'TIER',
    group: 'Roster',
    defaultDir: 'desc',
    dirLabel: { desc: 'Legend X first', asc: 'Regular first' },
  },
  position: {
    label: 'Position',
    short: 'POS',
    group: 'Roster',
    defaultDir: 'asc',
    dirLabel: { asc: 'PG to C', desc: 'C to PG' },
  },
  name: { label: 'Name', short: 'NAME', group: 'Roster', defaultDir: 'asc', dirLabel: { asc: 'A to Z', desc: 'Z to A' } },
}

export const SORT_GROUPS: SortGroup[] = ['Strength', 'Salary', 'Roster']

export const DEFAULT_SORT: PlayerSort = { key: 'power', dir: 'desc' }

export function power(player: Player): number {
  return effectiveOffense(player) + effectiveDefense(player)
}

/** Power bought per 100 salary; a free player is worth the most. */
export function value(player: Player): number {
  return player.baseSalary > 0 ? (power(player) / player.baseSalary) * 100 : Infinity
}

const TIER_RANK = { legend: 2, standard: 1 } as const

/** The number a player is sorted by for `key`; name sorts by text instead. */
export function sortValue(player: Player, key: Exclude<SortKey, 'name'>): number {
  switch (key) {
    case 'power':
      return power(player)
    case 'offense':
      return effectiveOffense(player)
    case 'defense':
      return effectiveDefense(player)
    case 'value':
      return value(player)
    case 'salary':
      return player.baseSalary
    case 'market':
      return player.currentSalary
    case 'gain':
      return player.currentSalary - player.baseSalary
    case 'tier':
      return player.xTier ? TIER_RANK[player.xTier] : 0
    case 'position':
      return Math.min(...player.positions.map((p) => POSITIONS.indexOf(p)))
  }
}

/** The sorted value as shown next to a player, e.g. "412", "18.4" or "+120". */
export function formatSortValue(player: Player, key: Exclude<SortKey, 'name'>): string {
  const n = sortValue(player, key)
  if (key === 'value') return Number.isFinite(n) ? n.toFixed(1) : '∞'
  if (key === 'gain') return n > 0 ? `+${n}` : String(n)
  return String(n)
}

function byName(a: Player, b: Player): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

/**
 * A sorted copy of `players`. Ties fall back to power (strongest first),
 * then name, so the order is stable whatever the key.
 */
export function sortPlayers(players: Player[], sort: PlayerSort): Player[] {
  const sign = sort.dir === 'asc' ? 1 : -1
  const key = sort.key
  return [...players].sort((a, b) => {
    const primary = key === 'name' ? byName(a, b) : sortValue(a, key) - sortValue(b, key)
    if (primary !== 0 && !Number.isNaN(primary)) return sign * primary
    return power(b) - power(a) || byName(a, b)
  })
}
