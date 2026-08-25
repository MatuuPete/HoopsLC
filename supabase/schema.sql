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
