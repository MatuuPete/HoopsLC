import {
  POSITIONS,
  type LineupPreferences,
  type LineupResult,
  type LineupSlot,
  type Player,
  type Position,
} from './types'

const CENTS = 100
const STAT_SCALE = 1000

function toCents(amount: number): number {
  return Math.round(amount * CENTS)
}

function computeValue(player: Player, preferences: LineupPreferences): number {
  if (preferences.objectiveMode === 'power') {
    return toCents(player.currentSalary)
  }
  const offenseScale = Math.round(preferences.offenseWeight * STAT_SCALE)
  const defenseScale = STAT_SCALE - offenseScale
  return offenseScale * player.offense + defenseScale * player.defense
}

function slotBit(position: Position): number {
  return 1 << POSITIONS.indexOf(position)
}

const FULL_MASK = (1 << POSITIONS.length) - 1

interface Cell {
  costCents: number
  value: number
  player: Player | null
  slot: Position | null
  source: Cell | null
}

/** Sorted by costCents ascending, with value strictly increasing — no point is dominated by a cheaper-or-equal one. */
type Frontier = Cell[]

const BASE_CELL: Cell = { costCents: 0, value: 0, player: null, slot: null, source: null }

/** Merges new candidate points into an existing frontier, dropping anything dominated. */
function mergeFrontier(existing: Frontier, candidates: Cell[]): Frontier {
  const all = [...existing, ...candidates].sort((a, b) => a.costCents - b.costCents || b.value - a.value)
  const merged: Frontier = []
  let bestValue = -Infinity
  for (const cell of all) {
    if (cell.value > bestValue) {
      merged.push(cell)
      bestValue = cell.value
    }
  }
  return merged
}

function popcount(mask: number): number {
  let count = 0
  let m = mask
  while (m) {
    count += m & 1
    m >>= 1
  }
  return count
}

/**
 * dp[mask][hasX] = the Pareto frontier reachable using `players`, starting
 * from `seedMask`/`seedHasX`/`seedCell` instead of always starting empty —
 * this is how required players get folded in: their slots/cost/value are
 * baked into the seed before this DP runs, over the remaining
 * (non-required) players only. See findBestLineup for how the seed and
 * player list are built per required-player assignment.
 */
function runAssignmentDp(
  players: Player[],
  preferences: LineupPreferences,
  seedMask: number,
  seedHasX: number,
  seedCell: Cell,
): Frontier[][] {
  const masksByPopcount: number[][] = Array.from({ length: POSITIONS.length + 1 }, () => [])
  for (let mask = 0; mask <= FULL_MASK; mask++) {
    masksByPopcount[popcount(mask)].push(mask)
  }

  const dp: Frontier[][] = []
  for (let mask = 0; mask <= FULL_MASK; mask++) {
    dp[mask] = [[], []]
  }
  dp[seedMask][seedHasX] = [seedCell]

  for (const player of players) {
    const cost = toCents(player.baseSalary)
    const value = computeValue(player, preferences)
    const bits = player.positions.map((p) => ({ position: p, bit: slotBit(p) }))

    for (let level = POSITIONS.length; level >= 1; level--) {
      for (const destMask of masksByPopcount[level]) {
        for (const { position, bit } of bits) {
          if ((destMask & bit) === 0) continue
          const sourceMask = destMask & ~bit
          const hasXAfterOptions = player.isXPlayer ? [1] : [0, 1]

          for (const hasXAfter of hasXAfterOptions) {
            const hasXBefore = player.isXPlayer ? 0 : hasXAfter
            const sourceFrontier = dp[sourceMask][hasXBefore]
            if (sourceFrontier.length === 0) continue

            const candidates: Cell[] = sourceFrontier.map((point) => ({
              costCents: point.costCents + cost,
              value: point.value + value,
              player,
              slot: position,
              source: point,
            }))

            dp[destMask][hasXAfter] = mergeFrontier(dp[destMask][hasXAfter], candidates)
          }
        }
      }
    }
  }

  return dp
}

function reconstruct(cell: Cell): LineupSlot[] {
  if (cell.source === null) return []
  const rest = reconstruct(cell.source)
  rest.push({ position: cell.slot as Position, player: cell.player as Player })
  return rest
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

function buildSeed(
  assignment: LineupSlot[],
  preferences: LineupPreferences,
): { mask: number; hasX: number; cell: Cell } {
  let mask = 0
  let hasX = 0
  let cell: Cell = BASE_CELL
  for (const slot of assignment) {
    mask |= slotBit(slot.position)
    if (slot.player.isXPlayer) hasX = 1
    cell = {
      costCents: cell.costCents + toCents(slot.player.baseSalary),
      value: cell.value + computeValue(slot.player, preferences),
      player: slot.player,
      slot: slot.position,
      source: cell,
    }
  }
  return { mask, hasX, cell }
}

export function findBestLineup(
  players: Player[],
  salaryCap: number,
  preferences: LineupPreferences,
): LineupResult {
  const missingPositions = POSITIONS.filter(
    (position) => !players.some((player) => player.positions.includes(position)),
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

  let bestFeasible: Cell | null = null
  let firstFailure: LineupResult | null = null

  for (const assignment of seedAssignments) {
    const { mask, hasX, cell: seedCell } = buildSeed(assignment, preferences)
    const usedIds = new Set(assignment.map((s) => s.player.id))
    const remainingPlayers = players.filter((p) => !usedIds.has(p.id))
    const sortedPlayers = [...remainingPlayers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

    const dp = runAssignmentDp(sortedPlayers, preferences, mask, hasX, seedCell)
    const targetFrontier = dp[FULL_MASK][1]
    const feasibleCell = bestUnderCap(targetFrontier, capCents)

    if (
      feasibleCell &&
      (!bestFeasible ||
        feasibleCell.value > bestFeasible.value ||
        (feasibleCell.value === bestFeasible.value && feasibleCell.costCents < bestFeasible.costCents))
    ) {
      bestFeasible = feasibleCell
    }

    if (!feasibleCell && !firstFailure) {
      if (targetFrontier.length === 0) {
        const positionsWithoutXPlayer = POSITIONS.filter(
          (p) => !players.some((player) => player.isXPlayer && player.positions.includes(p)),
        )
        const positionsWithoutRegularPlayer = POSITIONS.filter(
          (p) => !players.some((player) => !player.isXPlayer && player.positions.includes(p)),
        )
        firstFailure = {
          success: false,
          reason: 'no_valid_x_slot',
          positionsWithoutXPlayer,
          positionsWithoutRegularPlayer,
        }
      } else {
        const cheapest = targetFrontier[0]
        const closestLineup = reconstruct(cheapest)
        firstFailure = {
          success: false,
          reason: 'cap_too_low',
          cheapestPossibleBaseSalary: cheapest.costCents / CENTS,
          closestLineup,
          closestTotalCurrentSalary: totalCurrentSalary(closestLineup),
        }
      }
    }
  }

  if (bestFeasible) {
    const slots = reconstruct(bestFeasible)
    return {
      success: true,
      slots,
      totalBaseSalary: bestFeasible.costCents / CENTS,
      totalCurrentSalary: totalCurrentSalary(slots),
      remainingCap: salaryCap - bestFeasible.costCents / CENTS,
    }
  }

  return firstFailure as LineupResult
}
