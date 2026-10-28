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
    not is_x_player or (offense + defense = 450)
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

-- Admin roles
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false
);

alter table profiles enable row level security;

create policy "profiles_self_read" on profiles
  for select using (auth.uid() = user_id);

-- Player catalog (shared reference data, not per-user)
create table player_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  positions text[] not null,
  price numeric not null,
  offense numeric not null default 0,
  defense numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint player_catalog_positions_valid check (
    coalesce(array_length(positions, 1), 0) > 0
    and positions <@ array['PG','SG','SF','PF','C']
  )
);

create unique index player_catalog_name_key on player_catalog (lower(name));

alter table player_catalog enable row level security;

create policy "player_catalog_read" on player_catalog
  for select using (auth.uid() is not null);

create policy "player_catalog_admin_insert" on player_catalog
  for insert with check (
    exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.is_admin)
  );

create policy "player_catalog_admin_update" on player_catalog
  for update using (
    exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.is_admin)
  );

-- Link owned players to a catalog entry
alter table players add column catalog_player_id uuid references player_catalog(id) on delete set null;

-- An X Player's salary/stats are fixed by the x_player_salary/x_player_stats
-- constraints above and must never be driven by a catalog import cascade.
-- The client never links an X Player to a catalog entry, but nothing else
-- stops a user from setting catalog_player_id on their own X Player row via
-- PostgREST (the players_owner policy allows updating any column on a row
-- they own) -- this constraint closes that off at the database level.
alter table players add constraint x_player_no_catalog_link check (
  not (is_x_player and catalog_player_id is not null)
);

