import {
  POSITIONS,
  type LineupPreferences,
  type LineupResult,
  type LineupSlot,
  type Player,
  type Position,
} from './types'
import { effectiveDefense, effectiveOffense } from './awards'
import {
  SUPER_BIG3_SIZE,
  big3Bonus,
  big3BonusMap,
  candidateBig3Sets,
  superBig3Bonus,
  type Big3,
  type Big3Bonus,
} from './big3'
import { X_NONE, X_STATES, finalXStates, nextXState, xPlayersFit } from './xRule'

const CENTS = 100
const STAT_SCALE = 1000
const NO_BONUS: Big3Bonus = { offense: 0, defense: 0 }

function toCents(amount: number): number {
  return Math.round(amount * CENTS)
}

function computeValue(player: Player, preferences: LineupPreferences, bonus: Big3Bonus = NO_BONUS): number {
  const offense = effectiveOffense(player) + bonus.offense
  const defense = effectiveDefense(player) + bonus.defense
  if (preferences.objectiveMode === 'power') {
    return STAT_SCALE * (offense + defense)
  }
  const offenseScale = Math.round(preferences.offenseWeight * STAT_SCALE)
  const defenseScale = STAT_SCALE - offenseScale
  return offenseScale * offense + defenseScale * defense
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
  /** The player starts with the Super Big 3 bonus the builder chose for them. */
  boosted?: boolean
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
  extraLegendX: boolean
  /** Big 3 bonuses for the run in progress, by player id. */
  bonuses: Map<string, Big3Bonus>
  /**
   * How many starters get a Super Big 3 bonus the builder picks itself: 3
   * when it chooses the Super Big 3, otherwise 0. See runAssignmentDp.
   */
  boostLimit: number
}

function makeScoring(players: Player[], preferences: LineupPreferences): Scoring {
  const benchSize = preferences.benchSize ?? 0
  const extraLegendX = preferences.extraLegendX ?? false
  const locked = preferences.superBig3?.lockedIds ?? []
  // A locked Super Big 3 is boosted like a Big 3; otherwise the DP picks whom to boost.
  const bonuses = new Map(players.filter((p) => locked.includes(p.id)).map((p) => [p.id, superBig3Bonus(p)]))
  const boostLimit = preferences.superBig3 && locked.length === 0 ? SUPER_BIG3_SIZE : 0
  const base = { preferences, benchSize, extraLegendX, bonuses, boostLimit }
  if (benchSize === 0) return { ...base, starterScale: 1 }
  // Sized as if every player had the largest bonus (Team Big 3's 25% tops the
  // Super Big 3's 20%), so the scale holds in every run.
  const anyBonus = !!preferences.big3?.maxCount || !!preferences.superBig3
  const withBonus = (p: Player) => (anyBonus ? big3Bonus(p) : NO_BONUS)
  const maxValue = players.reduce((max, p) => Math.max(max, computeValue(p, preferences, withBonus(p))), 0)
  return { ...base, starterScale: benchSize * maxValue + 1 }
}

function benchValue(player: Player, scoring: Scoring): number {
  return computeValue(player, scoring.preferences, scoring.bonuses.get(player.id))
}

function starterValue(player: Player, scoring: Scoring): number {
  return benchValue(player, scoring) * scoring.starterScale
}

/** A starter's value with the Super Big 3 bonus the DP chose to give them. */
function boostedStarterValue(player: Player, scoring: Scoring): number {
  return computeValue(player, scoring.preferences, superBig3Bonus(player)) * scoring.starterScale
}

function popcount(mask: number): number {
  let count = 0
  for (let m = mask; m; m >>= 1) count += m & 1
  return count
}

/**
 * A ceiling on what still-open spots can add: bound(starters, bench,
 * budgetCents) is at least the value of any `starters` more starters plus
 * `bench` more bench players costing at most budgetCents together (-Infinity
 * if none fit). It ignores positions and the X Player rule and rounds costs
 * down to BOUND_STEP_CENTS, which only loosens it, so a point whose value
 * plus this ceiling falls short of a lineup already found can be dropped.
 */
type ValueBound = (starters: number, bench: number, budgetCents: number) => number

const BOUND_STEP_CENTS = 1000

