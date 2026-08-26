# Multi-Position Players Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a roster player be eligible for multiple lineup positions (matching the catalog's existing multi-position data), and make the lineup optimizer find the true best lineup when players can share eligibility across slots.

**Architecture:** `Player.position: Position` becomes `Player.positions: Position[]` throughout the app. The optimizer's DP changes from "one independent knapsack bucket per position" (which only worked because each player belonged to exactly one bucket) to a single DP keyed by `(bitmask of filled slots, whether an X Player has been used)`, processing players one at a time so a shared player can never be placed into two slots at once.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres + Auth + RLS), Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-26-multi-position-players-design.md`

## Global Constraints

- `positions` arrays are restricted to `PG`, `SG`, `SF`, `PF`, `C` (the same values as `POSITIONS` in `src/optimizer/types.ts`), mirroring `player_catalog`'s existing `player_catalog_positions_valid` constraint.
- There are no real rows in the live `players` table yet (confirmed with the project owner) — Task 1's schema change is a clean column replace, no backfill needed.
- X Players keep their existing 999/999 fixed salary and exactly-450 offense+defense validation — this change only adds multiple positions to them, nothing else.
- `Player` is a shared type imported by the optimizer, the data layer, and every player-related component. Because Vitest (via esbuild) only type-checks the files a test actually imports — not the whole project — `npm test` passing after Task 2 does NOT mean the whole project compiles yet. Every task's commit must leave `npm test` passing; `npx tsc --noEmit` (whole-project compile) only needs to pass again once Task 3 (the final task) is done, since Task 2 intentionally changes the shared `Player` type before its other consumers are updated.

---

### Task 1: Database schema — `positions` array column

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Produces: `players.positions text[]` (replacing `players.position text`). No later task depends on this being applied before it can be coded — only before the app can actually save/load real data against a live Supabase project.

- [ ] **Step 1: Append the migration to `supabase/schema.sql`**

Add this to the end of `supabase/schema.sql`:

```sql
-- Support multiple eligible positions per player
alter table players drop column position;
alter table players add column positions text[] not null;
alter table players add constraint players_positions_valid check (
  array_length(positions, 1) > 0
  and positions <@ array['PG','SG','SF','PF','C']
);
```

- [ ] **Step 2: Apply it to your Supabase project**

Open your Supabase project's SQL Editor and run the block from Step 1.

- [ ] **Step 3: Verify**

Run in the SQL Editor:

```sql
select column_name from information_schema.columns where table_name = 'players' and column_name = 'positions';
```

Expected: one row returned (`positions`).

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: replace players.position with a positions array column"
```

---

### Task 2: Optimizer core — multi-position assignment DP (TDD)

**Files:**
- Modify: `src/optimizer/types.ts`
- Modify: `src/optimizer/findBestLineup.ts`
- Modify: `src/optimizer/findBestLineup.test.ts`

**Interfaces:**
- Produces: `Player.positions: Position[]` (replacing `Player.position: Position`); `findBestLineup(players: Player[], salaryCap: number): LineupResult` keeps its existing signature and `LineupResult` shape, but now correctly handles players eligible for multiple slots. `NewPlayer = Omit<Player, 'id'>` (defined in `src/data/playersApi.ts`) picks up the field change automatically. Task 3's every file depends on `positions` existing on `Player`/`NewPlayer`.
- Verification for this task is `npm test` only — see the Global Constraints note on why `npx tsc --noEmit` isn't expected to pass until Task 3.

- [ ] **Step 1: Update the `Player` type**

In `src/optimizer/types.ts`, replace the `position` field:

```ts
export interface Player {
  id: string
  name: string
  positions: Position[]
  isXPlayer: boolean
  baseSalary: number
  currentSalary: number
  offense: number
  defense: number
  catalogPlayerId: string | null
}
```

(`Position`, `POSITIONS`, `LineupSlot`, `LineupResult` and its variants are unchanged — a `LineupSlot` is still keyed by a single fixed `position`, since that's the lineup slot it fills, not the player's full eligibility.)

- [ ] **Step 2: Replace the test file with the updated + new failing tests**

Replace the full contents of `src/optimizer/findBestLineup.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findBestLineup } from './findBestLineup'
import type { Player } from './types'

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'positions'>): Player {
  return {
    name: overrides.id,
    isXPlayer: false,
    baseSalary: 100,
    currentSalary: 100,
    offense: 50,
    defense: 50,
    catalogPlayerId: null,
    ...overrides,
  }
}

