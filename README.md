# HoopsLC — Lineup Optimizer

A dark, terminal-styled web app for picking the best 5-player basketball
lineup (PG/SG/SF/PF/C) from the players you own, maximizing total power
(current salary) under a salary cap you set.

## Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) account

## 1. Create a Supabase project

1. Go to https://supabase.com/dashboard and create a new project.
2. Once it's provisioned, open the SQL Editor and run the contents of
   `supabase/schema.sql` to create the `players` and `settings` tables
   with row-level security enabled.
3. Go to Project Settings → API. Copy the "Project URL" and the
   "anon public" API key.

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values from step 1:

```
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Install and run

```
npm install
npm run dev
```

Open the printed local URL. You'll be redirected to the login page —
sign up with any email/password to create your account (Supabase's
default project settings do not require email confirmation for new
projects created for development; if your project has confirmation
enabled, check your inbox).

## Testing

```
npm test
```

Runs the Vitest suite (currently covers the lineup optimizer core).

## Project structure

- `src/optimizer/` — pure lineup-optimization logic, fully unit tested.
- `src/lib/supabaseClient.ts` — Supabase client setup.
- `src/data/` — data-access modules and hooks wrapping Supabase queries.
- `src/auth/` — authentication context, login page, route protection.
- `src/pages/` — top-level pages (Players, Lineup Builder).
- `src/components/` — shared UI components (nav, layout, forms, tables).
- `supabase/schema.sql` — database schema and RLS policies.

## Manual End-to-End Verification

After setup, verify the full flow works:

1. Sign up a new account at `/login`.
2. On `/players`, add at least one player for each of PG, SG, SF, PF, C
   (mix in one X Player to confirm the 999/999 salary lock and the
   500 offense+defense validation).
3. On `/lineup`, set a salary cap, click "Calculate Best Lineup", and
   confirm the result panel shows one player per position with correct
   totals, and the bottom stat strip reflects your player count and
   total power.
4. Edit and delete a player on `/players`, then recalculate the lineup
   on `/lineup` to confirm it reflects the change.
5. Sign out and back in to confirm your data persists.