/** Builds a ValueBound over `players` scored without Big 3 bonuses, by a cardinality knapsack. */
function makeValueBound(players: Player[], scoring: Scoring, capCents: number): ValueBound {
  const steps = Math.floor(capCents / BOUND_STEP_CENTS)
  const width = steps + 1
  const benchSpots = scoring.benchSize + 1
  const row = (starters: number, bench: number) => (starters * benchSpots + bench) * width
  const table = new Float64Array((POSITIONS.length + 1) * benchSpots * width).fill(-Infinity)
  table.fill(0, 0, width)

  for (const player of players) {
    const cost = Math.floor(toCents(player.baseSalary) / BOUND_STEP_CENTS)
    const asStarter = starterValue(player, scoring)
    const asBench = benchValue(player, scoring)
    // Descending order reads only cells this player hasn't touched yet.
    for (let starters = POSITIONS.length; starters >= 0; starters--) {
      for (let bench = scoring.benchSize; bench >= 0; bench--) {
        const to = row(starters, bench)
        const fromStarter = starters > 0 ? row(starters - 1, bench) : -1
        const fromBench = bench > 0 && !player.isXPlayer ? row(starters, bench - 1) : -1
        for (let r = steps; r >= cost; r--) {
          let best = table[to + r]
          if (fromStarter >= 0) best = Math.max(best, table[fromStarter + r - cost] + asStarter)
          if (fromBench >= 0) best = Math.max(best, table[fromBench + r - cost] + asBench)
          table[to + r] = best
        }
      }
    }
  }

  return (starters, bench, budgetCents) =>
    budgetCents < 0 ? -Infinity : table[row(starters, bench) + Math.min(steps, Math.floor(budgetCents / BOUND_STEP_CENTS))]
}

/** A lineup value to beat, and the ceiling that shows which points can't. */
interface Pruning {
  bound: ValueBound
  minValue: number
}

/**
 * `frontier` with `player` added to every point, stopping at the first point
 * over `maxCostCents`. With `ceiling`, a point is skipped when its value plus
 * ceiling(its cost) can't reach `minValue`.
 */
function extend(
  frontier: Frontier,
  player: Player,
  slot: Position | 'bench',
  costCents: number,
  value: number,
  maxCostCents: number,
  ceiling: ((costCents: number) => number) | null = null,
  minValue = -Infinity,
  boosted = false,
): Cell[] {
  const cells: Cell[] = []
  for (const point of frontier) {
    const total = point.costCents + costCents
    if (total > maxCostCents) break
    const next = point.value + value
    if (ceiling && next + ceiling(total) < minValue) continue
    cells.push({ costCents: total, value: next, player, slot, boosted, source: point })
  }
  return cells
}

/**
 * dp[mask][xState][bench] = the Pareto frontier reachable using `players`,
 * where `bench` counts bench spots filled. It starts from `seeds` instead
 * of always starting empty — this is how required starters, preferred
 * bench players and Big 3 players get folded in: their slots/cost/value are
 * baked into each seed before this DP runs, over the remaining players only.
 * See findBestLineup for how the seeds and player list are built per
 * required-player assignment.
 *
 * Each player either sits out, fills one open starting slot, or (regular
 * players only) takes a bench spot. xState (see xRule) tracks the X Players
 * fielded so far, so a lineup never takes more than the limit. Moves read
 * from a snapshot taken before the player, so no player is used twice.
 *
 * With `boosts`, the first `left` starters this DP adds (beyond the seed's
 * `seedStarters`) get the Super Big 3 bonus. The caller orders `players`
 * by what the bonus adds, biggest first, so those are always the starters
 * the bonus helps most: no extra state is needed to choose them.
 *
 * Points that can't finish under `maxCostCents` are dropped as they appear.
 * Pass Infinity to keep them, which is only needed to find the cheapest
 * lineup when nothing fits. With `pruning`, points that can't reach its
 * minValue are dropped too.
 */
