import { POSITIONS, type Player, type LineupResult, type LineupSlot, type Position } from './types'

const CENTS = 100

function toCents(amount: number): number {
  return Math.round(amount * CENTS)
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

  // Sort each group by id ascending so ties resolve to the stable, lowest-id candidate.
  for (const position of POSITIONS) {
    groups[position].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }

  const closestLineup: LineupSlot[] = POSITIONS.map((position) => {
    let cheapest = groups[position][0]
    for (const player of groups[position]) {
      if (toCents(player.baseSalary) < toCents(cheapest.baseSalary)) cheapest = player
    }
    return { position, player: cheapest }
  })
  const cheapestPossibleCents = closestLineup.reduce(
    (sum, slot) => sum + toCents(slot.player.baseSalary),
    0
  )
  const capCents = toCents(salaryCap)

  if (cheapestPossibleCents > capCents) {
    const closestTotalCurrentSalary = closestLineup.reduce(
      (sum, slot) => sum + slot.player.currentSalary,
      0
    )
    return {
      success: false,
      reason: 'cap_too_low',
      cheapestPossibleBaseSalary: cheapestPossibleCents / CENTS,
      closestLineup,
      closestTotalCurrentSalary,
    }
  }

  // dp[c] = best { valueCents, costCents } achievable with total cost <= c using groups processed so far.
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

  const totalCurrentSalary = finalCell.valueCents / CENTS
  const totalBaseSalary = finalCell.costCents / CENTS

  return {
    success: true,
    slots,
    totalBaseSalary,
    totalCurrentSalary,
    remainingCap: salaryCap - totalBaseSalary,
  }
}
