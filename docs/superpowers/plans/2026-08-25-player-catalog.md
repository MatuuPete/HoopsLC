# Player Catalog & Admin Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual current-salary/offense/defense entry with a shared, admin-maintained player catalog that owned players link to, fed by admin-reviewed bulk image import.

**Architecture:** A new `player_catalog` table (shared reference data) plus a `profiles.is_admin` role flag. Owned `players` rows gain a `catalog_player_id` link; a `SECURITY DEFINER` Postgres function cascades catalog price/offense/defense updates to every linked player on import. The frontend gets a catalog browse/search picker for Add Player, a lightweight base-salary-only form for catalog-linked players, and an admin-only bulk-import screen with a preview/diff step before committing.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres + Auth + RLS), Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-25-player-catalog-design.md`

## Global Constraints

- Catalog rows are keyed by name, case-insensitive, unique (`lower(name)`).
- `positions` values are restricted to `PG`, `SG`, `SF`, `PF`, `C` (from `POSITIONS` in `src/optimizer/types.ts`).
- X Players stay fully manual (fixed base/current salary of 999, offense+defense must sum to exactly 450) — no catalog involvement.
- Only pure logic gets Vitest coverage (parsing/diffing); thin Supabase wrappers and UI components are not unit-tested, matching this codebase's existing pattern (`src/optimizer/` is tested, `src/data/*Api.ts` is not).
- `regular_player_has_catalog_link` must not be added to the database until every existing non-X player row has a `catalog_player_id` (see Task 12) — adding it earlier will fail against live data.
- Every task must leave `npx tsc --noEmit` and `npm test` passing before its commit.

---

### Task 1: Database schema — profiles, player_catalog, catalog link, import function

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `README.md`

**Interfaces:**
- Produces: tables `profiles(user_id, is_admin)`, `player_catalog(id, name, positions, price, offense, defense, updated_at)`; column `players.catalog_player_id`; Postgres function `apply_catalog_import(rows jsonb) returns void`. All later tasks that touch Supabase depend on these existing in the project this app points at.

- [ ] **Step 1: Append the new schema to `supabase/schema.sql`**

Add this to the end of `supabase/schema.sql`:

```sql
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
    array_length(positions, 1) > 0
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
set search_path = public
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
    where catalog_player_id = catalog_id;
  end loop;
end;
$$;

-- Deferred: run this only after every existing non-X player has been
-- re-added through the catalog-based Add Player flow (Task 12 of
-- docs/superpowers/plans/2026-08-25-player-catalog.md). Adding it
-- earlier will fail if any regular player row still lacks a catalog
-- link.
-- alter table players add constraint regular_player_has_catalog_link
--   check (is_x_player or catalog_player_id is not null);
```

- [ ] **Step 2: Apply it to your Supabase project**

Open your Supabase project's SQL Editor and run everything you just added
in Step 1 (from `-- Admin roles` down through the end of the
`apply_catalog_import` function — leave the commented-out `alter table
... add constraint` block commented out for now).

- [ ] **Step 3: Bootstrap your own admin profile**

In the Supabase dashboard, go to Authentication → Users and copy your
user's UUID. In the SQL Editor, run:

```sql
insert into profiles (user_id, is_admin)
values ('<your-user-uuid>', true);
```

- [ ] **Step 4: Verify**

Run in the SQL Editor:

```sql
select * from profiles;
select * from player_catalog;
select column_name from information_schema.columns where table_name = 'players' and column_name = 'catalog_player_id';
```

Expected: your `profiles` row with `is_admin = true`, an empty
`player_catalog` table, and the `catalog_player_id` column present on
`players`.

- [ ] **Step 5: Update README setup instructions**

In `README.md`, after the existing step "2. Once it's provisioned, open
the SQL Editor and run the contents of `supabase/schema.sql`...", add:

```markdown
4. In the SQL Editor, run:

   ```sql
   insert into profiles (user_id, is_admin)
   values ('<your-user-uuid-from-authentication-users>', true);
   ```

   This makes your account an admin, which is required to import player
   catalog data on `/admin/catalog`.
```

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql README.md
git commit -m "feat: add player catalog schema, admin role, and bulk import function"
```

---

### Task 2: Catalog types and `parseCatalogImport`

**Files:**
- Create: `src/catalog/types.ts`
- Create: `src/catalog/parseCatalogImport.ts`
- Test: `src/catalog/parseCatalogImport.test.ts`

**Interfaces:**
- Consumes: `POSITIONS`, `Position` from `src/optimizer/types.ts`.
- Produces: `CatalogPlayer`, `CatalogImportRow` types; `parseCatalogImport(raw: string): CatalogImportRow[]` (throws `Error` with a descriptive message on any invalid input). Later tasks (3, 4, 6) import from here.

- [ ] **Step 1: Create the types file**

`src/catalog/types.ts`:

```ts
import type { Position } from '../optimizer/types'

export interface CatalogPlayer {
  id: string
  name: string
  positions: Position[]
  price: number
  offense: number
  defense: number
  updatedAt: string
}

export interface CatalogImportRow {
  name: string
  positions: Position[]
  price: number
  offense: number
  defense: number
}
```

- [ ] **Step 2: Write the failing tests**

`src/catalog/parseCatalogImport.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseCatalogImport } from './parseCatalogImport'

describe('parseCatalogImport', () => {
  it('parses a valid batch', () => {
    const raw = JSON.stringify([
      { name: 'Victor Wembanyama', positions: ['PF', 'C'], price: 2500, offense: 182, defense: 218 },
    ])
    expect(parseCatalogImport(raw)).toEqual([
      { name: 'Victor Wembanyama', positions: ['PF', 'C'], price: 2500, offense: 182, defense: 218 },
    ])
  })

  it('throws on invalid JSON', () => {
    expect(() => parseCatalogImport('not json')).toThrow('Invalid JSON')
  })

  it('throws when the top level is not an array', () => {
    expect(() => parseCatalogImport('{}')).toThrow('Expected a JSON array of players')
  })

  it('throws when a row is missing a name', () => {
    const raw = JSON.stringify([{ positions: ['PG'], price: 100, offense: 50, defense: 50 }])
    expect(() => parseCatalogImport(raw)).toThrow('Row 1: "name" must be a non-empty string')
  })

  it('throws when positions contains an invalid value', () => {
    const raw = JSON.stringify([{ name: 'Test', positions: ['ZZ'], price: 100, offense: 50, defense: 50 }])
    expect(() => parseCatalogImport(raw)).toThrow(
      'Row 1: "positions" must be a non-empty array of PG/SG/SF/PF/C',
    )
  })

  it('throws when a numeric field is negative', () => {
    const raw = JSON.stringify([{ name: 'Test', positions: ['PG'], price: -1, offense: 50, defense: 50 }])
    expect(() => parseCatalogImport(raw)).toThrow('Row 1: "price" must be a non-negative number')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `parseCatalogImport.ts` does not exist yet.

- [ ] **Step 4: Implement `parseCatalogImport`**

`src/catalog/parseCatalogImport.ts`:

```ts
import { POSITIONS, type Position } from '../optimizer/types'
import type { CatalogImportRow } from './types'

function isPosition(value: unknown): value is Position {
  return typeof value === 'string' && (POSITIONS as string[]).includes(value)
}

export function parseCatalogImport(raw: string): CatalogImportRow[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of players')
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Row ${index + 1}: expected an object`)
    }
    const row = entry as Record<string, unknown>

    if (typeof row.name !== 'string' || row.name.trim() === '') {
      throw new Error(`Row ${index + 1}: "name" must be a non-empty string`)
    }
    if (
      !Array.isArray(row.positions) ||
      row.positions.length === 0 ||
      !row.positions.every(isPosition)
    ) {
      throw new Error(`Row ${index + 1}: "positions" must be a non-empty array of PG/SG/SF/PF/C`)
    }
    for (const field of ['price', 'offense', 'defense'] as const) {
      const value = row[field]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`Row ${index + 1}: "${field}" must be a non-negative number`)
      }
    }

    return {
      name: row.name.trim(),
      positions: row.positions as Position[],
      price: row.price as number,
      offense: row.offense as number,
      defense: row.defense as number,
    }
  })
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all 6 cases.

- [ ] **Step 6: Commit**

```bash
git add src/catalog/types.ts src/catalog/parseCatalogImport.ts src/catalog/parseCatalogImport.test.ts
git commit -m "feat: add player catalog types and batch parser"
```

---

### Task 3: `diffCatalogImport`

**Files:**
- Modify: `src/catalog/types.ts`
- Create: `src/catalog/diffCatalogImport.ts`
- Test: `src/catalog/diffCatalogImport.test.ts`

**Interfaces:**
- Consumes: `CatalogImportRow`, `CatalogPlayer` from `src/catalog/types.ts` (Task 2).
- Produces: `CatalogDiffStatus`, `CatalogDiffEntry` types; `diffCatalogImport(rows: CatalogImportRow[], existing: CatalogPlayer[]): CatalogDiffEntry[]`. Used by Task 6 (`AdminCatalogPage`).

- [ ] **Step 1: Add diff types**

Add to `src/catalog/types.ts`:

```ts
export type CatalogDiffStatus = 'new' | 'changed' | 'unchanged'

export interface CatalogDiffEntry {
  row: CatalogImportRow
  status: CatalogDiffStatus
  existing: CatalogPlayer | null
}
```

- [ ] **Step 2: Write the failing tests**

`src/catalog/diffCatalogImport.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { diffCatalogImport } from './diffCatalogImport'
import type { CatalogImportRow, CatalogPlayer } from './types'

function makeCatalogPlayer(overrides: Partial<CatalogPlayer> & Pick<CatalogPlayer, 'id' | 'name'>): CatalogPlayer {
  return {
    positions: ['PG'],
    price: 100,
    offense: 50,
    defense: 50,
    updatedAt: '2026-08-25T00:00:00Z',
    ...overrides,
  }
}

function makeImportRow(overrides: Partial<CatalogImportRow> & Pick<CatalogImportRow, 'name'>): CatalogImportRow {
  return {
    positions: ['PG'],
    price: 100,
    offense: 50,
    defense: 50,
    ...overrides,
  }
}

describe('diffCatalogImport', () => {
  it('marks a row as new when no existing catalog player matches the name', () => {
    const rows = [makeImportRow({ name: 'Victor Wembanyama' })]
    const result = diffCatalogImport(rows, [])
    expect(result).toEqual([{ row: rows[0], status: 'new', existing: null }])
  })

  it('marks a row as changed when price differs', () => {
    const existing = makeCatalogPlayer({ id: '1', name: 'Victor Wembanyama', price: 2470 })
    const row = makeImportRow({ name: 'Victor Wembanyama', price: 2500 })
    const result = diffCatalogImport([row], [existing])
    expect(result).toEqual([{ row, status: 'changed', existing }])
  })

  it('marks a row as unchanged when all fields match, ignoring position order', () => {
    const existing = makeCatalogPlayer({
      id: '1',
      name: 'Victor Wembanyama',
      positions: ['C', 'PF'],
      price: 2500,
      offense: 182,
      defense: 218,
    })
    const row = makeImportRow({
      name: 'Victor Wembanyama',
      positions: ['PF', 'C'],
      price: 2500,
      offense: 182,
      defense: 218,
    })
    const result = diffCatalogImport([row], [existing])
    expect(result).toEqual([{ row, status: 'unchanged', existing }])
  })

  it('matches names case-insensitively and ignoring surrounding whitespace', () => {
    const existing = makeCatalogPlayer({ id: '1', name: 'victor wembanyama ' })
    const row = makeImportRow({ name: 'Victor Wembanyama' })
    const result = diffCatalogImport([row], [existing])
    expect(result[0].status).toBe('unchanged')
    expect(result[0].existing).toBe(existing)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `diffCatalogImport.ts` does not exist yet.

- [ ] **Step 4: Implement `diffCatalogImport`**

`src/catalog/diffCatalogImport.ts`:

```ts
import type { CatalogDiffEntry, CatalogImportRow, CatalogPlayer } from './types'

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function samePositions(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, i) => value === sortedB[i])
}

export function diffCatalogImport(rows: CatalogImportRow[], existing: CatalogPlayer[]): CatalogDiffEntry[] {
  return rows.map((row) => {
    const match = existing.find((catalogPlayer) => sameName(catalogPlayer.name, row.name))
    if (!match) {
      return { row, status: 'new', existing: null }
    }
    const unchanged =
      match.price === row.price &&
      match.offense === row.offense &&
      match.defense === row.defense &&
      samePositions(match.positions, row.positions)
    return { row, status: unchanged ? 'unchanged' : 'changed', existing: match }
  })
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all 4 cases.

- [ ] **Step 6: Commit**

```bash
git add src/catalog/types.ts src/catalog/diffCatalogImport.ts src/catalog/diffCatalogImport.test.ts
git commit -m "feat: add catalog import diff logic"
```

---

### Task 4: Catalog data-access layer

**Files:**
- Create: `src/data/catalogApi.ts`
- Create: `src/data/useCatalog.ts`

**Interfaces:**
- Consumes: `CatalogPlayer`, `CatalogImportRow` from `src/catalog/types.ts`; `supabase` from `src/lib/supabaseClient.ts`; `useAuth` from `src/auth/AuthContext.tsx`.
- Produces: `listCatalogPlayers(): Promise<CatalogPlayer[]>`, `applyCatalogImport(rows: CatalogImportRow[]): Promise<void>`, and the hook `useCatalog()` returning `{ catalog: CatalogPlayer[], loading: boolean, error: string | null, refresh: () => Promise<void>, importBatch: (rows: CatalogImportRow[]) => Promise<void> }`. Used by Task 6 (`AdminCatalogPage`) and Task 11 (`PlayersPage`).

No unit tests for this task — it's a thin Supabase wrapper, matching the untested `playersApi.ts`/`settingsApi.ts` pattern already in this codebase.

- [ ] **Step 1: Implement the API module**

`src/data/catalogApi.ts`:

```ts
import { supabase } from '../lib/supabaseClient'
import type { Position } from '../optimizer/types'
import type { CatalogImportRow, CatalogPlayer } from '../catalog/types'

interface CatalogRow {
  id: string
  name: string
  positions: Position[]
  price: number
  offense: number
  defense: number
  updated_at: string
}

function fromRow(row: CatalogRow): CatalogPlayer {
  return {
    id: row.id,
    name: row.name,
    positions: row.positions,
    price: row.price,
    offense: row.offense,
    defense: row.defense,
    updatedAt: row.updated_at,
  }
}

export async function listCatalogPlayers(): Promise<CatalogPlayer[]> {
  const { data, error } = await supabase.from('player_catalog').select('*').order('name')
  if (error) throw error
  return (data as CatalogRow[]).map(fromRow)
}

export async function applyCatalogImport(rows: CatalogImportRow[]): Promise<void> {
  const { error } = await supabase.rpc('apply_catalog_import', { rows })
  if (error) throw error
}
```

- [ ] **Step 2: Implement the hook**

`src/data/useCatalog.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import type { CatalogImportRow, CatalogPlayer } from '../catalog/types'
import { applyCatalogImport, listCatalogPlayers } from './catalogApi'
import { useAuth } from '../auth/AuthContext'

export function useCatalog() {
  const { session } = useAuth()
  const [catalog, setCatalog] = useState<CatalogPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setCatalog(await listCatalogPlayers())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load player catalog')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) refresh()
  }, [session, refresh])

  async function importBatch(rows: CatalogImportRow[]) {
    await applyCatalogImport(rows)
    await refresh()
  }

  return { catalog, loading, error, refresh, importBatch }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/catalogApi.ts src/data/useCatalog.ts
git commit -m "feat: add player catalog data-access layer"
```

---

### Task 5: Admin role plumbing

**Files:**
- Create: `src/data/profileApi.ts`
- Modify: `src/auth/AuthContext.tsx`
- Create: `src/auth/AdminRoute.tsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabaseClient.ts`.
- Produces: `getIsAdmin(userId: string): Promise<boolean>`; `AuthContextValue` gains `isAdmin: boolean`; `AdminRoute` component (props: `{ children: ReactNode }`) that redirects to `/players` when the signed-in user is not an admin. Used by Task 6 (route guard) and Task 11/NavBar (conditional nav link).

- [ ] **Step 1: Add `getIsAdmin`**

`src/data/profileApi.ts`:

```ts
import { supabase } from '../lib/supabaseClient'

export async function getIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('is_admin').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.is_admin ?? false
}
```

- [ ] **Step 2: Add `isAdmin` to `AuthContext`**

Modify `src/auth/AuthContext.tsx`:

```ts
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { getIsAdmin } from '../data/profileApi'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setIsAdmin(false)
      return
    }
    getIsAdmin(session.user.id).then(setIsAdmin)
  }, [session])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 3: Add `AdminRoute`**

`src/auth/AdminRoute.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function AdminRoute({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAuth()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/players" replace />
  return <>{children}</>
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/profileApi.ts src/auth/AuthContext.tsx src/auth/AdminRoute.tsx
git commit -m "feat: add admin role and AdminRoute guard"
```

---

### Task 6: Admin catalog import page

**Files:**
- Create: `src/pages/AdminCatalogPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/NavBar.tsx`

**Interfaces:**
- Consumes: `useCatalog` (Task 4), `parseCatalogImport` (Task 2), `diffCatalogImport` (Task 3), `CatalogDiffEntry`/`CatalogImportRow` (Tasks 2-3), `AdminRoute` (Task 5), `useAuth` (Task 5, for `isAdmin`).
- Produces: `AdminCatalogPage` component, mounted at `/admin/catalog`.

- [ ] **Step 1: Implement the page**

`src/pages/AdminCatalogPage.tsx`:

```tsx
import { useState } from 'react'
import { useCatalog } from '../data/useCatalog'
import { parseCatalogImport } from '../catalog/parseCatalogImport'
import { diffCatalogImport } from '../catalog/diffCatalogImport'
import type { CatalogDiffEntry, CatalogImportRow } from '../catalog/types'

export function AdminCatalogPage() {
  const { catalog, importBatch } = useCatalog()
  const [raw, setRaw] = useState('')
  const [diff, setDiff] = useState<CatalogDiffEntry[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  function handlePreview() {
    setParseError(null)
    setDiff(null)
    try {
      const rows = parseCatalogImport(raw)
      setDiff(diffCatalogImport(rows, catalog))
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse batch')
    }
  }

  async function handleConfirm() {
    if (!diff) return
    setImporting(true)
    setImportError(null)
    try {
      const rows: CatalogImportRow[] = diff.map((entry) => entry.row)
      await importBatch(rows)
      setDiff(null)
      setRaw('')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-2xl">
      <h1 className="text-sm uppercase tracking-widest text-muted">Catalog Admin</h1>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Batch JSON
        <textarea
          className="bg-bg border border-border px-2 py-1 text-text h-40 font-mono text-xs"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      </label>

      {parseError && <p className="text-xs text-red-400">{parseError}</p>}

      <button
        onClick={handlePreview}
        className="border border-border px-4 py-2 uppercase tracking-widest text-xs w-fit"
      >
        Preview
      </button>

      {diff && (
        <div className="border border-border bg-panel p-4 flex flex-col gap-2">
          {diff.map((entry) => (
            <div key={entry.row.name} className="flex justify-between text-sm">
              <span className={entry.status === 'unchanged' ? 'text-muted' : 'text-text'}>
                {entry.row.name} {entry.status === 'new' && '(new)'}
              </span>
              <span className="text-muted">
                {entry.existing ? `${entry.existing.price} -> ${entry.row.price}` : `${entry.row.price}`}
              </span>
            </div>
          ))}

          {importError && <p className="text-xs text-red-400">{importError}</p>}

          <button
            onClick={handleConfirm}
            disabled={importing}
            className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold w-fit disabled:opacity-50"
          >
            Confirm Import
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire the route**

Modify `src/App.tsx` — add the import and the route inside the existing
`ProtectedRoute`-wrapped route group:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AdminRoute } from './auth/AdminRoute'
import { LoginPage } from './auth/LoginPage'
import { AppLayout } from './components/AppLayout'
import { PlayersPage } from './pages/PlayersPage'
import { LineupBuilderPage } from './pages/LineupBuilderPage'
import { AdminCatalogPage } from './pages/AdminCatalogPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/players" replace />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/lineup" element={<LineupBuilderPage />} />
            <Route
              path="/admin/catalog"
              element={
                <AdminRoute>
                  <AdminCatalogPage />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 3: Add the nav link, conditionally**

Modify `src/components/NavBar.tsx`:

```tsx
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const baseLinks = [
  { to: '/players', label: 'Players' },
  { to: '/lineup', label: 'Lineup Builder' },
]

export function NavBar() {
  const { signOut, isAdmin } = useAuth()
  const links = isAdmin ? [...baseLinks, { to: '/admin/catalog', label: 'Catalog Admin' }] : baseLinks

  return (
    <nav className="flex items-center justify-between border-b border-border px-6 py-4">
      <span className="text-sm uppercase tracking-widest font-bold">HoopsLC</span>
      <div className="flex items-center gap-6">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center text-xs uppercase tracking-widest ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent mr-2" />
            {link.label}
          </NavLink>
        ))}
        <button onClick={() => signOut()} className="text-xs uppercase tracking-widest text-muted">
          Sign Out
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminCatalogPage.tsx src/App.tsx src/components/NavBar.tsx
git commit -m "feat: add admin catalog import page and route"
```

---

### Task 7: Link `Player` to the catalog

**Files:**
- Modify: `src/optimizer/types.ts`
- Modify: `src/optimizer/findBestLineup.test.ts`
- Modify: `src/data/playersApi.ts`
- Modify: `src/components/PlayerForm.tsx`

**Interfaces:**
- Produces: `Player` (and `NewPlayer = Omit<Player, 'id'>`) gains `catalogPlayerId: string | null`. Every later task that constructs a `Player`/`NewPlayer` (Tasks 9, 10, 11) must set this field.

- [ ] **Step 1: Add the field to `Player`**

Modify `src/optimizer/types.ts` — add `catalogPlayerId: string | null` to the `Player` interface:

```ts
export interface Player {
  id: string
  name: string
  position: Position
  isXPlayer: boolean
  baseSalary: number
  currentSalary: number
  offense: number
  defense: number
  catalogPlayerId: string | null
}
```

- [ ] **Step 2: Fix the existing test helper**

In `src/optimizer/findBestLineup.test.ts`, update `makePlayer`'s defaults to include the new field:

```ts
function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'position'>): Player {
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
```

- [ ] **Step 3: Run the tests to confirm they still pass**

Run: `npm test`
Expected: PASS, all existing optimizer tests still green.

- [ ] **Step 4: Map the new column in `playersApi.ts`**

Modify `src/data/playersApi.ts`:

```ts
import { supabase } from '../lib/supabaseClient'
import type { Player } from '../optimizer/types'

interface PlayerRow {
  id: string
  user_id: string
  name: string
  position: Player['position']
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
    position: row.position,
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
      position: player.position,
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
      position: player.position,
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

- [ ] **Step 5: Keep `PlayerForm` compiling**

In `src/components/PlayerForm.tsx`, add `catalogPlayerId: null` to the object passed to `onSubmit` (X Players are never catalog-linked):

```ts
      await onSubmit({
        name,
        position,
        isXPlayer,
        baseSalary: isXPlayer ? 999 : baseSalary,
        currentSalary: isXPlayer ? 999 : currentSalary,
        offense,
        defense,
        catalogPlayerId: null,
      })
```

- [ ] **Step 6: Verify the whole project compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/optimizer/types.ts src/optimizer/findBestLineup.test.ts src/data/playersApi.ts src/components/PlayerForm.tsx
git commit -m "feat: link owned players to a catalog entry"
```

---

### Task 8: Catalog browse/search picker

**Files:**
- Create: `src/components/CatalogPlayerPicker.tsx`

**Interfaces:**
- Consumes: `CatalogPlayer` (Task 2); `POSITIONS`, `Position` from `src/optimizer/types.ts`.
- Produces: `CatalogPlayerPicker` component, props `{ catalog: CatalogPlayer[], onSelect: (player: CatalogPlayer, position: Position) => void, onCancel: () => void }`. Used by Task 11 (`PlayersPage`).

- [ ] **Step 1: Implement the component**

`src/components/CatalogPlayerPicker.tsx`:

```tsx
import { useState } from 'react'
import { POSITIONS, type Position } from '../optimizer/types'
import type { CatalogPlayer } from '../catalog/types'

interface CatalogPlayerPickerProps {
  catalog: CatalogPlayer[]
  onSelect: (player: CatalogPlayer, position: Position) => void
  onCancel: () => void
}

export function CatalogPlayerPicker({ catalog, onSelect, onCancel }: CatalogPlayerPickerProps) {
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState<Position | 'ALL'>('ALL')
  const [choosingPosition, setChoosingPosition] = useState<CatalogPlayer | null>(null)

  const filtered = catalog.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(search.toLowerCase())
    const matchesPosition = positionFilter === 'ALL' || player.positions.includes(positionFilter)
    return matchesSearch && matchesPosition
  })

  function handleRowClick(player: CatalogPlayer) {
    if (player.positions.length === 1) {
      onSelect(player, player.positions[0])
    } else {
      setChoosingPosition(player)
    }
  }

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

      {choosingPosition ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">{choosingPosition.name} is eligible at:</p>
          <div className="flex gap-2">
            {choosingPosition.positions.map((position) => (
              <button
                key={position}
                onClick={() => onSelect(choosingPosition, position)}
                className="border border-border px-3 py-1 text-xs uppercase tracking-widest"
              >
                {position}
              </button>
            ))}
          </div>
          <button
            onClick={() => setChoosingPosition(null)}
            className="text-xs uppercase tracking-widest text-muted underline w-fit"
          >
            Back
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
          {filtered.map((player) => (
            <button
              key={player.id}
              onClick={() => handleRowClick(player)}
              className="flex justify-between text-sm py-1 border-b border-border text-left"
            >
              <span>{player.name}</span>
              <span className="text-muted">{player.positions.join('/')}</span>
              <span>{player.price}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CatalogPlayerPicker.tsx
git commit -m "feat: add catalog browse/search picker"
```

---

### Task 9: Base-salary-only form for catalog-linked players

**Files:**
- Create: `src/components/CatalogPlayerSalaryForm.tsx`

**Interfaces:**
- Consumes: `Position` from `src/optimizer/types.ts`.
- Produces: `CatalogPlayerSalaryForm` component, props `{ name: string, position: Position, price: number, offense: number, defense: number, initialBaseSalary?: number, onSubmit: (baseSalary: number) => Promise<void>, onCancel: () => void }`. Used by Task 11 (`PlayersPage`) for both adding a new catalog-linked player and editing an existing one's base salary.

- [ ] **Step 1: Implement the component**

`src/components/CatalogPlayerSalaryForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import type { Position } from '../optimizer/types'

interface CatalogPlayerSalaryFormProps {
  name: string
  position: Position
  price: number
  offense: number
  defense: number
  initialBaseSalary?: number
  onSubmit: (baseSalary: number) => Promise<void>
  onCancel: () => void
}

export function CatalogPlayerSalaryForm({
  name,
  position,
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
        <span className="text-muted uppercase tracking-widest">{position}</span>
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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CatalogPlayerSalaryForm.tsx
git commit -m "feat: add base-salary-only form for catalog-linked players"
```

---

### Task 10: Simplify `PlayerForm` to X Players only

**Files:**
- Modify: `src/components/PlayerForm.tsx`

**Interfaces:**
- Produces: `PlayerForm` now always submits `isXPlayer: true, catalogPlayerId: null`, dropping the X-Player toggle and the regular-player salary-cap validation branch. Task 11 uses this exclusively for the "Add X Player" / "edit X Player" flows.

- [ ] **Step 1: Replace the form with the X-only version**

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
  const [position, setPosition] = useState<Position>(initial?.position ?? 'PG')
  const [offense, setOffense] = useState(initial?.offense ?? 0)
  const [defense, setDefense] = useState(initial?.defense ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const statsValid = offense + defense === X_PLAYER_STAT_TOTAL

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!statsValid) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({
        name,
        position,
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

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Position
        <select
          className="bg-bg border border-border px-2 py-1 text-text"
          value={position}
          onChange={(e) => setPosition(e.target.value as Position)}
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

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
          disabled={submitting || !statsValid}
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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlayerForm.tsx
git commit -m "refactor: simplify PlayerForm to X Players only"
```

---

### Task 11: Wire the new Add/Edit Player flow into `PlayersPage`

**Files:**
- Modify: `src/pages/PlayersPage.tsx`

**Interfaces:**
- Consumes: `useCatalog` (Task 4), `CatalogPlayerPicker` (Task 8), `CatalogPlayerSalaryForm` (Task 9), `PlayerForm` (Task 10), `usePlayers`, `PlayerTable` (existing).

- [ ] **Step 1: Replace `PlayersPage`**

Replace the full contents of `src/pages/PlayersPage.tsx`:

```tsx
import { useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useCatalog } from '../data/useCatalog'
import { PlayerForm } from '../components/PlayerForm'
import { CatalogPlayerPicker } from '../components/CatalogPlayerPicker'
import { CatalogPlayerSalaryForm } from '../components/CatalogPlayerSalaryForm'
import { PlayerTable } from '../components/PlayerTable'
import type { Player, Position } from '../optimizer/types'
import type { CatalogPlayer } from '../catalog/types'
import type { NewPlayer } from '../data/playersApi'

type Mode =
  | { kind: 'closed' }
  | { kind: 'pick-catalog' }
  | { kind: 'add-catalog'; player: CatalogPlayer; position: Position }
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

  async function handleAddCatalogSubmit(player: CatalogPlayer, position: Position, baseSalary: number) {
    await addPlayer({
      name: player.name,
      position,
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
      position: existing.position,
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
          onSelect={(player, position) => setMode({ kind: 'add-catalog', player, position })}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      )}

      {mode.kind === 'add-catalog' && (
        <CatalogPlayerSalaryForm
          name={mode.player.name}
          position={mode.position}
          price={mode.player.price}
          offense={mode.player.offense}
          defense={mode.player.defense}
          onSubmit={(baseSalary) => handleAddCatalogSubmit(mode.player, mode.position, baseSalary)}
          onCancel={() => setMode({ kind: 'closed' })}
        />
      )}

      {mode.kind === 'edit-catalog' && (
        <CatalogPlayerSalaryForm
          name={mode.player.name}
          position={mode.player.position}
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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, all tests green.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PlayersPage.tsx
git commit -m "feat: wire catalog picker and salary-only form into Players page"
```

---

### Task 12: Manual verification, backfill, and enforce the catalog-link constraint

**Files:**
- Modify: `README.md`

**Interfaces:**
- None — this task is manual verification plus a database migration step, no new code.

- [ ] **Step 1: Run the app**

```bash
npm run dev
```

- [ ] **Step 2: Seed the catalog**

On `/admin/catalog` (visible in the nav since your account is an admin
from Task 1), paste this batch and click Preview, confirm the diff
shows 4 new players, then click Confirm Import:

```json
[
  { "name": "Victor Wembanyama", "positions": ["PF", "C"], "price": 2500, "offense": 182, "defense": 218 },
  { "name": "Shai Gilgeous-Alexander", "positions": ["PG", "SG"], "price": 2470, "offense": 254, "defense": 142 },
  { "name": "Tyrese Maxey", "positions": ["PG", "SG"], "price": 2440, "offense": 250, "defense": 142 },
  { "name": "Devin Booker", "positions": ["PG", "SG"], "price": 2260, "offense": 253, "defense": 115 }
]
```

- [ ] **Step 3: Add players from the catalog**

On `/players`, click "Add From Catalog", search for "Wembanyama", pick
him, choose PF or C, enter a base salary, and save. Confirm he appears
in the table with the price/offense/defense values from Step 2. Repeat
for at least one player at each of PG, SG, SF, PF, C (SF has no catalog
entry yet in this seed batch — use "Add X Player" for SF so you can
build a full lineup in Step 5).

- [ ] **Step 4: Verify the sync-on-import behavior**

Re-import the same batch from Step 2 but change Wembanyama's price to
`2600`. Confirm the diff shows `2500 -> 2600` for him and `unchanged`
for the other three. Confirm, then check `/players` — his row's
current salary should now read `2600` without having edited him
directly.

- [ ] **Step 5: Verify the lineup builder still works**

On `/lineup`, set a salary cap and click "Calculate Best Lineup".
Confirm it produces a result using the players you added.

- [ ] **Step 6: Backfill any pre-existing regular players**

Run in the Supabase SQL Editor:

```sql
select id, name from players where not is_x_player and catalog_player_id is null;
```

For each row returned, delete and re-add that player through "Add From
Catalog" on `/players`. If this returns zero rows, skip to Step 7.

- [ ] **Step 7: Enable the catalog-link constraint**

Confirm the query from Step 6 returns zero rows, then run in the SQL
Editor:

```sql
alter table players add constraint regular_player_has_catalog_link
  check (is_x_player or catalog_player_id is not null);
```

Expected: succeeds with no error.

- [ ] **Step 8: Update the README manual verification section**

Replace step 2 of "Manual End-to-End Verification" in `README.md` with:

```markdown
2. As an admin, go to `/admin/catalog`, paste a JSON batch of
   `{ name, positions, price, offense, defense }` rows, click Preview,
   review the diff, and click Confirm Import.
3. On `/players`, click "Add From Catalog" to add at least one player
   for each of PG, SG, SF, PF, C by browsing/searching the catalog and
   entering only a base salary; use "Add X Player" for any position not
   yet in the catalog (mix in one X Player to confirm the 999/999
   salary lock and the 450 offense+defense validation).
```

Renumber the remaining steps accordingly.

- [ ] **Step 9: Commit**

```bash
git add README.md
git commit -m "docs: update manual verification steps for the player catalog flow"
```

---

## Self-Review

**Spec coverage:**
- Roles (`profiles.is_admin`) — Task 5.
- `player_catalog` table + RLS — Task 1.
- Live-linked players via `catalog_player_id`, synced on import — Task 1 (function), Task 7 (column mapping).
- Bulk import with preview/diff before commit — Tasks 2, 3, 6.
- Add Player flow (browse/search, position choice, base-salary-only entry) — Tasks 8, 9, 11.
- X Players unchanged — Task 10 confirms the form still enforces 999/999 and the 450 split; never touches the catalog.
- Migration sequencing for the deferred constraint — Task 1 (commented SQL) and Task 12 (backfill + enable).
- Testing strategy (pure functions only) — Tasks 2, 3.

**Placeholder scan:** no TBD/TODO; every step has runnable code or exact SQL/commands.

**Type consistency:** `CatalogPlayer`/`CatalogImportRow` (Task 2) are used with the same shape in Tasks 3, 4, 6, 8, 9, 11. `Player.catalogPlayerId` (Task 7) is read in Task 11's `handleEditCatalogSubmit`/`edit-catalog` mode and written in `handleAddCatalogSubmit`/`PlayerForm`. `useCatalog()`'s return shape (Task 4) matches its usage in Tasks 6 and 11.
