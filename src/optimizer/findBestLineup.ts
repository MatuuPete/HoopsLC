import {
  POSITIONS,
  type LineupPreferences,
  type LineupResult,
  type LineupSlot,
  type Player,
  type Position,
} from './types'
import { effectiveDefense, effectiveOffense } from './awards'

const CENTS = 100
const STAT_SCALE = 1000

function toCents(amount: number): number {
  return Math.round(amount * CENTS)
}

function computeValue(player: Player, preferences: LineupPreferences): number {
  if (preferences.objectiveMode === 'power') {
    return STAT_SCALE * (effectiveOffense(player) + effectiveDefense(player))
  }
  const offenseScale = Math.round(preferences.offenseWeight * STAT_SCALE)
  const defenseScale = STAT_SCALE - offenseScale
  return offenseScale * effectiveOffense(player) + defenseScale * effectiveDefense(player)
}

function slotBit(position: Position): number {
  return 1 << POSITIONS.indexOf(position)
}

const FULL_MASK = (1 << POSITIONS.length) - 1

interface Cell {
  costCents: number
  value: number
  player: Player | null
  /** The starting slot the player fills, or 'bench'. */
  slot: Position | 'bench' | null
  source: Cell | null
}

/** Sorted by costCents ascending, with value strictly increasing — no point is dominated by a cheaper-or-equal one. */
type Frontier = Cell[]

const BASE_CELL: Cell = { costCents: 0, value: 0, player: null, slot: null, source: null }

/**
 * Merges new candidate points into an existing frontier, dropping anything
 * dominated. Both inputs are sorted by cost (candidates are a frontier
 * shifted by one player's cost and value), so this is a linear merge.
 */
function mergeFrontier(existing: Frontier, candidates: Cell[]): Frontier {
  if (existing.length === 0) return candidates
  const merged: Frontier = []
  let bestValue = -Infinity
  let i = 0
  let j = 0
  while (i < existing.length || j < candidates.length) {
    const a = existing[i]
    const b = candidates[j]
    const takeExisting =
      b === undefined || (a !== undefined && (a.costCents < b.costCents || (a.costCents === b.costCents && a.value >= b.value)))
    const cell = takeExisting ? a : b
    if (takeExisting) i++
    else j++
    if (cell.value > bestValue) {
      merged.push(cell)
      bestValue = cell.value
    }
  }
  return merged
}

/**
 * How a player's value is scored. A starter's value is multiplied by
 * `starterScale`, which is larger than any bench's total value, so the
 * starting five always ranks first and the bench only breaks ties between
 * equally strong fives. With no bench the scale is 1, leaving values as-is.
 */
interface Scoring {
  preferences: LineupPreferences
  benchSize: number
  starterScale: number
}

function makeScoring(players: Player[], preferences: LineupPreferences): Scoring {
  const benchSize = preferences.benchSize ?? 0
  if (benchSize === 0) return { preferences, benchSize, starterScale: 1 }
  const maxValue = players.reduce((max, p) => Math.max(max, computeValue(p, preferences)), 0)
  return { preferences, benchSize, starterScale: benchSize * maxValue + 1 }
}

function starterValue(player: Player, scoring: Scoring): number {
  return computeValue(player, scoring.preferences) * scoring.starterScale
}

function popcount(mask: number): number {
  let count = 0
  for (let m = mask; m; m >>= 1) count += m & 1
  return count
}

/** `frontier` with `player` added to every point, stopping at the first point over `maxCostCents`. */
function extend(
  frontier: Frontier,
  player: Player,
  slot: Position | 'bench',
  costCents: number,
  value: number,
  maxCostCents: number,
): Cell[] {
  const cells: Cell[] = []
  for (const point of frontier) {
    const total = point.costCents + costCents
    if (total > maxCostCents) break
    cells.push({ costCents: total, value: point.value + value, player, slot, source: point })
  }
  return cells
}

