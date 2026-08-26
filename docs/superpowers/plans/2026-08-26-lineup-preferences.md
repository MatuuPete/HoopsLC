# Lineup Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Lineup Builder require specific owned players to be included, and switch between maximizing power (today's behavior) or a slider-weighted blend of offense/defense — both saved per-user like the salary cap already is.

**Architecture:** `findBestLineup` gains a `preferences` parameter. Required players are folded in by enumerating every valid way to assign them to distinct eligible slots, then running the existing multi-position assignment DP from that "seed" state instead of from empty, for each candidate assignment, taking the best complete result. The DP's per-player value function becomes pluggable (current salary in Power mode, a weighted offense/defense blend in Stats mode) while the cost function (base salary vs. cap) stays fixed either way.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres + Auth + RLS), Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-26-lineup-preferences-design.md`

## Global Constraints

- `Player` and `LineupResult` are shared types. Vitest (via esbuild) only type-checks files a test actually imports, so `npm test` passing after Task 2 does NOT mean the whole project compiles — `npx tsc --noEmit` only needs to pass clean again once Task 4 (the final task) updates every UI consumer of the new `findBestLineup` signature.
- Required players are a hard constraint: if they can't all fit, the calculation fails with `required_players_conflict` naming them — never a silent best-effort drop.
- Power mode and Stats mode are mutually exclusive (no blending of the two) — matches the earlier decision that a priority mode replaces power entirely rather than blending with it.
- `LineupResultPanel` already derives total offense/defense from `slots`/`closestLineup` client-side — no new fields are added to `LineupResult` for that.

---

### Task 1: Database schema — lineup preference columns

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Produces: `settings.required_player_ids uuid[]`, `settings.objective_mode text`, `settings.offense_weight numeric`.

- [ ] **Step 1: Append the migration to `supabase/schema.sql`**

```sql
-- Lineup preferences: required players and objective mode
alter table settings add column required_player_ids uuid[] not null default '{}';
alter table settings add column objective_mode text not null default 'power'
  check (objective_mode in ('power', 'stats'));
alter table settings add column offense_weight numeric not null default 0.5
  check (offense_weight >= 0 and offense_weight <= 1);
```

- [ ] **Step 2: Apply it to your Supabase project**

Open your Supabase project's SQL Editor and run the block from Step 1.

- [ ] **Step 3: Verify**

```sql
select column_name from information_schema.columns where table_name = 'settings' order by column_name;
```

Expected: `required_player_ids`, `objective_mode`, `offense_weight` all present alongside `salary_cap` and `user_id`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add required-players and objective-mode columns to settings"
```

---

### Task 2: Optimizer core — pluggable objective + required players (TDD)

**Files:**
- Modify: `src/optimizer/types.ts`
- Modify: `src/optimizer/findBestLineup.ts`
- Modify: `src/optimizer/findBestLineup.test.ts`

**Interfaces:**
- Produces: `ObjectiveMode`, `LineupPreferences`, `LineupRequiredPlayersConflict` types; `findBestLineup(players: Player[], salaryCap: number, preferences: LineupPreferences): LineupResult` (signature change — now takes 3 args). Task 4 updates every caller.
- Verification for this task is `npm test` only — see the Global Constraints note on why `npx tsc --noEmit` isn't expected to pass until Task 4.

- [ ] **Step 1: Add the new types**

In `src/optimizer/types.ts`, add after the `Player` interface:

```ts
export type ObjectiveMode = 'power' | 'stats'

export interface LineupPreferences {
  requiredPlayerIds: string[]
  objectiveMode: ObjectiveMode
  offenseWeight: number
}
```

Add after `LineupNoValidXSlot`:

```ts
export interface LineupRequiredPlayersConflict {
  success: false
  reason: 'required_players_conflict'
  conflictingPlayerIds: string[]
}
```

Update the `LineupResult` union:

```ts
export type LineupResult =
  | LineupSuccess
  | LineupMissingPosition
  | LineupCapTooLow
  | LineupNoValidXSlot
  | LineupRequiredPlayersConflict
