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