/**
 * dp[mask][hasX][bench] = the Pareto frontier reachable using `players`,
 * where `bench` counts bench spots filled. It starts from `seed` instead
 * of always starting empty — this is how required starters and preferred
 * bench players get folded in: their slots/cost/value are baked into the
 * seed before this DP runs, over the remaining players only. See
 * findBestLineup for how the seed and player list are built per
 * required-player assignment.
 *
 * Each player either sits out, fills one open starting slot, or (regular
 * players only) takes a bench spot. Moves read from a snapshot taken before
 * the player, so no player is used twice.
 *
 * Points that can't finish under `maxCostCents` are dropped as they appear.
 * Pass Infinity to keep them, which is only needed to find the cheapest
 * lineup when nothing fits.
 */
function runAssignmentDp(
  players: Player[],
  scoring: Scoring,
  seed: { mask: number; hasX: number; bench: number; cell: Cell },
  maxCostCents: number,
): Frontier[][][] {
  const { benchSize } = scoring
  const dp: Frontier[][][] = []
  for (let mask = 0; mask <= FULL_MASK; mask++) {
    dp[mask] = [0, 1].map(() => Array.from({ length: benchSize + 1 }, () => []))
  }
  dp[seed.mask][seed.hasX][seed.bench] = [seed.cell]

  // cheapestSum[k] = the cheapest k salaries in the pool, a lower bound on
  // what k still-open spots will cost. A point that can't fill its open
  // spots under the cap even at that price is dropped.
  const costs = players.map((p) => toCents(p.baseSalary)).sort((a, b) => a - b)
  const cheapestSum = [0]
  for (const cost of costs) cheapestSum.push(cheapestSum[cheapestSum.length - 1] + cost)
  function limitFor(mask: number, bench: number): number {
    const open = POSITIONS.length - popcount(mask) + benchSize - bench
    return maxCostCents - (cheapestSum[open] ?? Infinity)
  }

  for (const player of players) {
    const cost = toCents(player.baseSalary)
    const asStarter = starterValue(player, scoring)
    const asBench = computeValue(player, scoring.preferences)
    const bits = player.positions.map((p) => ({ position: p, bit: slotBit(p) }))
    const before = dp.map((byHasX) => byHasX.map((byBench) => [...byBench]))

    for (let mask = 0; mask <= FULL_MASK; mask++) {
      for (const hasX of [0, 1]) {
        // A second X Player can neither start nor sit on the bench.
        if (player.isXPlayer && hasX === 1) continue

        for (let bench = 0; bench <= benchSize; bench++) {
          const sourceFrontier = before[mask][hasX][bench]
          if (sourceFrontier.length === 0) continue

          for (const { position, bit } of bits) {
            if (mask & bit) continue
            const destMask = mask | bit
            const destHasX = player.isXPlayer ? 1 : hasX
            const candidates = extend(sourceFrontier, player, position, cost, asStarter, limitFor(destMask, bench))
            if (candidates.length === 0) continue
            dp[destMask][destHasX][bench] = mergeFrontier(dp[destMask][destHasX][bench], candidates)
          }

          if (!player.isXPlayer && bench < benchSize) {
            const candidates = extend(sourceFrontier, player, 'bench', cost, asBench, limitFor(mask, bench + 1))
            if (candidates.length === 0) continue
            dp[mask][hasX][bench + 1] = mergeFrontier(dp[mask][hasX][bench + 1], candidates)
          }
        }
      }
    }
  }

  return dp
}

function reconstruct(cell: Cell): { slots: LineupSlot[]; bench: Player[] } {
  const slots: LineupSlot[] = []
  const bench: Player[] = []
  for (let c: Cell | null = cell; c && c.source; c = c.source) {
    if (c.slot === 'bench') bench.unshift(c.player as Player)
    else slots.unshift({ position: c.slot as Position, player: c.player as Player })
  }
  return { slots, bench }
}

/** Best (highest-value) point in the frontier at cost <= capCents, or null if none fits. */
function bestUnderCap(frontier: Frontier, capCents: number): Cell | null {
  let best: Cell | null = null
  for (const cell of frontier) {
    if (cell.costCents > capCents) break
    best = cell
  }
  return best
}

function totalCurrentSalary(slots: LineupSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.player.currentSalary, 0)
}

