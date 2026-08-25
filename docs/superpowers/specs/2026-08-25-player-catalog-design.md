# Player Catalog & Admin Import — Design Spec

Date: 2026-08-25

## Purpose

Today, adding a player to your roster means typing in name, position,
current salary (power), offense, and defense by hand for every player.
The source game ("Hoops Arena") already tracks these stats for every
player and updates price daily on its own Rank > Players screen, so
manual entry is redundant and drifts out of date immediately.

This feature adds a shared **player catalog** — reference data for
every real player in the game (price, offense, defense) — and changes
"Add Player" from free-form entry into: browse/search the catalog,
pick a player, and type only the one thing that's actually yours to
decide: the base salary you're paying for them. Offense, defense, and
current salary (power) come from the catalog and stay in sync with it.

There is no API for the source game, so catalog data enters the system
via **bulk image import**: an admin pastes screenshots of the game's
player rankings into a chat with Claude, which reads the visible
price/offense/defense per player and produces a structured batch; the
admin pastes that batch into an admin-only import screen, reviews a
diff, and commits it.

## Roles

A new `profiles` table gives each user an admin flag:

```sql
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false
);

alter table profiles enable row level security;

create policy "profiles_self_read" on profiles
  for select using (auth.uid() = user_id);
```

There is no self-service way to become an admin — consistent with
this app's existing sign-in-only model (no self-service signup
either). When a new user is created in Supabase, a `profiles` row is
inserted manually alongside it; `is_admin` is flipped to `true` for
your account via a one-off SQL statement, documented in the setup
docs. A `useIsAdmin()` hook reads the current user's `profiles` row
and gates the admin nav link and route.

## Player catalog

```sql
create table player_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  positions text[] not null,
  price numeric not null,
  offense numeric not null default 0,
  defense numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint player_catalog_positions_valid check (
    array_length(positions, 1) > 0
    and positions <@ array['PG','SG','SF','PF','C']
  )
);

create unique index player_catalog_name_key on player_catalog (lower(name));

alter table player_catalog enable row level security;

create policy "player_catalog_read" on player_catalog
  for select using (auth.uid() is not null);

create policy "player_catalog_admin_write" on player_catalog
  for insert with check (
    exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.is_admin)
  );

create policy "player_catalog_admin_update" on player_catalog
  for update using (
    exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.is_admin)
  );
```

`positions` holds every position a player is eligible for in the game
(e.g. Wembanyama: `['PF','C']`), matching the multi-position tags seen
in the rankings screen. Any signed-in user can read the catalog (they
need to browse it to add players); only admins can write to it.

Catalog rows are keyed by name (case-insensitive, unique). There is no
price history — only the latest known value is kept, matching what the
optimizer needs.

## Linking owned players to the catalog

```sql
alter table players add column catalog_player_id uuid references player_catalog(id) on delete set null;

alter table players add constraint regular_player_has_catalog_link
  check (is_x_player or catalog_player_id is not null);
```

`current_salary`, `offense`, and `defense` remain columns on `players`
(unchanged shape, so the optimizer and existing types need no
changes). For a regular (non-X) player, they're populated from the
catalog at add-time and **re-synced whenever an admin commits a
catalog import** that touches that catalog row (see below) — this is
the "live-linked" behavior: prices stay current as of the last import,
without needing to re-add players by hand, and without adding
join/read-time complexity to `playersApi.listPlayers()`.

`base_salary` is the only field the user manually enters for a regular
player, and it is never touched by a catalog sync.

X Players are unaffected: `catalog_player_id` stays `null` for them,
and their `base_salary`/`current_salary`/`offense`/`defense` continue
to be fully manual, per the existing 999/999-fixed, offense+defense=450
rules. This is intentionally left as-is for now and may be revisited
later.

Editing an existing catalog-linked roster row only allows changing
`base_salary`. To point a roster slot at a different catalog player or
a different eligible position, delete and re-add — re-picking a linked
player in place is out of scope for this pass.