```

- [ ] **Step 2: Replace the test file with the updated + new failing tests**

Replace the full contents of `src/optimizer/findBestLineup.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findBestLineup } from './findBestLineup'
import type { LineupPreferences, Player } from './types'

const DEFAULT_PREFERENCES: LineupPreferences = {
  requiredPlayerIds: [],
  objectiveMode: 'power',
  offenseWeight: 0.5,
}

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

    const result = findBestLineup(players, 600, DEFAULT_PREFERENCES)

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

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

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

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

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

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

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

    const result = findBestLineup(players, 700, DEFAULT_PREFERENCES)

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

    const result = findBestLineup(players, 1250, DEFAULT_PREFERENCES)

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
      makePlayer({ id: 'flex', positions: ['SF', 'PF'], baseSalary: 100, currentSalary: 500 }),
      makePlayer({ id: 'sf-cheap', positions: ['SF'], baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

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
      makePlayer({ id: 'flex', positions: ['SG', 'SF'], baseSalary: 100, currentSalary: 300 }),
      makePlayer({ id: 'sg-alt', positions: ['SG'], baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'sf-alt', positions: ['SF'], baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

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

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.filter((s) => s.player.isXPlayer)).toHaveLength(1)
    expect(result.slots.filter((s) => s.player.id === 'x-flex')).toHaveLength(1)
    expect(result.totalCurrentSalary).toBe(800)
    expect(result.totalBaseSalary).toBe(500)
  })

  it('forces a required player into the lineup even when they are not the best choice for their slot', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sg-best', positions: ['SG'], baseSalary: 100, currentSalary: 300 }),
      makePlayer({ id: 'sg-required', positions: ['SG'], baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000, { ...DEFAULT_PREFERENCES, requiredPlayerIds: ['sg-required'] })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-required')
  })

  it('reports required_players_conflict when two required players share their only eligible position', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true }),
      makePlayer({ id: 'sg-a', positions: ['SG'] }),
      makePlayer({ id: 'sg-b', positions: ['SG'] }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      requiredPlayerIds: ['sg-a', 'sg-b'],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'required_players_conflict') throw new Error('expected required_players_conflict')
    expect([...result.conflictingPlayerIds].sort()).toEqual(['sg-a', 'sg-b'])
  })

  it('reports required_players_conflict when more than 5 players are required', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true }),
      makePlayer({ id: 'sg-1', positions: ['SG'] }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
      makePlayer({ id: 'extra', positions: ['PG'] }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      requiredPlayerIds: ['pg-x', 'sg-1', 'sf-1', 'pf-1', 'c-1', 'extra'],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'required_players_conflict') throw new Error('expected required_players_conflict')
  })

  it('lets a required X Player satisfy the exactly-one-X-Player rule without needing another', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-required-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pg-other-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 400 }),
      makePlayer({ id: 'sg-1', positions: ['SG'] }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      requiredPlayerIds: ['pg-required-x'],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.filter((s) => s.player.isXPlayer)).toHaveLength(1)
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg-required-x')
  })

  it('prioritizes offense over price when objective mode is stats with offenseWeight 1', () => {
    const players: Player[] = [
      makePlayer({
        id: 'pg-x',
        positions: ['PG'],
        isXPlayer: true,
        baseSalary: 100,
        currentSalary: 100,
        offense: 100,
        defense: 100,
      }),
      makePlayer({ id: 'sg-rich', positions: ['SG'], baseSalary: 100, currentSalary: 500, offense: 50, defense: 50 }),
      makePlayer({
        id: 'sg-offense',
        positions: ['SG'],
        baseSalary: 100,
        currentSalary: 100,
        offense: 300,
        defense: 10,
      }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
    ]

    const result = findBestLineup(players, 1000, {
      requiredPlayerIds: [],
      objectiveMode: 'stats',
      offenseWeight: 1,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-offense')
  })

  it('prioritizes defense over price when objective mode is stats with offenseWeight 0', () => {
    const players: Player[] = [
      makePlayer({
        id: 'pg-x',
        positions: ['PG'],
        isXPlayer: true,
        baseSalary: 100,
        currentSalary: 100,
        offense: 100,
        defense: 100,
      }),
      makePlayer({ id: 'sg-rich', positions: ['SG'], baseSalary: 100, currentSalary: 500, offense: 50, defense: 50 }),
      makePlayer({
        id: 'sg-defense',
        positions: ['SG'],
        baseSalary: 100,
        currentSalary: 100,
        offense: 10,
        defense: 300,
      }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
    ]

    const result = findBestLineup(players, 1000, {
      requiredPlayerIds: [],
      objectiveMode: 'stats',
      offenseWeight: 0,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-defense')
  })

  it('sums offense and defense equally when objective mode is stats with offenseWeight 0.5', () => {
    const players: Player[] = [
      makePlayer({
        id: 'pg-x',
        positions: ['PG'],
        isXPlayer: true,
        baseSalary: 100,
        currentSalary: 100,
        offense: 100,
        defense: 100,
      }),
      makePlayer({
        id: 'sg-balanced',
        positions: ['SG'],
        baseSalary: 100,
        currentSalary: 100,
        offense: 125,
        defense: 125,
      }),
      makePlayer({
        id: 'sg-offense-heavy',
        positions: ['SG'],
        baseSalary: 100,
        currentSalary: 100,
        offense: 200,
        defense: 40,
      }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
    ]

    const result = findBestLineup(players, 1000, {
      requiredPlayerIds: [],
      objectiveMode: 'stats',
      offenseWeight: 0.5,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-balanced')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `findBestLineup` still only takes 2 arguments and has no concept of preferences.

- [ ] **Step 4: Implement the generalized optimizer**

Replace the full contents of `src/optimizer/findBestLineup.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all 16 cases in `findBestLineup.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/optimizer/types.ts src/optimizer/findBestLineup.ts src/optimizer/findBestLineup.test.ts
git commit -m "feat: support required players and a pluggable power/stats objective in the optimizer"
```

---

### Task 3: Settings data layer — persist preferences

**Files:**
- Modify: `src/data/settingsApi.ts`
- Modify: `src/data/useSettings.ts`

**Interfaces:**
- Consumes: `ObjectiveMode` (Task 2).
- Produces: `getSettings()`, `setRequiredPlayerIds`, `setObjectiveMode`, `setOffenseWeight`; `useSettings()` gains `requiredPlayerIds`, `objectiveMode`, `offenseWeight`, `updateRequiredPlayerIds`, `updateObjectiveMode`, `updateOffenseWeight` alongside the existing `salaryCap`/`updateSalaryCap`.

No unit tests for this task — thin Supabase wrappers, matching the untested `playersApi.ts` pattern already in this codebase.

- [ ] **Step 1: Replace the settings API module**

Replace the full contents of `src/data/settingsApi.ts`:

```ts
import { supabase } from '../lib/supabaseClient'
import type { ObjectiveMode } from '../optimizer/types'

const DEFAULT_CAP = 3000

interface Settings {
  salaryCap: number
  requiredPlayerIds: string[]
  objectiveMode: ObjectiveMode
  offenseWeight: number
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .select('salary_cap, required_player_ids, objective_mode, offense_weight')
    .maybeSingle()
  if (error) throw error
  return {
    salaryCap: data?.salary_cap ?? DEFAULT_CAP,
    requiredPlayerIds: data?.required_player_ids ?? [],
    objectiveMode: (data?.objective_mode as ObjectiveMode) ?? 'power',
    offenseWeight: data?.offense_weight ?? 0.5,
  }
}

export async function setSalaryCap(userId: string, salaryCap: number): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, salary_cap: salaryCap })
  if (error) throw error
}

export async function setRequiredPlayerIds(userId: string, requiredPlayerIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ user_id: userId, required_player_ids: requiredPlayerIds })
  if (error) throw error
}

export async function setObjectiveMode(userId: string, objectiveMode: ObjectiveMode): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, objective_mode: objectiveMode })
  if (error) throw error
}

export async function setOffenseWeight(userId: string, offenseWeight: number): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, offense_weight: offenseWeight })
  if (error) throw error
}
```

- [ ] **Step 2: Replace the settings hook**

Replace the full contents of `src/data/useSettings.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import {
  getSettings,
  setObjectiveMode,
  setOffenseWeight,
  setRequiredPlayerIds,
  setSalaryCap,
} from './settingsApi'
import type { ObjectiveMode } from '../optimizer/types'
import { useAuth } from '../auth/AuthContext'