-- Bulk import: upserts catalog rows and cascades new price/offense/defense
-- to every owned player linked to that catalog entry, across all users.
-- SECURITY DEFINER is required so the cascade can update rows owned by
-- users other than the calling admin; the explicit is_admin check below
-- is what keeps this restricted to admins (RLS on `players` and
-- `player_catalog` does not apply inside a SECURITY DEFINER function
-- owned by the table owner, which is why the check is done explicitly
-- rather than left to RLS).
create or replace function apply_catalog_import(rows jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  import_row jsonb;
  catalog_id uuid;
begin
  if not exists (select 1 from profiles where user_id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;

  for import_row in select * from jsonb_array_elements(rows)
  loop
    insert into player_catalog (name, positions, price, offense, defense, updated_at)
    values (
      import_row->>'name',
      (select array_agg(value::text) from jsonb_array_elements_text(import_row->'positions')),
      (import_row->>'price')::numeric,
      (import_row->>'offense')::numeric,
      (import_row->>'defense')::numeric,
      now()
    )
    on conflict (lower(name)) do update
      set positions = excluded.positions,
          price = excluded.price,
          offense = excluded.offense,
          defense = excluded.defense,
          updated_at = now()
    returning id into catalog_id;

    update players
    set current_salary = (import_row->>'price')::numeric,
        offense = (import_row->>'offense')::numeric,
        defense = (import_row->>'defense')::numeric
    where catalog_player_id = catalog_id
      and not is_x_player;
  end loop;
end;
$$;

revoke execute on function apply_catalog_import(jsonb) from anon;

-- Deferred: run this only after every existing non-X player has been
-- re-added through the catalog-based Add Player flow (Task 12 of
-- docs/superpowers/plans/2026-08-25-player-catalog.md). Adding it
-- earlier will fail if any regular player row still lacks a catalog
-- link.
-- alter table players add constraint regular_player_has_catalog_link
--   check (is_x_player or catalog_player_id is not null);

-- Support multiple eligible positions per player
alter table players drop column position;
alter table players add column positions text[] not null;
alter table players add constraint players_positions_valid check (
  array_length(positions, 1) > 0
  and positions <@ array['PG','SG','SF','PF','C']
);

-- Lineup preferences: required players and objective mode
alter table settings add column required_player_ids uuid[] not null default '{}';
alter table settings add column objective_mode text not null default 'power'
  check (objective_mode in ('power', 'stats'));
alter table settings add column offense_weight numeric not null default 0.5
  check (offense_weight >= 0 and offense_weight <= 1);

-- Unavailable players: owned players whose copies are all committed to
-- other accounts' lineups, so this calculation must not use them. Like
-- required_player_ids, no array-element FK -- the app drops ids that no
-- longer match an owned player before running the optimizer.
alter table settings add column unavailable_player_ids uuid[] not null default '{}';

-- Saved lineups: a point-in-time snapshot of a calculated lineup. The five
-- slots are stored denormalised in `slots` (position, name, isXPlayer,
-- currentSalary, baseSalary, offense, defense) so a saved lineup keeps
-- rendering what it was even after catalog prices or stats change. Card
-- totals are summed from the snapshot on the client.
create table lineups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  slots jsonb not null
);

alter table lineups enable row level security;

create policy "lineups_owner" on lineups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Saved lineups get an editable title. New saves are auto-titled
-- "Lineup N" where N comes from a per-user monotonic counter, so deleting
-- a lineup never reuses its number.
alter table lineups add column title text not null default '';
alter table settings add column saved_lineup_count integer not null default 0;

-- Each saved-lineup slot object now also carries `playerId` (the owned
-- player it was filled with). A player in any saved lineup is locked out
-- of future lineup calculations. Slots saved before `playerId` existed
-- lock nothing. No DDL: `slots` is jsonb.

-- settings.unavailable_player_ids (added above) is read/written again: it
-- backs the lineup builder's optional "Unavailable Players" list, for
-- players a friend has borrowed that aren't in any saved lineup. The
-- optimizer excludes the union of this list and the saved-lineup locks.

-- Usernames: picked once after first sign-in (Google OAuth).
-- Most users have no profiles row until they pick one, so set_username
-- upserts it. It's SECURITY DEFINER so there is no client insert/update
-- policy on profiles at all -- a client-writable profiles row would let a
-- user set their own is_admin.
alter table profiles add column username text;

alter table profiles add constraint profiles_username_format
  check (username ~ '^[A-Za-z0-9_]{3,20}$');

create unique index profiles_username_key on profiles (lower(username));

create or replace function set_username(new_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into profiles (user_id, username)
  values (auth.uid(), new_username)
  on conflict (user_id) do update set username = excluded.username;
end;
$$;

revoke all on function set_username(text) from public;
grant execute on function set_username(text) to authenticated;

-- Legend X: a second X Player tier whose Offense + Defense total is 500
-- instead of 450. Salary stays fixed at 999 and a lineup still has
-- exactly one X Player of either tier. x_tier is null for regular players.
alter table players add column x_tier text;
update players set x_tier = 'standard' where is_x_player;

alter table players add constraint players_x_tier_valid check (
  (is_x_player and x_tier in ('standard', 'legend'))
  or (not is_x_player and x_tier is null)
);

alter table players drop constraint x_player_stats;
alter table players add constraint x_player_stats check (
  not is_x_player
  or (x_tier = 'standard' and offense + defense = 450)
  or (x_tier = 'legend' and offense + defense = 500)
);

-- Bench: a lineup can add 1-6 bench players after the starting five,
-- sharing the same salary cap. Bench players are any position, never
-- X Players. A saved lineup stores them denormalised like `slots`
-- (playerId, name, positions, currentSalary, baseSalary, offense,
-- defense, award?) and they are locked out of future lineups too.
alter table lineups add column bench jsonb not null default '[]';
alter table settings add column bench_enabled boolean not null default false;
alter table settings add column bench_size integer not null default 6
  check (bench_size between 1 and 6);

-- Preferred bench players: forced onto the bench (when the bench is on),
-- as required_player_ids is for the starting five. The app keeps the two
-- lists disjoint and drops ids that no longer match an owned player.
alter table settings add column preferred_bench_player_ids uuid[] not null default '{}';

-- Legend X event: while on, a lineup may field one more X Player on top
-- of the usual one, as long as one of the two is a Legend X.
alter table settings add column legend_event_enabled boolean not null default false;

-- Clipboard: an admin's private scratch space for text pasted on one
-- device (e.g. a phone) and picked up on another. Rows are owner-only;
-- only admins may add them, since the page is admin-only.
create table clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 100000),
  created_at timestamptz not null default now()
);

alter table clips enable row level security;

create policy "clips_owner" on clips
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.is_admin)
  );

-- Live sync: the clipboard page listens for inserts/deletes so a clip saved
-- on the phone appears on an already-open laptop tab without a reload.
alter publication supabase_realtime add table clips;

-- Team Big 3: each catalog player gets a team. A team's stars are its five
-- highest-priced catalog players; three stars of one team in a lineup
-- (starters or bench) each get +25% of their base offense and defense.
-- big3_count is how many Big 3s a lineup may count: 0 (off), 1 or 2.
alter table player_catalog add column if not exists team text;
alter table settings add column if not exists big3_count integer not null default 0
  check (big3_count between 0 and 2);

