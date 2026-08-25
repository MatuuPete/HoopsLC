# HoopsLC Lineup Optimizer — Design Spec

Date: 2026-08-25

## Purpose

A React + Vite web app that helps a user calculate the best possible
5-player basketball lineup from the players they own, maximizing total
"power" (current salary) while staying under a user-defined base
salary cap. Multiple users can have separate accounts, each with their
own private player pool, settings, and lineups.

## Domain Rules

### Roster shape

A lineup is exactly 5 slots, one per standard basketball position:
PG, SG, SF, PF, C.

### Players

Every player a user owns has:

- `name` (text)
- `position` — one of PG, SG, SF, PF, C
- `base_salary` — counts against the salary cap
- `current_salary` — the player's "power"; this is what the optimizer
  maximizes
- `offense`, `defense` — stored and displayed, but **do not** affect
  lineup selection in v1

### X Players

X Players are a distinct pool of players, tagged with `is_x_player =
true`. They still carry a position (PG/SG/SF/PF/C) and can fill that
position's slot like a regular player, but:

- `base_salary` and `current_salary` are both fixed at **999**
  (not user-editable)
- `offense + defense` must sum to **exactly 500**

Any position's slot may be filled by either a regular player or an
X Player tagged for that position — whichever the optimizer picks.

### Salary cap

The user sets a base salary cap value (persisted per-user). A
candidate lineup is valid only if the sum of the 5 selected players'
`base_salary` is ≤ the cap.

### Optimization goal

Choose exactly one player per position (PG, SG, SF, PF, C) from the
user's owned players (regular or X) to **maximize total
`current_salary`** subject to **total `base_salary` ≤ cap**.

This is a multiple-choice knapsack problem: 5 independent groups (one
per position), pick one item per group, maximize value subject to a
shared weight budget.

Edge cases:
- If any position has zero owned/eligible players, no lineup can be
  built — surface this clearly (which position(s) are missing).
- If no combination of one-per-position fits under the cap, surface
  this clearly rather than silently returning nothing or a partial
  lineup.

## Architecture

- **Frontend**: Vite + React + TypeScript.
- **Backend**: Supabase (hosted Postgres + Auth + Row-Level Security).
  The frontend talks to Supabase directly via `@supabase/supabase-js`
  — no custom server. This keeps the app self-contained while still
  giving persistent, multi-user, hosted data.
- **Auth**: Supabase Auth, email/password. Every `players` and
  `settings` row is scoped to `user_id = auth.uid()` via RLS policies,
  so users only ever see their own data.
- **Styling**: Tailwind CSS with a custom dark theme (see Visual
  Design below), rather than default Tailwind look.
- **Testing**: Vitest for unit tests, focused on the optimizer core.

## Data Model (Supabase / Postgres)

```sql
create table players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position text not null check (position in ('PG','SG','SF','PF','C')),
  is_x_player boolean not null default false,
  base_salary numeric not null,
  current_salary numeric not null,
  offense numeric not null default 0,
  defense numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint x_player_salary check (
    not is_x_player or (base_salary = 999 and current_salary = 999)
  ),
  constraint x_player_stats check (
    not is_x_player or (offense + defense = 500)
  )
);

create table settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  salary_cap numeric not null default 3000
);

alter table players enable row level security;
alter table settings enable row level security;

create policy "players_owner" on players
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "settings_owner" on settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Application-level validation mirrors the two check constraints in the
Players form UI (so the user gets immediate feedback, not just a
failed insert): toggling "X Player" locks base/current salary to 999
and requires the two stat fields to sum to exactly 500.

## Optimizer

A pure, framework-independent TypeScript function:

```ts
function findBestLineup(
  players: Player[],
  salaryCap: number
): LineupResult
```

Where `LineupResult` is either:
- a success: the chosen player id per position slot, total base
  salary spent, total current salary (power), remaining cap; or
- a failure: which position(s) have no eligible players, or that no
  combination fits under the cap (with the cheapest possible total
  base salary shown for reference, so the user knows how far off they
  are).

Implementation: group players by position (5 groups). Run a
multiple-choice knapsack DP over the cap (salary values scaled to
integer cents to avoid floating point issues), tracking the
max-current-salary achievable per integer cap-cent value, with parent
pointers to reconstruct the chosen player per group. This stays fast
regardless of how many players are owned per position, unlike
brute-force enumeration.

This function has no dependency on Supabase or React — it takes plain
data in and returns plain data out — so it can be fully unit tested in
isolation.

## Pages / UI

- **Login / Signup** — Supabase Auth email/password.
- **Players** — table of owned players; add/edit/delete form with
  position dropdown, X-Player toggle (locks salary fields, enforces
  the 500 offense+defense split), base/current salary, offense,
  defense.
- **Lineup Builder** — salary cap input (persisted to `settings`),
  "Calculate Best Lineup" button, result panel showing the chosen
  player per slot (PG/SG/SF/PF/C), total base salary used vs. cap,
  and total power. Clear messaging for the two failure cases above.

## Visual Design

Dark theme inspired by the reference screenshot's aesthetic (not its
DeFi-specific content/tools):

- Near-black background, off-white text, monospace type for labels
  and headers.
- Thin 1px borders, sharp corners, minimal shadows.
- Uppercase, letter-spaced nav labels with small colored accent dots.
- Bordered card-style panels for forms and the lineup result (echoing
  the reference's "MY DEPOSIT" panel), with a full-width white CTA
  button.
- A bottom stat strip showing quick totals (e.g. players owned, total
  power, cap used).

Actual implementation of this visual language happens during coding,
using the frontend-design skill's guidance to avoid a generic/templated
Tailwind look.

## Testing Strategy

Vitest unit tests on `findBestLineup` covering:
- A normal case with multiple eligible players per position.
- A position with zero eligible players → failure result naming it.
- A cap too low for any valid lineup → failure result with cheapest
  reference total.
- An X Player being the optimal (or only) choice for a slot.
- Tied current_salary values (deterministic tie-break, e.g. lowest
  base_salary wins, then stable by id).

No component/UI tests planned for v1 (YAGNI) — the optimizer is the
part worth testing rigorously since it's the core value of the app.

## Out of Scope (v1)

- Offense/defense affecting lineup selection.
- Saving/history of past computed lineups.
- Any roster slot structure beyond the standard 5 positions (no bench,
  no flex).
- Real-time/external salary data — both salary fields are always
  manually entered.
