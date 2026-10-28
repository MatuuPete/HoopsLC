import type { Player } from './types'

/** How many of a team's highest-priced catalog players count as its stars. */
export const BIG3_STAR_COUNT = 5

/** Stars from one team that must share a lineup to form a Big 3. */
export const BIG3_SIZE = 3

/** Each Big 3 player gets this share of their base offense and defense on top. */
export const BIG3_BONUS_RATE = 0.25

/** The most Big 3s a lineup may count: 0 turns the bonus off. */
export const MAX_BIG3_COUNT = 2

export interface Big3Bonus {
  offense: number
  defense: number
}

/** A Big 3 player's bonus and the team it comes from. */
export interface Big3Tag extends Big3Bonus {
  team: string
}

/** One Big 3 a lineup fields: the team and the three players getting the bonus. */
export interface Big3 {
  team: string
  playerIds: string[]
}

/**
 * catalogPlayerId → team for every team's BIG3_STAR_COUNT highest-priced
 * catalog players. Computed from the whole catalog, not just owned players,
 * so who is a star never depends on a user's roster. A tie for the last spot
 * goes to the name that sorts first. Players without a team are never stars.
 */
export function big3Stars(
  catalog: { id: string; name: string; price: number; team: string | null }[],
): Map<string, string> {
  const byTeam = new Map<string, typeof catalog>()
  for (const entry of catalog) {
    if (!entry.team) continue
    const group = byTeam.get(entry.team)
    if (group) group.push(entry)
    else byTeam.set(entry.team, [entry])
  }

  const stars = new Map<string, string>()
  for (const [team, group] of byTeam) {
    const top = [...group]
      .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
      .slice(0, BIG3_STAR_COUNT)
    for (const entry of top) stars.set(entry.id, team)
  }
  return stars
}

/** The Big 3 bonus on a player's base (catalog) ratings, e.g. 249/119 → +62/+30. */
export function big3Bonus(player: Pick<Player, 'offense' | 'defense'>): Big3Bonus {
  return {
    offense: Math.round(player.offense * BIG3_BONUS_RATE),
    defense: Math.round(player.defense * BIG3_BONUS_RATE),
  }
}

/** Every player id getting a Big 3 bonus in `big3s`, mapped to that bonus and its team. */
export function big3BonusMap(big3s: Big3[], players: Player[]): Map<string, Big3Tag> {
  const bonuses = new Map<string, Big3Tag>()
  for (const big3 of big3s) {
    for (const id of big3.playerIds) {
      const player = players.find((p) => p.id === id)
      if (player) bonuses.set(id, { ...big3Bonus(player), team: big3.team })
    }
  }
  return bonuses
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]]
  const results: T[][] = []
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), size - 1)) results.push([item, ...rest])
  })
  return results
}

/**
 * Every set of Big 3s worth trying for a lineup: each trio of same-team stars
 * among `players`, and with maxCount 2 every pair of trios from different
 * teams. The empty set (no Big 3) is always first.
 */
export function candidateBig3Sets(
  players: Player[],
  stars: Map<string, string>,
  maxCount: number,
): Big3[][] {
  const byTeam = new Map<string, Player[]>()
  for (const player of players) {
    const team = player.catalogPlayerId ? stars.get(player.catalogPlayerId) : undefined
    if (!team) continue
    const group = byTeam.get(team)
    if (group) group.push(player)
    else byTeam.set(team, [player])
  }

  const trios: Big3[] = []
  for (const [team, group] of byTeam) {
    if (group.length < BIG3_SIZE) continue
    for (const trio of combinations(group, BIG3_SIZE)) trios.push({ team, playerIds: trio.map((p) => p.id) })
  }

  const sets: Big3[][] = [[]]
  if (maxCount >= 1) for (const trio of trios) sets.push([trio])
  if (maxCount >= 2) {
    trios.forEach((a, i) => {
      for (const b of trios.slice(i + 1)) if (a.team !== b.team) sets.push([a, b])
    })
  }
  return sets
}