-- The catalog import now carries an optional "team". A row without one
-- leaves the player's existing team alone.
create or replace function apply_catalog_import(rows jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  import_row jsonb;
  catalog_id uuid;
begin
  if not exists (select 1 from profiles where user_id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;

  for import_row in select * from jsonb_array_elements(rows)
  loop
    insert into player_catalog (name, positions, price, offense, defense, team, updated_at)
    values (
      import_row->>'name',
      (select array_agg(value::text) from jsonb_array_elements_text(import_row->'positions')),
      (import_row->>'price')::numeric,
      (import_row->>'offense')::numeric,
      (import_row->>'defense')::numeric,
      import_row->>'team',
      now()
    )
    on conflict (lower(name)) do update
      set positions = excluded.positions,
          price = excluded.price,
          offense = excluded.offense,
          defense = excluded.defense,
          team = coalesce(excluded.team, player_catalog.team),
          updated_at = now()
    returning id into catalog_id;

    update players
    set current_salary = (import_row->>'price')::numeric,
        offense = (import_row->>'offense')::numeric,
        defense = (import_row->>'defense')::numeric
    where catalog_player_id = catalog_id
      and not is_x_player;
  end loop;
end;
$$;

revoke execute on function apply_catalog_import(jsonb) from anon;

-- Team Big 3 for X Players: an X Player can be given a team and then joins
-- that team's Big 3 alongside its catalog stars (and gets the +25% too).
-- Catalog players take their team from player_catalog, so this is only set
-- on X Players.
alter table players add column if not exists team text;

-- X Pool: the game's shared list of X Players (name, team, positions, tier,
-- stats), like player_catalog is for regular players. Users add X Players
-- by picking from it; owned X Players linked by x_pool_id follow every pool
-- update, which is also how they get their Team Big 3 team. Custom X
-- Players (x_pool_id null) keep their own values.
create table if not exists x_pool (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team text not null,
  positions text[] not null,
  x_tier text not null default 'standard',
  offense numeric not null,
  defense numeric not null,
  updated_at timestamptz not null default now(),
  constraint x_pool_positions_valid check (
    coalesce(array_length(positions, 1), 0) > 0
    and positions <@ array['PG','SG','SF','PF','C']
  ),
  constraint x_pool_stats check (
    (x_tier = 'standard' and offense + defense = 450)
    or (x_tier = 'legend' and offense + defense = 500)
  )
);

create unique index if not exists x_pool_name_key on x_pool (lower(name));

alter table x_pool enable row level security;

drop policy if exists "x_pool_read" on x_pool;
create policy "x_pool_read" on x_pool
  for select using (auth.uid() is not null);

alter table players add column if not exists x_pool_id uuid references x_pool(id) on delete set null;
alter table players drop constraint if exists x_pool_link_only_x;
alter table players add constraint x_pool_link_only_x check (is_x_player or x_pool_id is null);

-- Bulk X Pool import (admins only, like apply_catalog_import). Upserts each
-- row, links any unlinked X Player with the same name (ignoring case and
-- apostrophe style) across all users, then copies the pool values onto
-- every linked X Player.
create or replace function apply_x_pool_import(rows jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  import_row jsonb;
  pool_id uuid;
  pool_name text;
begin
  if not exists (select 1 from profiles where user_id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;

  for import_row in select * from jsonb_array_elements(rows)
  loop
    pool_name := trim(import_row->>'name');

    insert into x_pool (name, team, positions, x_tier, offense, defense, updated_at)
    values (
      pool_name,
      import_row->>'team',
      (select array_agg(value::text) from jsonb_array_elements_text(import_row->'positions')),
      coalesce(import_row->>'tier', 'standard'),
      (import_row->>'offense')::numeric,
      (import_row->>'defense')::numeric,
      now()
    )
    on conflict (lower(name)) do update
      set name = excluded.name,
          team = excluded.team,
          positions = excluded.positions,
          x_tier = excluded.x_tier,
          offense = excluded.offense,
          defense = excluded.defense,
          updated_at = now()
    returning id into pool_id;

    update players
    set x_pool_id = pool_id
    where is_x_player
      and x_pool_id is null
      and lower(replace(trim(name), '’', '''')) = lower(replace(pool_name, '’', ''''));

    update players p
    set name = x.name,
        team = x.team,
        positions = x.positions,
        x_tier = x.x_tier,
        offense = x.offense,
        defense = x.defense
    from x_pool x
    where x.id = pool_id
      and p.x_pool_id = pool_id;
  end loop;
end;
$$;

revoke execute on function apply_x_pool_import(jsonb) from anon;
