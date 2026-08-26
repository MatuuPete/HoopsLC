# Lineup Preferences — Design Spec

Date: 2026-08-26

## Purpose

Today `findBestLineup` has exactly one goal — maximize total current
salary (price) of the 5 chosen players under the base-salary cap — and
no way to insist on specific players. This feature adds two
independent controls to the Lineup Builder:

1. **Required players** — pin specific owned players so the optimizer
   is forced to include them (if it's possible to at all), instead of
   just hoping they happen to be chosen.
2. **Objective mode** — switch what "best" means: keep today's
   Maximize Power behavior (total price/current salary under the cap),
   or switch to Prioritize Stats, which maximizes a slider-weighted
   blend of total offense and total defense instead (0% = pure
   defense, 100% = pure offense, 50% = equal weight to both).

Both settings persist per-user in `settings`, the same way the salary
cap already does.

This spec does not touch the `StatStrip` roster-wide "Total Power"
figure — that was a separate, already-shipped fix (now sums
offense+defense across every owned player including bench, unrelated
to the per-lineup objective below).

## Data Model

`settings` gains three columns:

```sql
alter table settings add column required_player_ids uuid[] not null default '{}';
alter table settings add column objective_mode text not null default 'power'
  check (objective_mode in ('power', 'stats'));
alter table settings add column offense_weight numeric not null default 0.5
  check (offense_weight >= 0 and offense_weight <= 1);
```

`required_player_ids` has no database-level foreign key (Postgres
can't enforce FKs on array elements). If a required player is later
deleted, the app filters out any id in the array that no longer
matches an owned player before running the optimizer — no DB
constraint needed, no crash.

`offense_weight` is only meaningful when `objective_mode = 'stats'`;
it's ignored in `'power'` mode (kept persisted regardless, so flipping
back to Stats mode restores your last slider position).

## Objective Becomes Pluggable

`findBestLineup`'s value function — what each player contributes
toward the thing being maximized — becomes a parameter instead of a
hardcoded `player.currentSalary`:

- `power` mode: `value = currentSalary` (today's behavior, unchanged).
- `stats` mode: `value = offenseWeight * offense + (1 - offenseWeight) * defense`.

The **cost** side (base salary charged against the cap) never changes
— only the mode-dependent value function does. Both modes still
respect the salary cap and the exactly-one-X-Player rule exactly as
today.

Since `offenseWeight` can be a non-integer slider value, the DP scales
it the same way the existing code scales currency to avoid floating
point drift: `round(offenseWeight * 1000) * offense + round((1 -
offenseWeight) * 1000) * defense`, an integer value comparable across
players.

## Required Players, Algorithmically

At most 5 players can be required (a lineup only has 5 slots). Given
the required set:

1. Enumerate every valid way to assign the required players to
   distinct slots they're each eligible for (an injective mapping —
   each required player gets one of their own eligible positions, no
   two required players share a slot). This is a small search: with
   at most 5 required players this is bounded by 5! in the
   worst case, but position eligibility prunes it hard in practice.
2. If **no** valid assignment exists — two required players who are
   only eligible at the same single position, more than 5 required
   players, or any other structural conflict — that's a new failure
   mode, `required_players_conflict`, naming the players involved.
3. For each valid assignment, build a "seed": the slots it fills, the
   cost spent, the value earned (under the active objective's value
   function), and whether it already includes an X Player. Run the
   *existing* assignment DP starting from that seed (instead of from
   empty) over the remaining, non-required players, to optimally fill
   whatever slots are left.
4. Take the best complete result across all valid seed assignments. If
   every valid seed assignment fails to complete (e.g. no X Player is
   left available, or nothing fits under the remaining budget), report
   the failure diagnostics (`missing_position`, `no_valid_x_slot`, or
   `cap_too_low`) from the first valid seed assignment — these are
   edge cases secondary to the primary `required_players_conflict`
   check in step 2, so picking one deterministic, representative
   diagnostic is enough rather than merging several.

This reuses the multi-position DP from the earlier feature unchanged
in its core transition logic — it just needs to accept a starting
`Cell` (seed) instead of always starting at the empty base cell, and a
value-function parameter instead of a hardcoded one. The existing
`Cell.source` chain already lets a seed be built as a linked chain of
"pre-placed" cells, so `reconstruct()` naturally walks back through
both the required players and the DP-chosen ones with no special
casing.

## Interfaces

```ts
export type ObjectiveMode = 'power' | 'stats'

export interface LineupPreferences {
  requiredPlayerIds: string[]
  objectiveMode: ObjectiveMode
  offenseWeight: number // 0-1, only used when objectiveMode === 'stats'
}

export function findBestLineup(
  players: Player[],
  salaryCap: number,
  preferences: LineupPreferences,
): LineupResult
```

`LineupResult`'s existing success/failure shapes are extended with one
new failure variant:

```ts
export interface LineupRequiredPlayersConflict {
  success: false
  reason: 'required_players_conflict'
  conflictingPlayerIds: string[]
}
```

`conflictingPlayerIds` is the full required-players list that was
attempted (not a minimal isolated subset) — pinpointing exactly which
2 of, say, 4 required players are the actual conflict is a harder
diagnostic problem not needed here; the UI message names all of them
and lets you work out which to unpick.

`LineupSuccess` and `LineupCapTooLow` keep `totalCurrentSalary` (still
useful to show regardless of mode) and gain `totalOffense` and
`totalDefense` on the chosen 5, so the result panel can show the
metric that actually drove the choice in Stats mode without the UI
needing to recompute it from `slots`.

## Settings & Data Layer

`src/data/settingsApi.ts` and `useSettings` gain `requiredPlayerIds`,
`objectiveMode`, `offenseWeight` alongside the existing `salaryCap`,
with corresponding update functions, following the exact pattern
already used for `salaryCap`.

## UI (Lineup Builder page)

Two new sections above "Calculate Best Lineup":

- **Required Players** — a checklist of your owned players (name +
  positions), toggled on/off. Persists on change.
- **Objective** — a "Maximize Power" / "Prioritize Stats" toggle.
  Selecting Prioritize Stats reveals a slider (0% Defense ↔ 100%
  Offense, defaulting to the persisted `offenseWeight`, 50% = equal
  weight). Both persist on change.

The result panel gains a line showing total offense/defense for the
chosen lineup (using the new `totalOffense`/`totalDefense` fields),
and a new failure message for `required_players_conflict` naming the
conflicting players by name (looked up from the roster, since the
result only carries ids).

## Testing Strategy

`findBestLineup.test.ts` gains cases for:

- A required player forced into the lineup even though they are not
  the highest-value choice for their slot.
- Two required players sharing their only eligible position →
  `required_players_conflict`.
- More than 5 required players → `required_players_conflict`.
- A required player who is an X Player correctly satisfies the
  exactly-one-X-Player rule without also requiring a second X Player
  elsewhere.
- Stats mode at 100% offense picks a genuinely different lineup than
  Power mode for the same roster/cap (a lower-price, higher-offense
  player wins).
- Stats mode at 100% defense picks a genuinely different lineup,
  favoring defense.
- Stats mode at 50% (equal weight) correctly sums offense+defense
  rather than favoring either.

No new component/UI tests, matching the existing YAGNI stance for this
codebase (only `findBestLineup` gets rigorous automated coverage; the
settings plumbing and UI controls are thin, matching the untested
`playersApi.ts`/`CatalogPlayerPicker.tsx` pattern already in place).

## Out of Scope

- Soft/best-effort required players (dropping a required player
  silently if it can't fit) — required players are a hard constraint;
  infeasibility is reported, not silently ignored.
- A blended power+stats objective, or more than the two named modes —
  Power and Stats are mutually exclusive, matching the decision that
  a priority mode replaces power entirely rather than blending with
  it.
- Changing what `StatStrip`'s roster-wide "Total Power" means — that
  was already shipped separately (offense+defense across all owned
  players).