function runAssignmentDp(
  players: Player[],
  scoring: Scoring,
  seeds: Seed[],
  maxCostCents: number,
  pruning: Pruning | null = null,
  boosts: { left: number; seedStarters: number } | null = null,
): Frontier[][][] {
  const { benchSize, extraLegendX } = scoring
  const dp: Frontier[][][] = []
  for (let mask = 0; mask <= FULL_MASK; mask++) {
    dp[mask] = X_STATES.map(() => Array.from({ length: benchSize + 1 }, () => []))
  }
  for (const seed of seeds) {
    dp[seed.mask][seed.xState][seed.bench] = mergeFrontier(dp[seed.mask][seed.xState][seed.bench], [seed.cell])
  }

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
  function ceilingFor(mask: number, bench: number): ((costCents: number) => number) | null {
    if (!pruning) return null
    const starters = POSITIONS.length - popcount(mask)
    return (costCents) => pruning.bound(starters, benchSize - bench, maxCostCents - costCents)
  }
  const minValue = pruning?.minValue ?? -Infinity

  for (const player of players) {
    const cost = toCents(player.baseSalary)
    const asStarter = starterValue(player, scoring)
    const asBoosted = boosts ? boostedStarterValue(player, scoring) : 0
    const asBench = benchValue(player, scoring)
    const bits = player.positions.map((p) => ({ position: p, bit: slotBit(p) }))
    const before = dp.map((byXState) => byXState.map((byBench) => [...byBench]))

    for (let mask = 0; mask <= FULL_MASK; mask++) {
      const boosted = !!boosts && popcount(mask) - boosts.seedStarters < boosts.left
      for (const xState of X_STATES) {
        // null: the lineup is out of X Player room, so this player can't start.
        const destXState = nextXState(xState, player, extraLegendX)

        for (let bench = 0; bench <= benchSize; bench++) {
          const sourceFrontier = before[mask][xState][bench]
          if (sourceFrontier.length === 0) continue

          if (destXState !== null) {
            for (const { position, bit } of bits) {
              if (mask & bit) continue
              const destMask = mask | bit
              const candidates = extend(
                sourceFrontier,
                player,
                position,
                cost,
                boosted ? asBoosted : asStarter,
                limitFor(destMask, bench),
                ceilingFor(destMask, bench),
                minValue,
                boosted,
              )
              if (candidates.length === 0) continue
              dp[destMask][destXState][bench] = mergeFrontier(dp[destMask][destXState][bench], candidates)
            }
          }

          // X Players never sit on the bench.
          if (!player.isXPlayer && bench < benchSize) {
            const candidates = extend(
              sourceFrontier,
              player,
              'bench',
              cost,
              asBench,
              limitFor(mask, bench + 1),
              ceilingFor(mask, bench + 1),
              minValue,
            )
            if (candidates.length === 0) continue
            dp[mask][xState][bench + 1] = mergeFrontier(dp[mask][xState][bench + 1], candidates)
          }
        }
      }
    }
  }

  return dp
}