export function useSettings() {
  const { session } = useAuth()
  const [salaryCap, setSalaryCapState] = useState(3000)
  const [requiredPlayerIds, setRequiredPlayerIdsState] = useState<string[]>([])
  const [objectiveMode, setObjectiveModeState] = useState<ObjectiveMode>('power')
  const [offenseWeight, setOffenseWeightState] = useState(0.5)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const settings = await getSettings()
    setSalaryCapState(settings.salaryCap)
    setRequiredPlayerIdsState(settings.requiredPlayerIds)
    setObjectiveModeState(settings.objectiveMode)
    setOffenseWeightState(settings.offenseWeight)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (session) refresh()
  }, [session, refresh])

  async function updateSalaryCap(value: number) {
    if (!session) return
    await setSalaryCap(session.user.id, value)
    setSalaryCapState(value)
  }

  async function updateRequiredPlayerIds(value: string[]) {
    if (!session) return
    await setRequiredPlayerIds(session.user.id, value)
    setRequiredPlayerIdsState(value)
  }

  async function updateObjectiveMode(value: ObjectiveMode) {
    if (!session) return
    await setObjectiveMode(session.user.id, value)
    setObjectiveModeState(value)
  }

  async function updateOffenseWeight(value: number) {
    if (!session) return
    await setOffenseWeight(session.user.id, value)
    setOffenseWeightState(value)
  }

  return {
    salaryCap,
    requiredPlayerIds,
    objectiveMode,
    offenseWeight,
    loading,
    updateSalaryCap,
    updateRequiredPlayerIds,
    updateObjectiveMode,
    updateOffenseWeight,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/data/settingsApi.ts src/data/useSettings.ts
git commit -m "feat: persist required players and objective mode in settings"
```

---

### Task 4: Wire preferences into the Lineup Builder UI

**Files:**
- Modify: `src/pages/LineupBuilderPage.tsx`
- Modify: `src/components/LineupResultPanel.tsx`

**Interfaces:**
- Consumes: `findBestLineup` (Task 2, now 3-arg), `useSettings` (Task 3).
- Produces: `LineupResultPanel` now takes a `players` prop (needed to show names for `required_players_conflict`). This is the last task — `npx tsc --noEmit` must pass clean after it.

- [ ] **Step 1: Add the required-players checklist and objective controls**

Replace the full contents of `src/pages/LineupBuilderPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useSettings } from '../data/useSettings'
import { findBestLineup } from '../optimizer/findBestLineup'
import type { LineupResult } from '../optimizer/types'
import { LineupResultPanel } from '../components/LineupResultPanel'

