import { POSITIONS, type Player, type LineupResult, type LineupSlot, type Position } from './types'

const CENTS = 100

function toCents(amount: number): number {
  return Math.round(amount * CENTS)
}

type KnapsackResult =
  | { feasible: true; slots: LineupSlot[]; totalCurrentSalary: number; totalBaseSalary: number }
  | { feasible: false; cheapestCents: number; cheapestSlots: LineupSlot[]; cheapestCurrentSalary: number }

/** Solves the one-player-per-position knapsack for a fixed set of candidate groups (already non-empty and id-sorted per position). */
function solveKnapsack(groups: Record<Position, Player[]>, capCents: number): KnapsackResult {
  const cheapestSlots: LineupSlot[] = POSITIONS.map((position) => {
    let cheapest = groups[position][0]
    for (const player of groups[position]) {
      if (toCents(player.baseSalary) < toCents(cheapest.baseSalary)) cheapest = player
    }
    return { position, player: cheapest }
  })
  const cheapestCents = cheapestSlots.reduce((sum, slot) => sum + toCents(slot.player.baseSalary), 0)

  if (cheapestCents > capCents) {
    const cheapestCurrentSalary = cheapestSlots.reduce((sum, slot) => sum + slot.player.currentSalary, 0)
    return { feasible: false, cheapestCents, cheapestSlots, cheapestCurrentSalary }
  }

  // dp[c] = best { valueCents, costCents } achievable with total cost <= c using groups processed so far.
  // valueCents === -1 marks a budget that is not achievable yet.
  type Cell = { valueCents: number; costCents: number }
  let dp: Cell[] = new Array(capCents + 1)
  for (let c = 0; c <= capCents; c++) dp[c] = { valueCents: 0, costCents: 0 }

  const choices: Map<number, Player>[] = []

  for (const position of POSITIONS) {
    const nextDp: Cell[] = new Array(capCents + 1)
    const choiceAtBudget = new Map<number, Player>()

    for (let c = 0; c <= capCents; c++) {
      let best: Cell = { valueCents: -1, costCents: 0 }
      let bestPlayer: Player | null = null

      for (const player of groups[position]) {
        const cost = toCents(player.baseSalary)
        if (cost > c) continue
        const prev = dp[c - cost]
        if (prev.valueCents < 0) continue

        const candidateValue = prev.valueCents + toCents(player.currentSalary)
        const candidateCost = prev.costCents + cost

        const better =
          candidateValue > best.valueCents ||
          (candidateValue === best.valueCents && candidateCost < best.costCents)

        if (bestPlayer === null || better) {
          best = { valueCents: candidateValue, costCents: candidateCost }
          bestPlayer = player
        }
      }

      nextDp[c] = bestPlayer ? best : { valueCents: -1, costCents: 0 }
      if (bestPlayer) choiceAtBudget.set(c, bestPlayer)
    }

    dp = nextDp
    choices.push(choiceAtBudget)
  }

  const finalCell = dp[capCents]
  const slots: LineupSlot[] = []
  let budget = capCents

  for (let g = POSITIONS.length - 1; g >= 0; g--) {
    const player = choices[g].get(budget)
    if (!player) {
      throw new Error('Optimizer reconstruction failed: no player recorded for this budget')
    }
    slots.unshift({ position: POSITIONS[g], player })
    budget -= toCents(player.baseSalary)
  }

  return {
    feasible: true,
    slots,
    totalCurrentSalary: finalCell.valueCents / CENTS,
    totalBaseSalary: finalCell.costCents / CENTS,
  }
}

function sortedById(players: Player[]): Player[] {
  return [...players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function findBestLineup(players: Player[], salaryCap: number): LineupResult {
  const groups: Record<Position, Player[]> = { PG: [], SG: [], SF: [], PF: [], C: [] }
  for (const player of players) {
    groups[player.position].push(player)
  }

  const missingPositions = POSITIONS.filter((position) => groups[position].length === 0)
  if (missingPositions.length > 0) {
    return { success: false, reason: 'missing_position', missingPositions }
  }

  const regularGroups: Record<Position, Player[]> = { PG: [], SG: [], SF: [], PF: [], C: [] }
  const xGroups: Record<Position, Player[]> = { PG: [], SG: [], SF: [], PF: [], C: [] }
  for (const position of POSITIONS) {
    regularGroups[position] = sortedById(groups[position].filter((p) => !p.isXPlayer))
    xGroups[position] = sortedById(groups[position].filter((p) => p.isXPlayer))
  }

  const positionsWithoutXPlayer = POSITIONS.filter((p) => xGroups[p].length === 0)
  const positionsWithoutRegularPlayer = POSITIONS.filter((p) => regularGroups[p].length === 0)

  // A position can host the mandatory X slot only if it has an X candidate and every
  // other position has a regular candidate to fall back on.
  const validXPositions = POSITIONS.filter((xPos) => {
    if (xGroups[xPos].length === 0) return false
    return POSITIONS.every((other) => other === xPos || regularGroups[other].length > 0)
  })

  if (validXPositions.length === 0) {
    return {
      success: false,
      reason: 'no_valid_x_slot',
      positionsWithoutXPlayer,
      positionsWithoutRegularPlayer,
    }
  }

  const capCents = toCents(salaryCap)

  let bestFeasible: { xPos: Position; result: Extract<KnapsackResult, { feasible: true }> } | null = null
  let bestInfeasible: { xPos: Position; result: Extract<KnapsackResult, { feasible: false }> } | null = null

  for (const xPos of validXPositions) {
    const groupsForXPos: Record<Position, Player[]> = { PG: [], SG: [], SF: [], PF: [], C: [] }
    for (const position of POSITIONS) {
      groupsForXPos[position] = position === xPos ? xGroups[position] : regularGroups[position]
    }

    const result = solveKnapsack(groupsForXPos, capCents)

    if (result.feasible) {
      if (
        !bestFeasible ||
        result.totalCurrentSalary > bestFeasible.result.totalCurrentSalary ||
        (result.totalCurrentSalary === bestFeasible.result.totalCurrentSalary &&
          result.totalBaseSalary < bestFeasible.result.totalBaseSalary)
      ) {
        bestFeasible = { xPos, result }
      }
    } else if (!bestInfeasible || result.cheapestCents < bestInfeasible.result.cheapestCents) {
      bestInfeasible = { xPos, result }
    }
  }

  if (bestFeasible) {
    const { result } = bestFeasible
    return {
      success: true,
      slots: result.slots,
      totalBaseSalary: result.totalBaseSalary,
      totalCurrentSalary: result.totalCurrentSalary,
      remainingCap: salaryCap - result.totalBaseSalary,
    }
  }

  // bestInfeasible is guaranteed set here: validXPositions is non-empty, so every
  // iteration produced either a feasible or infeasible result, and none were feasible.
  const { result } = bestInfeasible!
  return {
    success: false,
    reason: 'cap_too_low',
    cheapestPossibleBaseSalary: result.cheapestCents / CENTS,
    closestLineup: result.cheapestSlots,
    closestTotalCurrentSalary: result.cheapestCurrentSalary,
  }
}
