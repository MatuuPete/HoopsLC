# Multi-Position Players — Design Spec

Date: 2026-08-26

## Purpose

Today every player — catalog-linked or X Player — is locked to exactly
one lineup position. In reality (and already in `player_catalog`
data), many players are eligible at more than one position (e.g.
Victor Wembanyama is PF/C, Kevin Durant is SG/SF/PF). Owned players
currently can't reflect that: "Add From Catalog" forces the admin to
pick a single position at add-time, discarding the rest of the
catalog's eligibility list, and X Players only ever get one manually
chosen position.

This feature lets an owned player be eligible for multiple lineup
slots, and makes the lineup optimizer aware of that eligibility when
computing the true best lineup — including the case where two
different slots could each be filled by the same shared player, but
only one of them actually can be.

## Data Model

`Player.position: Position` becomes `Player.positions: Position[]`
(the same shape `CatalogPlayer.positions` already uses):

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

`NewPlayer = Omit<Player, 'id'>` is unchanged otherwise. This applies
to both catalog-linked players and X Players — an X Player's position
field also becomes a multi-select.

### Schema

There are no real rows in the live `players` table yet, so this is a
clean column swap rather than a migration:

```sql
alter table players drop column position;
alter table players add column positions text[] not null;
alter table players add constraint players_positions_valid check (
  array_length(positions, 1) > 0
  and positions <@ array['PG','SG','SF','PF','C']
);
```

This mirrors the existing `player_catalog_positions_valid` constraint.

## Add / Edit flow

**`CatalogPlayerPicker`** loses its "choose a position" sub-step
entirely. Selecting a catalog player is now a single action — the
roster player inherits every position the catalog lists for them, with
no admin choice involved:

```ts
interface CatalogPlayerPickerProps {
  catalog: CatalogPlayer[]
  onSelect: (player: CatalogPlayer) => void
  onCancel: () => void
}
```

`PlayersPage`'s `Mode` type drops the `position` field from the
`add-catalog` variant, and `handleAddCatalogSubmit` /
`handleEditCatalogSubmit` pass `positions: player.positions` (or
`existing.positions`) straight through instead of a single `position`.

**`CatalogPlayerSalaryForm`** takes `positions: Position[]` instead of
`position: Position`, and displays `positions.join('/')` in place of
the single position badge.

**`PlayerForm`** (X Players): the single `<select>` becomes a
multi-select — a row of toggle buttons for PG/SG/SF/PF/C, matching the
visual style `CatalogPlayerPicker` already uses for its position
filter. At least one position must be selected to submit; state is
`selectedPositions: Position[]` instead of `position: Position`.

**`PlayerTable`**: the `Pos` column renders `p.positions.join('/')`
instead of `p.position`.

## Optimizer (`findBestLineup.ts`)

### Why the current algorithm can't just take an array

The current implementation groups players by their single `position`
into 5 disjoint buckets, then runs a knapsack DP that picks one player
per bucket. Disjointness is what makes that DP correct: a player can
never be double-counted because they only ever belong to one bucket.
It separately tries each of the 5 positions as the "host" for the
mandatory X Player slot, and takes whichever host yields the best
feasible result.

Once players can be eligible for multiple positions, the same player
can appear in more than one group. The old per-group DP can't see that
— it could independently "pick" the same player into two different
slots, which is invalid (a player can only occupy one lineup slot).

### New algorithm

Replace the per-position-group DP with a single DP over
**player items** (classic 0/1-knapsack shape), keyed by:

```
state = (bitmask of the 5 slots already filled, hasXPlayer: boolean)
value(state, budgetCents) = max total current_salary achievable
```

- 32 possible bitmasks (one bit per position slot) × 2 for
  `hasXPlayer` = 64 states, tracked per budget-cent value — the same
  cents-scaled budget axis the current DP already uses.
- Processing each player once (0/1, not unbounded): for a given state,
  either skip the player, or — for each of the player's `positions`
  that corresponds to a slot bit not yet set in the mask — transition
  to `(mask | slotBit, hasXPlayer || player.isXPlayer)` at
  `budget + baseSalaryCents`, `value + currentSalaryCents`, keeping
  parent pointers for reconstruction. A player can only be placed into
  one slot per transition (that's what makes it 0/1 rather than
  allowing the same player to fill two slots at once).
- A valid complete lineup is any path reaching
  `mask = 0b11111, hasXPlayer = true` — matching today's "exactly one
  X Player per lineup" rule.
- The best answer under the cap is the max value across all budgets
  `<= capCents` that reach the complete state.

### Failure modes (unchanged externally)

The three existing `LineupResult` failure shapes stay the same from
the UI's perspective, but are now derived from this DP's reachability
instead of the old independent per-group checks:

- **`missing_position`** — a slot bit that no player's `positions`
  ever covers, checked up front exactly as today (now checking array
  membership instead of equality).
- **`no_valid_x_slot`** — the complete state
  (`mask = 0b11111, hasXPlayer = true`) is unreachable at *any*
  budget, even ignoring the cap.
- **`cap_too_low`** — the complete state is reachable, but only at a
  budget above the cap. The "closest lineup" fallback re-runs the same
  DP minimizing cost instead of maximizing value (mirroring today's
  `cheapestSlots` fallback, but computed jointly now since a
  per-position independent minimum no longer accounts for sharing).

### Performance

A budget-indexed DP (one array slot per integer cent up to the cap) was
tried first and measured too slow in practice — several seconds even
at a modest roster size, because its cost scales with `capCents ×
roster size × 64`, and `capCents` alone can be well over a million at
realistic salary caps. The shipped implementation instead tracks, per
`(mask, hasX)` state, a **Pareto frontier**: a sorted list of
`(cost, value)` points where every point is strictly better in value
than every cheaper-or-equal point (dominated points are pruned on
every merge). Looking up "best value under the cap" or "cheapest
complete lineup" is then a linear scan of that frontier, and frontier
size depends only on how many genuinely distinct, non-dominated
cost/value combinations exist among the owned players — not on the
cap's magnitude at all. Measured: under 10ms for a 150-player roster
at a $12,500 cap, vs. multiple seconds for the budget-indexed version
at 20-40 players.

## Testing Strategy

`findBestLineup.test.ts`: update the `makePlayer` test helper for
`positions: Position[]`, keep all existing cases passing, and add:

- A player eligible at two positions where no other player covers one
  of those two — the optimizer must still complete a valid lineup by
  assigning the shared player to whichever slot the overall optimum
  needs.
- A case where two open slots could each independently be filled by
  the same shared player, but not both — confirming the DP doesn't
  double-count them.
- An X Player eligible at multiple positions, to confirm the
  `hasXPlayer` dimension still enforces exactly one X Player in the
  final lineup regardless of which slot they end up in.

No new component/UI tests (matching the existing YAGNI stance — only
`findBestLineup` gets rigorous automated coverage).

## Out of Scope

- Migrating existing `players` rows (none exist yet — confirmed with
  the project owner).
- Letting the admin restrict a roster player to a subset of the
  catalog's listed positions at add-time (positions are inherited in
  full; narrowing them down is a possible future refinement, not
  needed now).
- Any change to `player_catalog.positions`, which already supports
  multiple positions and is untouched by this feature.