export function LineupBuilderPage() {
  const { players } = usePlayers()
  const {
    salaryCap,
    updateSalaryCap,
    requiredPlayerIds,
    updateRequiredPlayerIds,
    objectiveMode,
    updateObjectiveMode,
    offenseWeight,
    updateOffenseWeight,
  } = useSettings()
  const [capInput, setCapInput] = useState(salaryCap)
  const [result, setResult] = useState<LineupResult | null>(null)

  useEffect(() => {
    setCapInput(salaryCap)
  }, [salaryCap])

  function handleCalculate() {
    setResult(findBestLineup(players, capInput, { requiredPlayerIds, objectiveMode, offenseWeight }))
  }

  async function handleCapChange(value: number) {
    setCapInput(value)
    await updateSalaryCap(value)
  }

  function toggleRequired(playerId: string) {
    const next = requiredPlayerIds.includes(playerId)
      ? requiredPlayerIds.filter((id) => id !== playerId)
      : [...requiredPlayerIds, playerId]
    updateRequiredPlayerIds(next)
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-md">
      <h1 className="text-sm uppercase tracking-widest text-muted">Lineup Builder</h1>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Salary Cap
        <input
          type="number"
          className="bg-bg border border-border px-2 py-1 text-text"
          value={capInput}
          onChange={(e) => handleCapChange(Number(e.target.value))}
        />
      </label>

      <div className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Required Players
        <div className="border border-border bg-panel p-2 flex flex-col gap-1 max-h-48 overflow-y-auto">
          {players.length === 0 && <span className="text-muted normal-case">No owned players yet.</span>}
          {players.map((p) => (
            <label key={p.id} className="flex items-center gap-2 normal-case tracking-normal text-text text-sm">
              <input
                type="checkbox"
                checked={requiredPlayerIds.includes(p.id)}
                onChange={() => toggleRequired(p.id)}
              />
              {p.name} ({p.positions.join('/')})
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 text-xs uppercase tracking-widest text-muted">
        Objective
        <div className="flex gap-2">
          <button
            onClick={() => updateObjectiveMode('power')}
            className={
              objectiveMode === 'power'
                ? 'border border-accent text-accent px-3 py-1'
                : 'border border-border text-muted px-3 py-1'
            }
          >
            Maximize Power
          </button>
          <button
            onClick={() => updateObjectiveMode('stats')}
            className={
              objectiveMode === 'stats'
                ? 'border border-accent text-accent px-3 py-1'
                : 'border border-border text-muted px-3 py-1'
            }
          >
            Prioritize Stats
          </button>
        </div>

        {objectiveMode === 'stats' && (
          <div className="flex flex-col gap-1">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(offenseWeight * 100)}
              onChange={(e) => updateOffenseWeight(Number(e.target.value) / 100)}
            />
            <div className="flex justify-between normal-case tracking-normal">
              <span>Defense</span>
              <span>{Math.round(offenseWeight * 100)}% Offense</span>
              <span>Offense</span>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleCalculate}
        className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold"
      >
        Calculate Best Lineup
      </button>

      <LineupResultPanel result={result} players={players} />
    </div>
  )
}
```

- [ ] **Step 2: Handle the new failure reason in the result panel**

Replace the full contents of `src/components/LineupResultPanel.tsx`:

```tsx
import type { LineupResult, LineupSlot, Player } from '../optimizer/types'

function sumOffense(slots: LineupSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.player.offense, 0)
}

function sumDefense(slots: LineupSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.player.defense, 0)
}

interface LineupResultPanelProps {
  result: LineupResult | null
  players: Player[]
}

export function LineupResultPanel({ result, players }: LineupResultPanelProps) {
  if (!result) return null

  if (!result.success && result.reason === 'missing_position') {
    return (
      <div className="border border-border bg-panel p-4 text-sm text-red-400">
        Missing owned players for: {result.missingPositions.join(', ')}
      </div>
    )
  }

  if (!result.success && result.reason === 'required_players_conflict') {
    const names = result.conflictingPlayerIds
      .map((id) => players.find((p) => p.id === id)?.name ?? id)
      .join(', ')
    return (
      <div className="border border-border bg-panel p-4 text-sm text-red-400">
        Required players can't all fit in one lineup: {names}. Try unchecking one.
      </div>
    )
  }

  if (!result.success && result.reason === 'no_valid_x_slot') {
    return (
      <div className="border border-border bg-panel p-4 text-sm text-red-400">
        No valid lineup: every lineup needs exactly one X Player. Positions with no X Player:{' '}
        {result.positionsWithoutXPlayer.join(', ') || 'none'}. Positions with no regular player:{' '}
        {result.positionsWithoutRegularPlayer.join(', ') || 'none'}.
      </div>
    )
  }

  if (!result.success && result.reason === 'cap_too_low') {
    return (
      <div className="border border-border bg-panel p-4 flex flex-col gap-3">
        <p className="text-sm text-red-400">
          No lineup fits under this cap. Closest possible lineup costs {result.cheapestPossibleBaseSalary}{' '}
          base salary.
        </p>
        {result.closestLineup.map((slot) => (
          <div key={slot.position} className="flex justify-between text-sm">
            <span className="text-muted uppercase tracking-widest">
              {slot.position}
              {slot.player.isXPlayer ? ' (X)' : ''}
            </span>
            <span>{slot.player.name}</span>
            <span>{slot.player.currentSalary}</span>
          </div>
        ))}
        <div className="border-t border-border pt-3 flex justify-between text-xs uppercase tracking-widest text-muted">
          <span>Closest Total Base Salary</span>
          <span>{result.cheapestPossibleBaseSalary}</span>
        </div>
        <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
          <span>Closest Total Power</span>
          <span>{result.closestTotalCurrentSalary}</span>
        </div>
        <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
          <span>Closest Total Offense</span>
          <span>{sumOffense(result.closestLineup)}</span>
        </div>
        <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
          <span>Closest Total Defense</span>
          <span>{sumDefense(result.closestLineup)}</span>
        </div>
      </div>
    )
  }

  if (!result.success) return null

  return (
    <div className="border border-border bg-panel p-4 flex flex-col gap-3">
      {result.slots.map((slot) => (
        <div key={slot.position} className="flex justify-between text-sm">
          <span className="text-muted uppercase tracking-widest">
            {slot.position}
            {slot.player.isXPlayer ? ' (X)' : ''}
          </span>
          <span>{slot.player.name}</span>
          <span>{slot.player.currentSalary}</span>
        </div>
      ))}
      <div className="border-t border-border pt-3 flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Base Salary</span>
        <span>{result.totalBaseSalary}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Power</span>
        <span>{result.totalCurrentSalary}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Remaining Cap</span>
        <span>{result.remainingCap}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Offense</span>
        <span>{sumOffense(result.slots)}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Defense</span>
        <span>{sumDefense(result.slots)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify the whole project compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LineupBuilderPage.tsx src/components/LineupResultPanel.tsx
git commit -m "feat: add required-players and objective-mode controls to the Lineup Builder"
```

---

## Self-Review

**Spec coverage:**
- Data model (`required_player_ids`, `objective_mode`, `offense_weight`) — Task 1.
- Pluggable objective (`computeValue`) — Task 2 Step 4.
- Required-players seed algorithm and `required_players_conflict` — Task 2 Step 4.
- `LineupPreferences`/`ObjectiveMode`/`LineupRequiredPlayersConflict` types — Task 2 Step 1.
- Settings persistence — Task 3.
- UI controls (checklist, mode toggle, slider) — Task 4 Step 1.
- Result panel handling the new failure reason, no new `LineupResult` fields needed for offense/defense — Task 4 Step 2.
- Testing strategy (required-forced, conflict x2, required-X, stats x3) — Task 2 Step 2.

**Placeholder scan:** no TBD/TODO; every step has runnable code or exact SQL/commands.

**Type consistency:** `LineupPreferences` (Task 2) is constructed identically in `findBestLineup.test.ts` (Task 2) and `LineupBuilderPage.tsx` (Task 4). `ObjectiveMode` (Task 2) is imported and used identically in `settingsApi.ts`/`useSettings.ts` (Task 3) and `LineupBuilderPage.tsx` (Task 4). `useSettings()`'s returned shape (Task 3) matches its destructuring in `LineupBuilderPage.tsx` (Task 4) field-for-field. `LineupResultPanel`'s new `players` prop (Task 4 Step 2) matches its call site in `LineupBuilderPage.tsx` (Task 4 Step 1).
