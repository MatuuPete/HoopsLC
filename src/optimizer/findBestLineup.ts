import { POSITIONS, type Player, type LineupResult, type LineupSlot, type Position } from './types'

const CENTS = 100

function toCents(amount: number): number {
  return Math.round(amount * CENTS)
}

function slotBit(position: Position): number {
  return 1 << POSITIONS.indexOf(position)
}

const FULL_MASK = (1 << POSITIONS.length) - 1

interface Cell {
  costCents: number
  valueCents: number
  player: Player | null
  slot: Position | null
  source: Cell | null
}

/** Sorted by costCents ascending, with valueCents strictly increasing — no point is dominated by a cheaper-or-equal one. */
type Frontier = Cell[]

const BASE_CELL: Cell = { costCents: 0, valueCents: 0, player: null, slot: null, source: null }

/** Merges new candidate points into an existing frontier, dropping anything dominated. */
function mergeFrontier(existing: Frontier, candidates: Cell[]): Frontier {
  const all = [...existing, ...candidates].sort(
    (a, b) => a.costCents - b.costCents || b.valueCents - a.valueCents,
  )
  const merged: Frontier = []
  let bestValue = -1
  for (const cell of all) {
    if (cell.valueCents > bestValue) {
      merged.push(cell)
      bestValue = cell.valueCents
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
 * dp[mask][hasX] = the Pareto frontier (cost -> best value, cost ascending,
 * value strictly increasing) reachable using players considered so far,
 * filling exactly the slots in `mask` (one player each), tracking whether
 * one of them is an X Player.
 *
 * Unlike a budget-indexed array, this frontier's size depends on how many
 * distinct non-dominated (cost, value) combinations exist among the
 * players actually owned — not on the cap's magnitude — so this stays
 * fast regardless of how large a salary cap gets entered.
 *
 * Mutated in place, one player at a time. Within a single player's pass,
 * destination masks are processed in decreasing popcount order so that a
 * player's own transitions always read state from before this player was
 * considered — otherwise the same player could end up placed into two
 * slots in one pass.
 */
function runAssignmentDp(players: Player[]): Frontier[][] {
  const masksByPopcount: number[][] = Array.from({ length: POSITIONS.length + 1 }, () => [])
  for (let mask = 0; mask <= FULL_MASK; mask++) {
    masksByPopcount[popcount(mask)].push(mask)
  }

  const dp: Frontier[][] = []
  for (let mask = 0; mask <= FULL_MASK; mask++) {
    dp[mask] = [[], []]
  }
  dp[0][0] = [BASE_CELL]

  for (const player of players) {
    const cost = toCents(player.baseSalary)
    const value = toCents(player.currentSalary)
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
              valueCents: point.valueCents + value,
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

export function findBestLineup(players: Player[], salaryCap: number): LineupResult {
  const missingPositions = POSITIONS.filter(
    (position) => !players.some((player) => player.positions.includes(position)),
  )
  if (missingPositions.length > 0) {
    return { success: false, reason: 'missing_position', missingPositions }
  }

  const capCents = toCents(salaryCap)
  const sortedPlayers = [...players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const dp = runAssignmentDp(sortedPlayers)
  const targetFrontier = dp[FULL_MASK][1]

  const feasibleCell = bestUnderCap(targetFrontier, capCents)
  if (feasibleCell) {
    return {
      success: true,
      slots: reconstruct(feasibleCell),
      totalBaseSalary: feasibleCell.costCents / CENTS,
      totalCurrentSalary: feasibleCell.valueCents / CENTS,
      remainingCap: salaryCap - feasibleCell.costCents / CENTS,
    }
  }

  if (targetFrontier.length === 0) {
    const positionsWithoutXPlayer = POSITIONS.filter(
      (p) => !players.some((player) => player.isXPlayer && player.positions.includes(p)),
    )
    const positionsWithoutRegularPlayer = POSITIONS.filter(
      (p) => !players.some((player) => !player.isXPlayer && player.positions.includes(p)),
    )
    return {
      success: false,
      reason: 'no_valid_x_slot',
      positionsWithoutXPlayer,
      positionsWithoutRegularPlayer,
    }
  }

  // Not empty and nothing fit under the cap: the cheapest point is the frontier's first
  // entry (sorted ascending by cost).
  const cheapest = targetFrontier[0]
  return {
    success: false,
    reason: 'cap_too_low',
    cheapestPossibleBaseSalary: cheapest.costCents / CENTS,
    closestLineup: reconstruct(cheapest),
    closestTotalCurrentSalary: cheapest.valueCents / CENTS,
  }
}