describe('findBestLineup', () => {
  it('requires exactly one X Player and picks the best position for it', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', positions: ['PG'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
      makePlayer({ id: 'sg-1', positions: ['SG'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sg-x', positions: ['SG'], isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sf-x', positions: ['SF'], isXPlayer: true, baseSalary: 150, currentSalary: 400 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-x', positions: ['PF'], isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-x', positions: ['C'], isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
    ]

    const result = findBestLineup(players, 600)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots).toHaveLength(5)
    expect(result.slots.filter((s) => s.player.isXPlayer)).toHaveLength(1)
    expect(result.slots.find((s) => s.position === 'SF')?.player.id).toBe('sf-x')
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg-1')
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-1')
    expect(result.slots.find((s) => s.position === 'PF')?.player.id).toBe('pf-1')
    expect(result.slots.find((s) => s.position === 'C')?.player.id).toBe('c-1')
    expect(result.totalCurrentSalary).toBe(800)
    expect(result.totalBaseSalary).toBe(550)
    expect(result.remainingCap).toBe(50)
  })

  it('reports missing_position when a position has no eligible players at all', () => {
    const players: Player[] = [
      makePlayer({ id: 'sg-1', positions: ['SG'] }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'missing_position') throw new Error('expected missing_position')
    expect(result.missingPositions).toEqual(['PG'])
  })

  it('reports no_valid_x_slot when the pool has no X Players at all', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', positions: ['PG'] }),
      makePlayer({ id: 'sg-1', positions: ['SG'] }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'no_valid_x_slot') throw new Error('expected no_valid_x_slot')
    expect(result.positionsWithoutXPlayer).toEqual(['PG', 'SG', 'SF', 'PF', 'C'])
    expect(result.positionsWithoutRegularPlayer).toEqual([])
  })

  it('reports no_valid_x_slot when two positions have no regular player, forcing a conflict', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true }),
      makePlayer({ id: 'sg-x', positions: ['SG'], isXPlayer: true }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'no_valid_x_slot') throw new Error('expected no_valid_x_slot')
    expect(result.positionsWithoutRegularPlayer).toEqual(['PG', 'SG'])
    expect(result.positionsWithoutXPlayer).toEqual(['SF', 'PF', 'C'])
  })

  it('reports cap_too_low with the closest valid (exactly-one-X) lineup when nothing fits', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', positions: ['PG'], baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
      makePlayer({ id: 'sg-1', positions: ['SG'], baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'sg-x', positions: ['SG'], isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'sf-x', positions: ['SF'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'pf-x', positions: ['PF'], isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'c-x', positions: ['C'], isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
    ]

    const result = findBestLineup(players, 700)

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'cap_too_low') throw new Error('expected cap_too_low')
    expect(result.cheapestPossibleBaseSalary).toBe(900)
    expect(result.closestTotalCurrentSalary).toBe(900)
    expect(result.closestLineup).toHaveLength(5)
    expect(result.closestLineup.find((s) => s.position === 'SF')?.player.id).toBe('sf-x')
    expect(result.closestLineup.find((s) => s.position === 'PG')?.player.id).toBe('pg-1')
  })

  it('breaks ties in a regular slot by preferring lower cost, once the X slot is forced', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 999, currentSalary: 999 }),
      makePlayer({ id: 'sg-a', positions: ['SG'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sg-b', positions: ['SG'], baseSalary: 80, currentSalary: 100 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 50, currentSalary: 50 }),
    ]

    const result = findBestLineup(players, 1250)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg-x')
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-b')
    expect(result.totalBaseSalary).toBe(1229)
  })

  it('assigns a shared multi-position player to the slot that has no other candidate', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sg-1', positions: ['SG'], baseSalary: 100, currentSalary: 100 }),
      // Only candidate for PF; also eligible for SF, where sf-cheap is the fallback.
      makePlayer({ id: 'flex', positions: ['SF', 'PF'], baseSalary: 100, currentSalary: 500 }),
      makePlayer({ id: 'sf-cheap', positions: ['SF'], baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PF')?.player.id).toBe('flex')
    expect(result.slots.find((s) => s.position === 'SF')?.player.id).toBe('sf-cheap')
    expect(result.totalCurrentSalary).toBe(850)
    expect(result.totalBaseSalary).toBe(450)
  })

  it('never places the same shared player into two slots at once', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      // Best candidate at both SG and SF, but can only fill one.
      makePlayer({ id: 'flex', positions: ['SG', 'SF'], baseSalary: 100, currentSalary: 300 }),
      makePlayer({ id: 'sg-alt', positions: ['SG'], baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'sf-alt', positions: ['SF'], baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.filter((s) => s.player.id === 'flex')).toHaveLength(1)
    expect(result.totalCurrentSalary).toBe(750)
    expect(result.totalBaseSalary).toBe(500)
  })

  it('keeps exactly one X Player even when the best X candidate is eligible at multiple positions', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', positions: ['PG'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'x-flex', positions: ['SG', 'SF'], isXPlayer: true, baseSalary: 100, currentSalary: 400 }),
      makePlayer({ id: 'sg-1', positions: ['SG'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.filter((s) => s.player.isXPlayer)).toHaveLength(1)
    expect(result.slots.filter((s) => s.player.id === 'x-flex')).toHaveLength(1)
    expect(result.totalCurrentSalary).toBe(800)
    expect(result.totalBaseSalary).toBe(500)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `findBestLineup.ts` still uses `player.position` (singular), which no longer exists on `Player`.

- [ ] **Step 4: Implement the new assignment DP**

Replace the full contents of `src/optimizer/findBestLineup.ts`:

```ts
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
  valueCents: number
  costCents: number
  player: Player | null
  slot: Position | null
  source: Cell | null
}

const BASE_CELL: Cell = { valueCents: 0, costCents: 0, player: null, slot: null, source: null }
const UNREACHABLE: Cell = { valueCents: -1, costCents: 0, player: null, slot: null, source: null }

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
 * dp[mask][hasX][c] = best cell reachable using players considered so far,
 * filling exactly the slots in `mask` (one player each), tracking whether
 * one of them is an X Player, at total base-salary cost <= c (cents).
 *
 * Mutated in place, one player at a time. Within a single player's pass,
 * destination masks are processed in decreasing popcount order so that a
 * player's own transitions always read state from before this player was
 * considered — otherwise the same player could end up placed into two
 * slots in one pass.
 */
function runAssignmentDp(players: Player[], capCents: number): Cell[][][] {
  const masksByPopcount: number[][] = Array.from({ length: POSITIONS.length + 1 }, () => [])
  for (let mask = 0; mask <= FULL_MASK; mask++) {
    masksByPopcount[popcount(mask)].push(mask)
  }

  const dp: Cell[][][] = []
  for (let mask = 0; mask <= FULL_MASK; mask++) {
    dp[mask] = [[], []]
    for (let hasX = 0; hasX < 2; hasX++) {
      dp[mask][hasX] = new Array(capCents + 1).fill(mask === 0 && hasX === 0 ? BASE_CELL : UNREACHABLE)
    }
  }

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
            const sourceColumn = dp[sourceMask][hasXBefore]
            const destColumn = dp[destMask][hasXAfter]

            for (let c = cost; c <= capCents; c++) {
              const prev = sourceColumn[c - cost]
              if (prev.valueCents < 0) continue

              const candidateValue = prev.valueCents + value
              const candidateCost = prev.costCents + cost
              const current = destColumn[c]

              const better =
                current.valueCents < 0 ||
                candidateValue > current.valueCents ||
                (candidateValue === current.valueCents && candidateCost < current.costCents)

              if (better) {
                destColumn[c] = {
                  valueCents: candidateValue,
                  costCents: candidateCost,
                  player,
                  slot: position,
                  source: prev,
                }
              }
            }
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

export function findBestLineup(players: Player[], salaryCap: number): LineupResult {
  const missingPositions = POSITIONS.filter(
    (position) => !players.some((player) => player.positions.includes(position)),
  )
  if (missingPositions.length > 0) {
    return { success: false, reason: 'missing_position', missingPositions }
  }

  const capCents = toCents(salaryCap)
  const totalPossibleCents = players.reduce((sum, p) => sum + toCents(p.baseSalary), 0)
  const dpCapCents = Math.max(capCents, totalPossibleCents)

  const sortedPlayers = [...players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const dp = runAssignmentDp(sortedPlayers, dpCapCents)
  const targetColumn = dp[FULL_MASK][1]

  const feasibleCell = targetColumn[capCents]
  if (feasibleCell.valueCents >= 0) {
    return {
      success: true,
      slots: reconstruct(feasibleCell),
      totalBaseSalary: feasibleCell.costCents / CENTS,
      totalCurrentSalary: feasibleCell.valueCents / CENTS,
      remainingCap: salaryCap - feasibleCell.costCents / CENTS,
    }
  }

  let cheapest: Cell | null = null
  for (let c = 0; c <= dpCapCents; c++) {
    if (targetColumn[c].valueCents >= 0) {
      cheapest = targetColumn[c]
      break
    }
  }

  if (!cheapest) {
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

  return {
    success: false,
    reason: 'cap_too_low',
    cheapestPossibleBaseSalary: cheapest.costCents / CENTS,
    closestLineup: reconstruct(cheapest),
    closestTotalCurrentSalary: cheapest.valueCents / CENTS,
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all 8 cases in `findBestLineup.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/optimizer/types.ts src/optimizer/findBestLineup.ts src/optimizer/findBestLineup.test.ts
git commit -m "feat: let the optimizer place multi-position players into any eligible open slot"
```

---

### Task 3: Wire multi-position players through the app

**Files:**
- Modify: `src/data/playersApi.ts`
- Modify: `src/components/PlayerForm.tsx`
- Modify: `src/components/PlayerTable.tsx`
- Modify: `src/components/CatalogPlayerPicker.tsx`
- Modify: `src/components/CatalogPlayerSalaryForm.tsx`
- Modify: `src/pages/PlayersPage.tsx`

**Interfaces:**
- Consumes: `Player.positions` (Task 2).
- Produces: every direct consumer of `Player`/`NewPlayer` updated to match; `CatalogPlayerPicker`'s `onSelect` drops its `position` argument; `CatalogPlayerSalaryForm` takes `positions: Position[]` instead of `position: Position`. This is the last task — `npx tsc --noEmit` must pass clean after it.

- [ ] **Step 1: Update the players data-access layer**

Replace the full contents of `src/data/playersApi.ts`:

```ts
import { supabase } from '../lib/supabaseClient'
import type { Player } from '../optimizer/types'

interface PlayerRow {
  id: string
  user_id: string
  name: string
  positions: Player['positions']
  is_x_player: boolean
  base_salary: number
  current_salary: number
  offense: number
  defense: number
  catalog_player_id: string | null
}

function fromRow(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    positions: row.positions,
    isXPlayer: row.is_x_player,
    baseSalary: row.base_salary,
    currentSalary: row.current_salary,
    offense: row.offense,
    defense: row.defense,
    catalogPlayerId: row.catalog_player_id,
  }
}

export type NewPlayer = Omit<Player, 'id'>

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await supabase.from('players').select('*').order('name')
  if (error) throw error
  return (data as PlayerRow[]).map(fromRow)
}

export async function createPlayer(player: NewPlayer, userId: string): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert({
      user_id: userId,
      name: player.name,
      positions: player.positions,
      is_x_player: player.isXPlayer,
      base_salary: player.baseSalary,
      current_salary: player.currentSalary,
      offense: player.offense,
      defense: player.defense,
      catalog_player_id: player.catalogPlayerId,
    })
    .select()
    .single()
  if (error) throw error
  return fromRow(data as PlayerRow)
}

export async function updatePlayer(id: string, player: NewPlayer): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .update({
      name: player.name,
      positions: player.positions,
      is_x_player: player.isXPlayer,
      base_salary: player.baseSalary,
      current_salary: player.currentSalary,
      offense: player.offense,
      defense: player.defense,
      catalog_player_id: player.catalogPlayerId,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromRow(data as PlayerRow)
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Turn the X Player form's position field into a multi-select**

Replace the full contents of `src/components/PlayerForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import type { NewPlayer } from '../data/playersApi'
import type { Position } from '../optimizer/types'

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
const X_PLAYER_STAT_TOTAL = 450
const X_PLAYER_SALARY = 999

interface PlayerFormProps {
  initial?: NewPlayer
  onSubmit: (player: NewPlayer) => Promise<void>
  onCancel?: () => void
}

export function PlayerForm({ initial, onSubmit, onCancel }: PlayerFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [positions, setPositions] = useState<Position[]>(initial?.positions ?? ['PG'])
  const [offense, setOffense] = useState(initial?.offense ?? 0)
  const [defense, setDefense] = useState(initial?.defense ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const statsValid = offense + defense === X_PLAYER_STAT_TOTAL
  const positionsValid = positions.length > 0

  function togglePosition(position: Position) {
    setPositions((current) =>
      current.includes(position) ? current.filter((p) => p !== position) : [...current, position],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!statsValid || !positionsValid) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({
        name,
        positions,
        isXPlayer: true,
        baseSalary: X_PLAYER_SALARY,
        currentSalary: X_PLAYER_SALARY,
        offense,
        defense,
        catalogPlayerId: null,
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save player')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-panel p-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Name
        <input
          className="bg-bg border border-border px-2 py-1 text-text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <div className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Positions
        <div className="flex gap-2">
          {POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePosition(p)}
              className={
                positions.includes(p)
                  ? 'border border-accent text-accent px-3 py-1'
                  : 'border border-border text-muted px-3 py-1'
              }
            >
              {p}
            </button>
          ))}
        </div>
        {!positionsValid && (
          <p className="text-xs text-red-400 normal-case tracking-normal">Select at least one position.</p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Offense
        <input
          type="number"
          className="bg-bg border border-border px-2 py-1 text-text"
          value={offense || ''}
          onChange={(e) => setOffense(e.target.value === '' ? 0 : Number(e.target.value))}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Defense
        <input
          type="number"
          className="bg-bg border border-border px-2 py-1 text-text"
          value={defense || ''}
          onChange={(e) => setDefense(e.target.value === '' ? 0 : Number(e.target.value))}
          required
        />
      </label>

      {!statsValid && (
        <p className="text-xs text-red-400">
          Offense + Defense must equal exactly {X_PLAYER_STAT_TOTAL} for an X Player.
        </p>
      )}

      {submitError && <p className="text-xs text-red-400">{submitError}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !statsValid || !positionsValid}
          className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold disabled:opacity-50"
        >
          Save
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border border-border px-4 py-2 uppercase tracking-widest text-xs"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Show every eligible position in the players table**

Replace the full contents of `src/components/PlayerTable.tsx`:

```tsx
import type { Player } from '../optimizer/types'

interface PlayerTableProps {
  players: Player[]
  onEdit: (player: Player) => void
  onDelete: (id: string) => void
}

export function PlayerTable({ players, onEdit, onDelete }: PlayerTableProps) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left text-muted uppercase tracking-widest text-xs border-b border-border">
          <th className="py-2">Name</th>
          <th>Pos</th>
          <th>X</th>
          <th>Base</th>
          <th>Current</th>
          <th>Off</th>
          <th>Def</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.id} className="border-b border-border">
            <td className="py-2">{p.name}</td>
            <td>{p.positions.join('/')}</td>
            <td>{p.isXPlayer ? 'X' : ''}</td>
            <td>{p.baseSalary}</td>
            <td>{p.currentSalary}</td>
            <td>{p.offense}</td>
            <td>{p.defense}</td>
            <td className="flex gap-2 py-2">
              <button onClick={() => onEdit(p)} className="text-xs uppercase underline">
                Edit
              </button>
              <button onClick={() => onDelete(p.id)} className="text-xs uppercase underline text-red-400">
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Remove the "choose one position" step from the catalog picker**

Replace the full contents of `src/components/CatalogPlayerPicker.tsx`:

```tsx
import { useState } from 'react'
import { POSITIONS, type Position } from '../optimizer/types'
import type { CatalogPlayer } from '../catalog/types'

interface CatalogPlayerPickerProps {
  catalog: CatalogPlayer[]
  onSelect: (player: CatalogPlayer) => void
  onCancel: () => void
}

export function CatalogPlayerPicker({ catalog, onSelect, onCancel }: CatalogPlayerPickerProps) {
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState<Position | 'ALL'>('ALL')

  const filtered = catalog.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(search.toLowerCase())
    const matchesPosition = positionFilter === 'ALL' || player.positions.includes(positionFilter)
    return matchesSearch && matchesPosition
  })

  return (
    <div className="border border-border bg-panel p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-widest text-muted">Choose a Player</h2>
        <button onClick={onCancel} className="text-xs uppercase tracking-widest text-muted underline">
          Cancel
        </button>
      </div>

      <input
        className="bg-bg border border-border px-2 py-1 text-text text-sm"
        placeholder="Search player..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-2 text-xs uppercase tracking-widest">
        {(['ALL', ...POSITIONS] as const).map((option) => (
          <button
            key={option}
            onClick={() => setPositionFilter(option)}
            className={positionFilter === option ? 'text-accent' : 'text-muted'}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
        {filtered.map((player) => (
          <button
            key={player.id}
            onClick={() => onSelect(player)}
            className="flex justify-between text-sm py-1 border-b border-border text-left"
          >
            <span>{player.name}</span>
            <span className="text-muted">{player.positions.join('/')}</span>
            <span>{player.price}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Show every eligible position in the salary form**

Replace the full contents of `src/components/CatalogPlayerSalaryForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import type { Position } from '../optimizer/types'

interface CatalogPlayerSalaryFormProps {
  name: string
  positions: Position[]
  price: number
  offense: number
  defense: number
  initialBaseSalary?: number
  onSubmit: (baseSalary: number) => Promise<void>
  onCancel: () => void
}

export function CatalogPlayerSalaryForm({
  name,
  positions,
  price,
  offense,
  defense,
  initialBaseSalary,
  onSubmit,
  onCancel,
}: CatalogPlayerSalaryFormProps) {
  const [baseSalary, setBaseSalary] = useState(initialBaseSalary ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(baseSalary)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save player')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-panel p-4 flex flex-col gap-3">
      <div className="flex justify-between text-sm">
        <span>{name}</span>
        <span className="text-muted uppercase tracking-widest">{positions.join('/')}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Price</span>
        <span>{price}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Offense</span>
        <span>{offense}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Defense</span>
        <span>{defense}</span>
      </div>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Base Salary
        <input
          type="number"
          min={0}
          className="bg-bg border border-border px-2 py-1 text-text"
          value={baseSalary || ''}
          onChange={(e) => setBaseSalary(e.target.value === '' ? 0 : Number(e.target.value))}
          required
        />
      </label>

      {submitError && <p className="text-xs text-red-400">{submitError}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-border px-4 py-2 uppercase tracking-widest text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 6: Drop the position argument from `PlayersPage`'s catalog-add flow**

Replace the full contents of `src/pages/PlayersPage.tsx`:

```tsx
import { useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useCatalog } from '../data/useCatalog'
import { PlayerForm } from '../components/PlayerForm'
import { CatalogPlayerPicker } from '../components/CatalogPlayerPicker'
import { CatalogPlayerSalaryForm } from '../components/CatalogPlayerSalaryForm'
import { PlayerTable } from '../components/PlayerTable'
import type { Player } from '../optimizer/types'
import type { CatalogPlayer } from '../catalog/types'
import type { NewPlayer } from '../data/playersApi'

type Mode =
  | { kind: 'closed' }
  | { kind: 'pick-catalog' }
  | { kind: 'add-catalog'; player: CatalogPlayer }
  | { kind: 'edit-catalog'; player: Player }
  | { kind: 'x-form'; editing?: Player }

export function PlayersPage() {
  const { players, loading, error, addPlayer, editPlayer, removePlayer } = usePlayers()
  const { catalog } = useCatalog()
  const [mode, setMode] = useState<Mode>({ kind: 'closed' })

  async function handleXSubmit(player: NewPlayer) {
    if (mode.kind === 'x-form' && mode.editing) {
      await editPlayer(mode.editing.id, player)
    } else {
      await addPlayer(player)
    }
    setMode({ kind: 'closed' })
  }

  async function handleAddCatalogSubmit(player: CatalogPlayer, baseSalary: number) {
    await addPlayer({
      name: player.name,
      positions: player.positions,
      isXPlayer: false,
      baseSalary,
      currentSalary: player.price,
      offense: player.offense,
      defense: player.defense,
      catalogPlayerId: player.id,
    })
    setMode({ kind: 'closed' })
  }

  async function handleEditCatalogSubmit(existing: Player, baseSalary: number) {
    await editPlayer(existing.id, {
      name: existing.name,
      positions: existing.positions,
      isXPlayer: false,
      baseSalary,
      currentSalary: existing.currentSalary,
      offense: existing.offense,
      defense: existing.defense,
      catalogPlayerId: existing.catalogPlayerId,
    })
    setMode({ kind: 'closed' })
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm uppercase tracking-widest text-muted">Players</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMode({ kind: 'pick-catalog' })}
            className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold"
          >
            Add From Catalog
          </button>
          <button
            onClick={() => setMode({ kind: 'x-form' })}
            className="border border-border px-4 py-2 uppercase tracking-widest text-xs"
          >
            Add X Player
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <p className="text-muted text-sm">Loading...</p>}

      {mode.kind === 'pick-catalog' && (
        <CatalogPlayerPicker
          catalog={catalog}
          onSelect={(player) => setMode({ kind: 'add-catalog', player })}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      )}

      {mode.kind === 'add-catalog' && (
        <CatalogPlayerSalaryForm
          name={mode.player.name}
          positions={mode.player.positions}
          price={mode.player.price}
          offense={mode.player.offense}
          defense={mode.player.defense}
          onSubmit={(baseSalary) => handleAddCatalogSubmit(mode.player, baseSalary)}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      )}

      {mode.kind === 'edit-catalog' && (
        <CatalogPlayerSalaryForm
          name={mode.player.name}
          positions={mode.player.positions}
          price={mode.player.currentSalary}
          offense={mode.player.offense}
          defense={mode.player.defense}
          initialBaseSalary={mode.player.baseSalary}
          onSubmit={(baseSalary) => handleEditCatalogSubmit(mode.player, baseSalary)}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      )}

      {mode.kind === 'x-form' && (
        <PlayerForm
          initial={mode.editing}
          onSubmit={handleXSubmit}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      )}

      <PlayerTable
        players={players}
        onEdit={(player) =>
          setMode(player.isXPlayer ? { kind: 'x-form', editing: player } : { kind: 'edit-catalog', player })
        }
        onDelete={removePlayer}
      />
    </div>
  )
}
```

- [ ] **Step 7: Verify the whole project compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: PASS, all tests green (optimizer tests plus the existing catalog parser/diff tests).

- [ ] **Step 9: Commit**

```bash
git add src/data/playersApi.ts src/components/PlayerForm.tsx src/components/PlayerTable.tsx src/components/CatalogPlayerPicker.tsx src/components/CatalogPlayerSalaryForm.tsx src/pages/PlayersPage.tsx
git commit -m "feat: wire multi-position players through the add/edit flow and UI"
```

---

## Self-Review

**Spec coverage:**
- `Player.position` → `Player.positions` — Task 2 Step 1.
- Schema column swap — Task 1.
- `CatalogPlayerPicker` drops the position-choice step, inherits all catalog positions — Task 3 Step 4, Step 6 (`handleAddCatalogSubmit`).
- `PlayerForm` multi-select for X Players — Task 3 Step 2.
- `PlayerTable` / `CatalogPlayerSalaryForm` display all positions — Task 3 Steps 3, 5.
- New assignment DP (bitmask + hasX + budget), replacing the per-position-group knapsack — Task 2 Step 4.
- Failure modes (`missing_position`, `no_valid_x_slot`, `cap_too_low`) re-derived from DP reachability — Task 2 Step 4.
- Testing strategy (shared-player forced assignment, no double-counting, X Player multi-position) — Task 2 Step 2 (new tests 6-8).
- Out-of-scope items (no data migration, no per-add position subset) — correctly not implemented anywhere in this plan.

**Placeholder scan:** no TBD/TODO; every step has runnable code or exact SQL/commands.

**Type consistency:** `Player.positions: Position[]` (Task 2) is read identically in `playersApi.ts`, `PlayerForm.tsx`, `PlayerTable.tsx`, `CatalogPlayerPicker.tsx`, `CatalogPlayerSalaryForm.tsx`, and `PlayersPage.tsx` (Task 3). `CatalogPlayerPicker`'s `onSelect: (player: CatalogPlayer) => void` (Task 3 Step 4) matches its usage in `PlayersPage` (Task 3 Step 6). `CatalogPlayerSalaryForm`'s `positions: Position[]` prop (Task 3 Step 5) matches both call sites in `PlayersPage` (Task 3 Step 6).