**Migration sequencing:** `regular_player_has_catalog_link` can only
be added once every existing non-X row in `players` has a
`catalog_player_id`. Build order matters: ship the catalog table and
admin import first, run an initial bulk import so the catalog is
populated, then delete-and-re-add any pre-existing regular players
through the new Add Player flow (there are only a handful in practice)
before adding the constraint. The implementation plan should treat the
constraint as a final step, not part of the initial migration.

## Bulk import (admin panel)

New admin-only route (e.g. `/admin/catalog`), visible only when
`useIsAdmin()` is true.

**Producing a batch:** outside the app, in a Claude Code/chat session,
the admin pastes a screenshot of the rankings list (as seen in-game,
~10 players per screen). Claude reads name, price, offense, and
defense per row and returns a batch as JSON:

```json
[
  { "name": "Victor Wembanyama", "positions": ["PF", "C"], "price": 2500, "offense": 182, "defense": 218 },
  { "name": "Shai Gilgeous-Alexander", "positions": ["PG", "SG"], "price": 2470, "offense": 254, "defense": 142 }
]
```

**Preview:** the admin pastes that JSON into a textarea in the import
screen. On parse, the client loads existing `player_catalog` rows for
every name in the batch (case-insensitive match) and renders a diff
table per row:

- Matched, changed — e.g. `Wembanyama: 2,470 → 2,500 (Off 182→182, Def 218→218)`.
- Matched, unchanged — shown collapsed/greyed, doesn't need attention.
- Unmatched — no existing catalog row with that name; flagged as
  **new player**, will be inserted.

No writes happen during preview. Malformed JSON or rows missing a
required field are rejected with an inline error before any diff is
shown.

**Commit:** on confirm, the client calls a single Postgres function
(`apply_catalog_import(rows jsonb)`, callable via `supabase.rpc`) that,
in one transaction:

1. Upserts each row into `player_catalog` by lower(name) — insert if
   new, else update `positions`/`price`/`offense`/`defense`/`updated_at`.
2. For every catalog row touched, updates any `players` rows with a
   matching `catalog_player_id`, copying the new
   `current_salary`/`offense`/`defense` onto them.

Running this as one server-side function keeps the upsert-and-cascade
atomic and avoids doing it as N round trips from the client.

## Add Player flow

"Add Player" splits into two entry points:

- **Add Regular Player** — opens a catalog browser: search box
  (substring match on name) and a position filter (All/PG/SG/SF/PF/C),
  styled after the rankings reference screenshot. All ~500+ rows are
  loaded and filtered client-side — no pagination needed at this
  scale. Clicking a result:
  - If the player is eligible at only one position, proceeds directly.
  - If eligible at more than one (e.g. PF/C), the admin/user picks
    which slot to add them at.
  - A final short form shows name/position/offense/defense/price
    read-only, with a single editable field: **Base Salary**. Saving
    creates a `players` row with `catalog_player_id` set and
    `current_salary`/`offense`/`defense` copied from the catalog.
- **Add X Player** — opens today's existing manual form unchanged
  (name, position, offense, defense summing to 450; base/current
  salary fixed at 999).

`PlayerTable` and the lineup optimizer are unaffected — both keep
consuming the same `Player` shape they do today.

## Testing strategy

Two new pure functions get Vitest coverage, following the same
philosophy as `findBestLineup` (test the logic-heavy core, skip
component tests):

- `parseCatalogImport(raw: string)` — parses/validates the pasted
  batch, rejecting malformed JSON or rows missing required fields.
- `diffCatalogImport(parsed, existingCatalog)` — computes the
  changed/unchanged/new classification used by the preview table.

No component/UI tests, consistent with the existing v1 approach.

## Out of scope

- Any automated/scraped/logged-in fetch of game data — ruled out (no
  tooling, credential-sharing and ToS concerns). Bulk image import via
  Claude is the only ingestion path.
- Price history — only the latest catalog values are kept.
- Multi-admin management UI — `is_admin` is flipped by direct SQL for
  now.
- Re-pointing an existing roster row at a different catalog player or
  position in place (delete + re-add instead).
- Any change to X Player mechanics.