/** Every way to assign `requiredPlayers` to distinct slots they're each eligible for. */
function enumerateRequiredAssignments(requiredPlayers: Player[]): LineupSlot[][] {
  const results: LineupSlot[][] = []

  function backtrack(index: number, usedMask: number, current: LineupSlot[]) {
    if (index === requiredPlayers.length) {
      results.push([...current])
      return
    }
    const player = requiredPlayers[index]
    for (const position of player.positions) {
      const bit = slotBit(position)
      if (usedMask & bit) continue
      current.push({ position, player })
      backtrack(index + 1, usedMask | bit, current)
      current.pop()
    }
  }

  backtrack(0, 0, [])
  return results
}

/** The starting point for the DP: required starters in their slots, then preferred bench players. */
function buildSeed(
  assignment: LineupSlot[],
  benchPlayers: Player[],
  scoring: Scoring,
): { mask: number; hasX: number; bench: number; cell: Cell } {
  let mask = 0
  let hasX = 0
  let cell: Cell = BASE_CELL
  for (const slot of assignment) {
    mask |= slotBit(slot.position)
    if (slot.player.isXPlayer) hasX = 1
    cell = {
      costCents: cell.costCents + toCents(slot.player.baseSalary),
      value: cell.value + starterValue(slot.player, scoring),
      player: slot.player,
      slot: slot.position,
      source: cell,
    }
  }
  for (const player of benchPlayers) {
    cell = {
      costCents: cell.costCents + toCents(player.baseSalary),
      value: cell.value + computeValue(player, scoring.preferences),
      player,
      slot: 'bench',
      source: cell,
    }
  }
  return { mask, hasX, bench: benchPlayers.length, cell }
}

/**
 * A user can own several copies of the same catalog player, but a lineup
 * may field each real player only once. Copies are value-equivalent —
 * currentSalary/offense/defense are all catalog-driven — and differ only
 * in baseSalary, so the cheapest copy dominates the rest. Keep exactly one
 * copy per catalogPlayerId: the preferred copy if exactly one is preferred,
 * otherwise the cheapest (tie-broken by id). Two preferred copies of the
 * same player is an impossible lineup. Players with no catalog link
 * (X Players, unlinked rows) are always kept as-is.
 */
function dedupeCatalogCopies(
  players: Player[],
  requiredPlayerIds: string[],
): { ok: true; players: Player[] } | { ok: false; conflictingPlayerIds: string[] } {
  const groups = new Map<string, Player[]>()
  const kept: Player[] = []
  for (const player of players) {
    if (player.catalogPlayerId === null) {
      kept.push(player)
      continue
    }
    const group = groups.get(player.catalogPlayerId)
    if (group) group.push(player)
    else groups.set(player.catalogPlayerId, [player])
  }

  for (const group of groups.values()) {
    const preferred = group.filter((p) => requiredPlayerIds.includes(p.id))
    if (preferred.length > 1) {
      return { ok: false, conflictingPlayerIds: preferred.map((p) => p.id) }
    }
    if (preferred.length === 1) {
      kept.push(preferred[0])
      continue
    }
    kept.push(
      [...group].sort((a, b) => a.baseSalary - b.baseSalary || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0],
    )
  }

  return { ok: true, players: kept }
}