function reconstruct(cell: Cell): { slots: LineupSlot[]; bench: Player[]; boostedIds: string[] } {
  const slots: LineupSlot[] = []
  const bench: Player[] = []
  const boostedIds: string[] = []
  for (let c: Cell | null = cell; c && c.source; c = c.source) {
    if (c.slot === 'bench') bench.unshift(c.player as Player)
    else slots.unshift({ position: c.slot as Position, player: c.player as Player })
    if (c.boosted) boostedIds.unshift((c.player as Player).id)
  }
  return { slots, bench, boostedIds }
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

interface Seed {
  mask: number
  xState: number
  /** Super Big 3 boosts already used by the seed's starters. */
  boost: number
  bench: number
  cell: Cell
}

/**
 * The starting point for the DP: required starters in their slots, then
 * preferred bench players. The required starters must already fit the X
 * Player limit (findBestLineup checks this up front). Starters in
 * `boostedIds` get the Super Big 3 bonus the DP is choosing.
 */
function buildSeed(
  assignment: LineupSlot[],
  benchPlayers: Player[],
  scoring: Scoring,
  boostedIds: string[] = [],
): Seed {
  let mask = 0
  let xState = X_NONE
  let cell: Cell = BASE_CELL
  for (const slot of assignment) {
    const boosted = boostedIds.includes(slot.player.id)
    mask |= slotBit(slot.position)
    xState = nextXState(xState, slot.player, scoring.extraLegendX) as number
    cell = {
      costCents: cell.costCents + toCents(slot.player.baseSalary),
      value: cell.value + (boosted ? boostedStarterValue(slot.player, scoring) : starterValue(slot.player, scoring)),
      player: slot.player,
      slot: slot.position,
      boosted,
      source: cell,
    }
  }
  for (const player of benchPlayers) {
    cell = {
      costCents: cell.costCents + toCents(player.baseSalary),
      value: cell.value + benchValue(player, scoring),
      player,
      slot: 'bench',
      source: cell,
    }
  }
  return { mask, xState, boost: boostedIds.length, bench: benchPlayers.length, cell }
}

/**
 * Seeds for one required-player assignment. When the builder picks the
 * Super Big 3, any of the required starters may be among the boosted, so
 * there is one seed per way to boost up to boostLimit of them.
 */
function buildSeeds(assignment: LineupSlot[], benchPlayers: Player[], scoring: Scoring): Seed[] {
  const subsets: string[][] = [[]]
  for (const { player } of assignment) {
    for (const subset of [...subsets]) if (subset.length < scoring.boostLimit) subsets.push([...subset, player.id])
  }
  return subsets.map((boosted) => buildSeed(assignment, benchPlayers, scoring, boosted))
}

/**
 * `seed` extended with `forced` players placed every possible way: each in a
 * starting slot still open or (regular players only) a free bench spot.
 * Used for Big 3 players, who must be in the lineup but may play anywhere.
 */
function placeForced(seed: Seed, forced: Player[], scoring: Scoring): Seed[] {
  if (forced.length === 0) return [seed]
  const [player, ...rest] = forced
  const cost = toCents(player.baseSalary)
  const seeds: Seed[] = []
  const xState = nextXState(seed.xState, player, scoring.extraLegendX)
  if (xState !== null) {
    for (const position of player.positions) {
      const bit = slotBit(position)
      if (seed.mask & bit) continue
      const cell: Cell = {
        costCents: seed.cell.costCents + cost,
        value: seed.cell.value + starterValue(player, scoring),
        player,
        slot: position,
        source: seed.cell,
      }
      seeds.push(...placeForced({ ...seed, mask: seed.mask | bit, xState, cell }, rest, scoring))
    }
  }
  if (!player.isXPlayer && seed.bench < scoring.benchSize) {
    const cell: Cell = {
      costCents: seed.cell.costCents + cost,
      value: seed.cell.value + benchValue(player, scoring),
      player,
      slot: 'bench',
      source: seed.cell,
    }
    seeds.push(...placeForced({ ...seed, bench: seed.bench + 1, cell }, rest, scoring))
  }
  return seeds
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

  // A locked Super Big 3 must start, so its players join the required starters.
  const lockedSuper = preferences.superBig3?.lockedIds ?? []
  const missingLocked = lockedSuper.filter((id) => !available.some((p) => p.id === id))
  if (missingLocked.length > 0) {
    return { success: false, reason: 'super_big3_unavailable', playerIds: missingLocked }
  }
  const requiredIds = [...new Set([...preferences.requiredPlayerIds, ...lockedSuper])]

  const preferredForBoth = available
    .filter((p) => requiredIds.includes(p.id) && preferredBenchIds.includes(p.id))
    .map((p) => p.id)
  if (preferredForBoth.length > 0) {
    return { success: false, reason: 'required_players_conflict', conflictingPlayerIds: preferredForBoth }
  }

  const deduped = dedupeCatalogCopies(available, [...requiredIds, ...preferredBenchIds])
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

  const requiredPlayers = players.filter((p) => requiredIds.includes(p.id))
  const extraLegendX = preferences.extraLegendX ?? false
  if (!xPlayersFit(requiredPlayers, extraLegendX)) {
    return {
      success: false,
      reason: 'x_players_conflict',
      conflictingPlayerIds: requiredPlayers.filter((p) => p.isXPlayer).map((p) => p.id),
      extraLegendX,
    }
  }
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

  // A Big 3 only pays off when its three players share a lineup, which the
  // per-player DP can't see. So the DP runs once per candidate set of Big 3s
  // (always including none), with those players forced in and boosted, and
  // the strongest run wins. Few teams have three owned stars, so this stays small.
  // The run without a Big 3 goes first, then the biggest bonuses, so a strong
  // lineup is found early and later runs can drop points that can't beat it.
  const big3Sets: Big3[][] = preferences.big3
    ? candidateBig3Sets(players, preferences.big3.stars, preferences.big3.maxCount)
    : [[]]
  const bonusPower = (big3s: Big3[]) =>
    [...big3BonusMap(big3s, players).values()].reduce((sum, b) => sum + b.offense + b.defense, 0)
  big3Sets.sort((a, b) => a.length === 0 ? -1 : b.length === 0 ? 1 : bonusPower(b) - bonusPower(a))
  const bound = big3Sets.length > 1 ? makeValueBound(players, scoring, capCents) : null

  /** Final-state frontiers for one required-player assignment: a full five with each bench size. */
  function fullFivesFor(
    assignment: LineupSlot[],
    maxCostCents: number,
    big3s: Big3[] = [],
    minValue = -Infinity,
  ): Frontier[] {
    // Without Big 3s, keep the scoring's own bonuses (a locked Super Big 3).
    const runScoring: Scoring = big3s.length > 0 ? { ...scoring, bonuses: big3BonusMap(big3s, players) } : scoring
    const placedIds = new Set([...assignment.map((s) => s.player.id), ...benchPlayers.map((p) => p.id)])
    const forced = players.filter((p) => runScoring.bonuses.has(p.id) && !placedIds.has(p.id))
    const pruning = bound && minValue > -Infinity ? { bound, minValue } : null
    const seeds = buildSeeds(assignment, benchPlayers, runScoring)
      .flatMap((seed) => placeForced(seed, forced, runScoring))
      .filter(
      (s) =>
        !pruning ||
        s.cell.value +
          pruning.bound(POSITIONS.length - popcount(s.mask), benchSize - s.bench, maxCostCents - s.cell.costCents) >=
          minValue,
    )
    if (seeds.length === 0) return Array.from({ length: benchSize + 1 }, () => [])
    const usedIds = new Set([...placedIds, ...forced.map((p) => p.id)])
    const remainingPlayers = players.filter((p) => !usedIds.has(p.id))
    const byId = (a: Player, b: Player) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

    // Seeds that boosted the same number of required starters share one run;
    // each run boosts the rest of its trio from the players it adds.
    const groups = new Map<number, Seed[]>()
    for (const seed of seeds) groups.set(seed.boost, [...(groups.get(seed.boost) ?? []), seed])
    const gain = (p: Player) => boostedStarterValue(p, runScoring) - starterValue(p, runScoring)
    const sortedPlayers =
      runScoring.boostLimit > 0
        ? [...remainingPlayers].sort((a, b) => gain(b) - gain(a) || byId(a, b))
        : [...remainingPlayers].sort(byId)

    const merged: Frontier[] = Array.from({ length: benchSize + 1 }, () => [])
    for (const [boost, group] of groups) {
      const boosts =
        runScoring.boostLimit > 0 ? { left: runScoring.boostLimit - boost, seedStarters: assignment.length } : null
      const byXState = runAssignmentDp(sortedPlayers, runScoring, group, maxCostCents, pruning, boosts)[FULL_MASK]
      // Every X state a finished lineup may end in, merged into one frontier per bench size.
      for (let bench = 0; bench <= benchSize; bench++) {
        for (const x of finalXStates(extraLegendX)) merged[bench] = mergeFrontier(merged[bench], byXState[x][bench])
      }
    }
    return merged
  }

  let bestFeasible: Cell | null = null
  let bestBig3s: Big3[] = []

  for (const big3s of big3Sets) {
    for (const assignment of seedAssignments) {
      const minValue = bestFeasible?.value ?? -Infinity
      const feasibleCell = bestUnderCap(fullFivesFor(assignment, capCents, big3s, minValue)[benchSize], capCents)
      if (
        feasibleCell &&
        (!bestFeasible ||
          feasibleCell.value > bestFeasible.value ||
          (feasibleCell.value === bestFeasible.value && feasibleCell.costCents < bestFeasible.costCents))
      ) {
        bestFeasible = feasibleCell
        bestBig3s = big3s
      }
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

  const { slots, bench, boostedIds } = reconstruct(bestFeasible)
  return {
    success: true,
    slots,
    bench,
    big3s: bestBig3s,
    superBig3: lockedSuper.length > 0 ? lockedSuper : boostedIds,
    totalBaseSalary: bestFeasible.costCents / CENTS,
    totalCurrentSalary: totalCurrentSalary(slots),
    remainingCap: salaryCap - bestFeasible.costCents / CENTS,
  }
}