export function findBestLineup(
  allPlayers: Player[],
  salaryCap: number,
  preferences: LineupPreferences,
): LineupResult {
  const available = allPlayers.filter((p) => !preferences.unavailablePlayerIds.includes(p.id))
  const preferredBenchIds = (preferences.benchSize ?? 0) > 0 ? (preferences.preferredBenchPlayerIds ?? []) : []

  const preferredForBoth = available
    .filter((p) => preferences.requiredPlayerIds.includes(p.id) && preferredBenchIds.includes(p.id))
    .map((p) => p.id)
  if (preferredForBoth.length > 0) {
    return { success: false, reason: 'required_players_conflict', conflictingPlayerIds: preferredForBoth }
  }

  const deduped = dedupeCatalogCopies(available, [...preferences.requiredPlayerIds, ...preferredBenchIds])
  if (!deduped.ok) {
    return {
      success: false,
      reason: 'required_players_conflict',
      conflictingPlayerIds: deduped.conflictingPlayerIds,
    }
  }
  const players = deduped.players

  const benchPlayers = players.filter((p) => preferredBenchIds.includes(p.id) && !p.isXPlayer)
  if (benchPlayers.length > (preferences.benchSize ?? 0)) {
    return {
      success: false,
      reason: 'bench_preferred_overflow',
      preferredCount: benchPlayers.length,
      benchSize: preferences.benchSize ?? 0,
    }
  }
  // Preferred bench players can't start, so they don't count toward filling positions.
  const starterPool = players.filter((p) => !benchPlayers.includes(p))

  const missingPositions = POSITIONS.filter(
    (position) => !starterPool.some((player) => player.positions.includes(position)),
  )
  if (missingPositions.length > 0) {
    return { success: false, reason: 'missing_position', missingPositions }
  }

  const requiredPlayers = players.filter((p) => preferences.requiredPlayerIds.includes(p.id))
  const assignments =
    requiredPlayers.length > 0 && requiredPlayers.length <= POSITIONS.length
      ? enumerateRequiredAssignments(requiredPlayers)
      : []

  if (requiredPlayers.length > 0 && assignments.length === 0) {
    return {
      success: false,
      reason: 'required_players_conflict',
      conflictingPlayerIds: requiredPlayers.map((p) => p.id),
    }
  }

  const seedAssignments = assignments.length > 0 ? assignments : [[] as LineupSlot[]]
  const capCents = toCents(salaryCap)
  const scoring = makeScoring(players, preferences)
  const { benchSize } = scoring

  /** Final-state frontiers for one required-player assignment: a full five with each bench size. */
  function fullFivesFor(assignment: LineupSlot[], maxCostCents: number): Frontier[] {
    const seed = buildSeed(assignment, benchPlayers, scoring)
    const usedIds = new Set([...assignment.map((s) => s.player.id), ...benchPlayers.map((p) => p.id)])
    const remainingPlayers = players.filter((p) => !usedIds.has(p.id))
    const sortedPlayers = [...remainingPlayers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return runAssignmentDp(sortedPlayers, scoring, seed, maxCostCents)[FULL_MASK][1]
  }

  let bestFeasible: Cell | null = null

  for (const assignment of seedAssignments) {
    const feasibleCell = bestUnderCap(fullFivesFor(assignment, capCents)[benchSize], capCents)
    if (
      feasibleCell &&
      (!bestFeasible ||
        feasibleCell.value > bestFeasible.value ||
        (feasibleCell.value === bestFeasible.value && feasibleCell.costCents < bestFeasible.costCents))
    ) {
      bestFeasible = feasibleCell
    }
  }

  if (!bestFeasible) {
    // Nothing fits, so explain why using the first assignment, this time
    // keeping over-cap points so the cheapest lineup can be shown.
    const fullFives = fullFivesFor(seedAssignments[0], Infinity)
    const targetFrontier = fullFives[benchSize]

    // The largest bench a full five can be fielded with (-1: no full five at all).
    const maxBenchSize = fullFives.map((frontier) => frontier.length > 0).lastIndexOf(true)
    if (targetFrontier.length === 0 && maxBenchSize >= 0) {
      return { success: false, reason: 'bench_too_small', requestedBenchSize: benchSize, maxBenchSize }
    }

    if (targetFrontier.length === 0) {
      const positionsWithoutXPlayer = POSITIONS.filter(
        (p) => !starterPool.some((player) => player.isXPlayer && player.positions.includes(p)),
      )
      const positionsWithoutRegularPlayer = POSITIONS.filter(
        (p) => !starterPool.some((player) => !player.isXPlayer && player.positions.includes(p)),
      )
      return {
        success: false,
        reason: 'no_valid_x_slot',
        positionsWithoutXPlayer,
        positionsWithoutRegularPlayer,
      }
    }

    const cheapest = targetFrontier[0]
    const closest = reconstruct(cheapest)
    return {
      success: false,
      reason: 'cap_too_low',
      cheapestPossibleBaseSalary: cheapest.costCents / CENTS,
      closestLineup: closest.slots,
      closestBench: closest.bench,
      closestTotalCurrentSalary: totalCurrentSalary(closest.slots),
    }
  }

  const { slots, bench } = reconstruct(bestFeasible)
  return {
    success: true,
    slots,
    bench,
    totalBaseSalary: bestFeasible.costCents / CENTS,
    totalCurrentSalary: totalCurrentSalary(slots),
    remainingCap: salaryCap - bestFeasible.costCents / CENTS,
  }
}
