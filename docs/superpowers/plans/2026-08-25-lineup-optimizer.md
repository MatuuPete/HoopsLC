# HoopsLC Lineup Optimizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite + React + TypeScript web app where a user manages their owned basketball players (with base/current salary and offense/defense stats) and computes the best possible 5-slot lineup (PG/SG/SF/PF/C) that maximizes total current salary under a user-set base salary cap, backed by Supabase (Postgres + Auth + RLS) for multi-user persistence.

**Architecture:** A single-page React app talks directly to Supabase via `@supabase/supabase-js` (no custom backend server). A pure, framework-independent TypeScript function implements the multiple-choice knapsack optimizer and is the only piece with automated tests. Auth, data access, and UI are layered on top: Supabase Auth for login, thin data-access modules wrapping Supabase queries, React hooks exposing that data to pages, and presentational components for the Players and Lineup Builder screens, styled with a custom dark/monospace Tailwind theme.

**Tech Stack:** Vite, React 18, TypeScript, React Router, Tailwind CSS, Supabase (`@supabase/supabase-js`), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-lineup-optimizer-design.md`

## Global Constraints

- Frontend is Vite + React + TypeScript; backend is Supabase (Postgres + Auth + RLS) accessed directly from the frontend — no custom server.
- Auth is Supabase Auth (email/password); every `players` and `settings` row is scoped to `user_id = auth.uid()` via RLS.
- Styling is Tailwind CSS with a custom dark theme — not default Tailwind look.
- Automated testing is Vitest, focused entirely on the optimizer core (`findBestLineup`). No UI/component tests in v1 (YAGNI, per spec).
- A lineup is always exactly 5 slots: PG, SG, SF, PF, C. No bench/flex slots.
- X Players: `base_salary` and `current_salary` are always fixed at 999; `offense + defense` must equal exactly 500. They are a distinct, separately-tagged pool (`is_x_player = true`) but still carry a position and can fill that position's slot.
- Optimization goal: maximize total `current_salary` of the 5 chosen players subject to total `base_salary` ≤ the user's cap. `offense`/`defense` do not affect which lineup is chosen in v1.
- Both salary fields are always manually entered by the user — no external/real-time salary data.

---

### Task 1: Project scaffold — Vite + React + TypeScript + Tailwind

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `postcss.config.js`
- Create: `tailwind.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable Vite dev/build setup; Tailwind theme tokens (`bg`, `panel`, `border`, `text`, `muted`, `accent` colors and `font-mono`) usable via `className` in every later UI task; a default-exported `App` component in `src/App.tsx` that later tasks will extend.

- [ ] **Step 1: Create `.gitignore`**

```
node_modules
dist
.env
.env.local
*.log
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "hoopslc",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Step 6: Create `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 7: Create `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        panel: '#111111',
        border: '#2a2a2a',
        text: '#f5f5f5',
        muted: '#8a8a8a',
        accent: '#22c55e',
      },
      fontFamily: {
        mono: [
          '"IBM Plex Mono"',
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 8: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HoopsLC — Lineup Optimizer</title>
  </head>
  <body class="bg-bg text-text font-mono">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Create `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  min-height: 100vh;
}
```

- [ ] **Step 10: Create `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 11: Create `src/App.tsx`**

```tsx
function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted uppercase tracking-widest text-sm">HoopsLC — coming online</p>
    </div>
  )
}

export default App
```

- [ ] **Step 12: Install dependencies**

Run: `npm install`
Expected: completes without errors, creates `node_modules` and `package-lock.json`.

- [ ] **Step 13: Verify the project builds and type-checks**

Run: `npm run build`
Expected: completes without TypeScript or Vite errors, produces a `dist/` folder.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts postcss.config.js tailwind.config.ts index.html .gitignore src
git commit -m "chore: scaffold Vite + React + TypeScript + Tailwind project"
```

---

### Task 2: Optimizer core — types and `findBestLineup` (TDD)

**Files:**
- Create: `src/optimizer/types.ts`
- Create: `src/optimizer/findBestLineup.ts`
- Test: `src/optimizer/findBestLineup.test.ts`

**Interfaces:**
- Consumes: nothing beyond the Task 1 scaffold (Vitest config).
- Produces: `Position`, `POSITIONS`, `Player`, `LineupSlot`, `LineupResult` (and its `LineupSuccess` / `LineupMissingPosition` / `LineupCapTooLow` variants) types, and `findBestLineup(players: Player[], salaryCap: number): LineupResult`. These are consumed by every later data/UI task (Tasks 5, 6, 8).

- [ ] **Step 1: Create `src/optimizer/types.ts`**

```ts
export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'

export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

export interface Player {
  id: string
  name: string
  position: Position
  isXPlayer: boolean
  baseSalary: number
  currentSalary: number
  offense: number
  defense: number
}

export interface LineupSlot {
  position: Position
  player: Player
}

export interface LineupSuccess {
  success: true
  slots: LineupSlot[]
  totalBaseSalary: number
  totalCurrentSalary: number
  remainingCap: number
}

export interface LineupMissingPosition {
  success: false
  reason: 'missing_position'
  missingPositions: Position[]
}

export interface LineupCapTooLow {
  success: false
  reason: 'cap_too_low'
  cheapestPossibleBaseSalary: number
}

export type LineupResult = LineupSuccess | LineupMissingPosition | LineupCapTooLow
```

- [ ] **Step 2: Write the failing test file `src/optimizer/findBestLineup.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { findBestLineup } from './findBestLineup'
import type { Player } from './types'

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'position'>): Player {
  return {
    name: overrides.id,
    isXPlayer: false,
    baseSalary: 100,
    currentSalary: 100,
    offense: 50,
    defense: 50,
    ...overrides,
  }
}

describe('findBestLineup', () => {
  it('picks the combination that maximizes total current salary under the cap', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-cheap', position: 'PG', baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'pg-expensive', position: 'PG', baseSalary: 400, currentSalary: 500 }),
      makePlayer({ id: 'sg-1', position: 'SG', baseSalary: 100, currentSalary: 120 }),
      makePlayer({ id: 'sf-1', position: 'SF', baseSalary: 100, currentSalary: 120 }),
      makePlayer({ id: 'pf-1', position: 'PF', baseSalary: 100, currentSalary: 120 }),
      makePlayer({ id: 'c-1', position: 'C', baseSalary: 100, currentSalary: 120 }),
    ]

    const result = findBestLineup(players, 900)

    expect(result.success).toBe(true)
    if (!result.success) return
    const pgSlot = result.slots.find((s) => s.position === 'PG')
    expect(pgSlot?.player.id).toBe('pg-expensive')
    expect(result.totalBaseSalary).toBe(800)
    expect(result.totalCurrentSalary).toBe(980)
    expect(result.remainingCap).toBe(100)
  })

  it('reports missing positions when a position has no eligible players', () => {
    const players: Player[] = [
      makePlayer({ id: 'sg-1', position: 'SG' }),
      makePlayer({ id: 'sf-1', position: 'SF' }),
      makePlayer({ id: 'pf-1', position: 'PF' }),
      makePlayer({ id: 'c-1', position: 'C' }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.reason).toBe('missing_position')
    expect(result.missingPositions).toEqual(['PG'])
  })

  it('reports cap_too_low when no combination fits under the cap', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', position: 'PG', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'sg-1', position: 'SG', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'sf-1', position: 'SF', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'pf-1', position: 'PF', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'c-1', position: 'C', baseSalary: 200, currentSalary: 200 }),
    ]

    const result = findBestLineup(players, 500)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.reason).toBe('cap_too_low')
    expect(result.cheapestPossibleBaseSalary).toBe(1000)
  })

  it('selects an X Player when it is the optimal choice for a slot', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-regular', position: 'PG', baseSalary: 100, currentSalary: 150 }),
      makePlayer({
        id: 'pg-x',
        position: 'PG',
        isXPlayer: true,
        baseSalary: 999,
        currentSalary: 999,
        offense: 250,
        defense: 250,
      }),
      makePlayer({ id: 'sg-1', position: 'SG', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'sf-1', position: 'SF', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'pf-1', position: 'PF', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'c-1', position: 'C', baseSalary: 50, currentSalary: 50 }),
    ]

    const result = findBestLineup(players, 1200)

    expect(result.success).toBe(true)
    if (!result.success) return
    const pgSlot = result.slots.find((s) => s.position === 'PG')
    expect(pgSlot?.player.id).toBe('pg-x')
  })

  it('breaks ties in total current salary by preferring lower total base salary, then lowest id', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-a', position: 'PG', baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pg-b', position: 'PG', baseSalary: 80, currentSalary: 100 }),
      makePlayer({ id: 'sg-1', position: 'SG', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'sf-1', position: 'SF', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'pf-1', position: 'PF', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'c-1', position: 'C', baseSalary: 50, currentSalary: 50 }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(true)
    if (!result.success) return
    const pgSlot = result.slots.find((s) => s.position === 'PG')
    expect(pgSlot?.player.id).toBe('pg-b')
    expect(result.totalBaseSalary).toBe(280)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/optimizer/findBestLineup.test.ts`
Expected: FAIL — `findBestLineup.ts` does not exist yet (module not found).

- [ ] **Step 4: Create `src/optimizer/findBestLineup.ts`**

```ts
import { POSITIONS, type Player, type LineupResult, type LineupSlot, type Position } from './types'

const CENTS = 100

function toCents(amount: number): number {
  return Math.round(amount * CENTS)
}

export function findBestLineup(players: Player[], salaryCap: number): LineupResult {
  const groups: Record<Position, Player[]> = { PG: [], SG: [], SF: [], PF: [], C: [] }
  for (const player of players) {
    groups[player.position].push(player)
  }

  const missingPositions = POSITIONS.filter((position) => groups[position].length === 0)
  if (missingPositions.length > 0) {
    return { success: false, reason: 'missing_position', missingPositions }
  }

  // Sort each group by id ascending so ties resolve to the stable, lowest-id candidate.
  for (const position of POSITIONS) {
    groups[position].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }

  const cheapestPossibleCents = POSITIONS.reduce(
    (sum, position) => sum + Math.min(...groups[position].map((p) => toCents(p.baseSalary))),
    0
  )
  const capCents = toCents(salaryCap)

  if (cheapestPossibleCents > capCents) {
    return {
      success: false,
      reason: 'cap_too_low',
      cheapestPossibleBaseSalary: cheapestPossibleCents / CENTS,
    }
  }

  // dp[c] = best { valueCents, costCents } achievable with total cost <= c using groups processed so far.
  type Cell = { valueCents: number; costCents: number }
  let dp: Cell[] = new Array(capCents + 1)
  for (let c = 0; c <= capCents; c++) dp[c] = { valueCents: 0, costCents: 0 }

  const choices: Map<number, Player>[] = []

  for (const position of POSITIONS) {
    const nextDp: Cell[] = new Array(capCents + 1)
    const choiceAtBudget = new Map<number, Player>()

    for (let c = 0; c <= capCents; c++) {
      let best: Cell = { valueCents: -1, costCents: 0 }
      let bestPlayer: Player | null = null

      for (const player of groups[position]) {
        const cost = toCents(player.baseSalary)
        if (cost > c) continue
        const prev = dp[c - cost]
        const candidateValue = prev.valueCents + toCents(player.currentSalary)
        const candidateCost = prev.costCents + cost

        const better =
          candidateValue > best.valueCents ||
          (candidateValue === best.valueCents && candidateCost < best.costCents)

        if (bestPlayer === null || better) {
          best = { valueCents: candidateValue, costCents: candidateCost }
          bestPlayer = player
        }
      }

      nextDp[c] = bestPlayer ? best : { valueCents: -1, costCents: 0 }
      if (bestPlayer) choiceAtBudget.set(c, bestPlayer)
    }

    dp = nextDp
    choices.push(choiceAtBudget)
  }

  const finalCell = dp[capCents]
  const slots: LineupSlot[] = []
  let budget = capCents

  for (let g = POSITIONS.length - 1; g >= 0; g--) {
    const player = choices[g].get(budget)
    if (!player) {
      throw new Error('Optimizer reconstruction failed: no player recorded for this budget')
    }
    slots.unshift({ position: POSITIONS[g], player })
    budget -= toCents(player.baseSalary)
  }

  const totalCurrentSalary = finalCell.valueCents / CENTS
  const totalBaseSalary = finalCell.costCents / CENTS

  return {
    success: true,
    slots,
    totalBaseSalary,
    totalCurrentSalary,
    remainingCap: salaryCap - totalBaseSalary,
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/optimizer/findBestLineup.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/optimizer
git commit -m "feat: add multiple-choice knapsack lineup optimizer"
```

---

### Task 3: Supabase backend setup

**Files:**
- Create: `supabase/schema.sql`
- Create: `src/lib/supabaseClient.ts`
- Create: `.env.example`
- Create: `README.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: `supabase` client instance exported from `src/lib/supabaseClient.ts`, read from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Consumed by every data-access task (4, 5, 7).

- [ ] **Step 1: Create `supabase/schema.sql`**

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

- [ ] **Step 2: Create `.env.example`**

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 3: Create `src/lib/supabaseClient.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 4: Create `README.md`**

```markdown
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
```

- [ ] **Step 5: Verify the project still type-checks**

Run: `npm run build`
Expected: completes without errors. (The `supabaseClient.ts` env check only runs at runtime, not at build time, so this succeeds even without a real `.env.local` yet.)

- [ ] **Step 6: Commit**

```bash
git add supabase src/lib .env.example README.md
git commit -m "feat: add Supabase schema, client, and setup docs"
```

---

### Task 4: Auth, routing, and layout shell

**Files:**
- Create: `src/auth/AuthContext.tsx`
- Create: `src/auth/LoginPage.tsx`
- Create: `src/auth/ProtectedRoute.tsx`
- Create: `src/components/NavBar.tsx`
- Create: `src/components/AppLayout.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `supabase` client (Task 3).
- Produces: `AuthProvider`, `useAuth()` returning `{ session, loading, signIn, signUp, signOut }`; `ProtectedRoute`; `NavBar`; `AppLayout` (renders `<Outlet />` inside the nav shell). App routes: `/login`, `/players`, `/lineup` (placeholders for now), `/` redirects to `/players`. Consumed by Tasks 5–9.

- [ ] **Step 1: Create `src/auth/AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

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

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut }}>
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

- [ ] **Step 2: Create `src/auth/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const action = mode === 'signin' ? signIn : signUp
    const { error: authError } = await action(email, password)
    if (authError) setError(authError)
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-text">
      <form onSubmit={handleSubmit} className="border border-border bg-panel p-6 flex flex-col gap-3 w-80">
        <h1 className="text-sm uppercase tracking-widest text-muted">
          {mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </h1>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
          Email
          <input
            type="email"
            className="bg-bg border border-border px-2 py-1 text-text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
          Password
          <input
            type="password"
            className="bg-bg border border-border px-2 py-1 text-text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold disabled:opacity-50"
        >
          {mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="text-xs uppercase tracking-widest text-muted underline"
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/auth/ProtectedRoute.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 4: Create `src/components/NavBar.tsx`**

```tsx
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const links = [
  { to: '/players', label: 'Players' },
  { to: '/lineup', label: 'Lineup Builder' },
]

export function NavBar() {
  const { signOut } = useAuth()

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

- [ ] **Step 5: Create `src/components/AppLayout.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <NavBar />
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 6: Replace `src/App.tsx`**

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { LoginPage } from './auth/LoginPage'
import { AppLayout } from './components/AppLayout'

function PlayersPagePlaceholder() {
  return <div className="p-6 text-muted">Players page coming soon.</div>
}

function LineupBuilderPagePlaceholder() {
  return <div className="p-6 text-muted">Lineup builder coming soon.</div>
}

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
            <Route path="/players" element={<PlayersPagePlaceholder />} />
            <Route path="/lineup" element={<LineupBuilderPagePlaceholder />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 7: Verify the project type-checks**

Run: `npm run build`
Expected: completes without errors.

- [ ] **Step 8: Manual verification (requires a real Supabase project)**

This step needs the Supabase project and `.env.local` from Task 3's README steps to actually be set up — if that hasn't been done yet, ask the user to complete it first, or perform it yourself if you have the credentials.

Run: `npm run dev`, open the printed URL in a browser, and confirm:
1. You're redirected to `/login`.
2. Signing up with a new email/password redirects you to `/players` and shows the placeholder text.
3. Reloading the page keeps you logged in (session persists).
4. Clicking "Sign Out" redirects back to `/login`.

- [ ] **Step 9: Commit**

```bash
git add src/auth src/components src/App.tsx
git commit -m "feat: add Supabase auth, protected routing, and layout shell"
```

---

### Task 5: Players data layer

**Files:**
- Create: `src/data/playersApi.ts`
- Create: `src/data/usePlayers.ts`

**Interfaces:**
- Consumes: `supabase` client (Task 3), `Player` type (Task 2), `useAuth()` (Task 4).
- Produces: `NewPlayer` type (`Omit<Player, 'id'>`), `listPlayers`, `createPlayer`, `updatePlayer`, `deletePlayer` in `playersApi.ts`; `usePlayers()` hook returning `{ players, loading, error, addPlayer, editPlayer, removePlayer, refresh }`. Consumed by Tasks 6, 8, 9.

- [ ] **Step 1: Create `src/data/playersApi.ts`**

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

- [ ] **Step 2: Create `src/data/usePlayers.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'
import type { Player } from '../optimizer/types'
import { createPlayer, deletePlayer, listPlayers, updatePlayer, type NewPlayer } from './playersApi'
import { useAuth } from '../auth/AuthContext'

export function usePlayers() {
  const { session } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setPlayers(await listPlayers())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) refresh()
  }, [session, refresh])

  async function addPlayer(player: NewPlayer) {
    if (!session) return
    const created = await createPlayer(player, session.user.id)
    setPlayers((prev) => [...prev, created])
  }

  async function editPlayer(id: string, player: NewPlayer) {
    const updated = await updatePlayer(id, player)
    setPlayers((prev) => prev.map((p) => (p.id === id ? updated : p)))
  }

  async function removePlayer(id: string) {
    await deletePlayer(id)
    setPlayers((prev) => prev.filter((p) => p.id !== id))
  }

  return { players, loading, error, addPlayer, editPlayer, removePlayer, refresh }
}
```

- [ ] **Step 3: Verify the project type-checks**

Run: `npm run build`
Expected: completes without errors. (Functional verification happens in Task 6 once there's a UI to exercise this hook.)

- [ ] **Step 4: Commit**

```bash
git add src/data/playersApi.ts src/data/usePlayers.ts
git commit -m "feat: add players data-access layer and usePlayers hook"
```

---

### Task 6: Players UI

**Files:**
- Create: `src/components/PlayerForm.tsx`
- Create: `src/components/PlayerTable.tsx`
- Create: `src/pages/PlayersPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `usePlayers()` (Task 5), `NewPlayer` (Task 5), `Player`/`Position` (Task 2).
- Produces: `PlayersPage`, mounted at `/players` in place of the Task 4 placeholder.

- [ ] **Step 1: Create `src/components/PlayerForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import type { NewPlayer } from '../data/playersApi'
import type { Position } from '../optimizer/types'

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

interface PlayerFormProps {
  initial?: NewPlayer
  onSubmit: (player: NewPlayer) => Promise<void>
  onCancel?: () => void
}

export function PlayerForm({ initial, onSubmit, onCancel }: PlayerFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [position, setPosition] = useState<Position>(initial?.position ?? 'PG')
  const [isXPlayer, setIsXPlayer] = useState(initial?.isXPlayer ?? false)
  const [baseSalary, setBaseSalary] = useState(initial?.baseSalary ?? 0)
  const [currentSalary, setCurrentSalary] = useState(initial?.currentSalary ?? 0)
  const [offense, setOffense] = useState(initial?.offense ?? 0)
  const [defense, setDefense] = useState(initial?.defense ?? 0)
  const [submitting, setSubmitting] = useState(false)

  const statsValid = !isXPlayer || offense + defense === 500

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!statsValid) return
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        position,
        isXPlayer,
        baseSalary: isXPlayer ? 999 : baseSalary,
        currentSalary: isXPlayer ? 999 : currentSalary,
        offense,
        defense,
      })
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

      <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted">
        <input type="checkbox" checked={isXPlayer} onChange={(e) => setIsXPlayer(e.target.checked)} />
        X Player
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Base Salary
        <input
          type="number"
          className="bg-bg border border-border px-2 py-1 text-text disabled:opacity-50"
          value={isXPlayer ? 999 : baseSalary}
          onChange={(e) => setBaseSalary(Number(e.target.value))}
          disabled={isXPlayer}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Current Salary
        <input
          type="number"
          className="bg-bg border border-border px-2 py-1 text-text disabled:opacity-50"
          value={isXPlayer ? 999 : currentSalary}
          onChange={(e) => setCurrentSalary(Number(e.target.value))}
          disabled={isXPlayer}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Offense
        <input
          type="number"
          className="bg-bg border border-border px-2 py-1 text-text"
          value={offense}
          onChange={(e) => setOffense(Number(e.target.value))}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Defense
        <input
          type="number"
          className="bg-bg border border-border px-2 py-1 text-text"
          value={defense}
          onChange={(e) => setDefense(Number(e.target.value))}
          required
        />
      </label>

      {isXPlayer && !statsValid && (
        <p className="text-xs text-red-400">Offense + Defense must equal exactly 500 for an X Player.</p>
      )}

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

- [ ] **Step 2: Create `src/components/PlayerTable.tsx`**

```tsx
import type { Player } from '../optimizer/types'

interface PlayerTableProps {
  players: Player[]
  onEdit: (player: Player) => void
  onDelete: (id: string) => void
}

export function PlayerTable({ players, onEdit, onDelete }: PlayerTableProps) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left text-muted uppercase tracking-widest text-xs border-b border-border">
          <th className="py-2">Name</th>
          <th>Pos</th>
          <th>X</th>
          <th>Base</th>
          <th>Current</th>
          <th>Off</th>
          <th>Def</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.id} className="border-b border-border">
            <td className="py-2">{p.name}</td>
            <td>{p.position}</td>
            <td>{p.isXPlayer ? 'X' : ''}</td>
            <td>{p.baseSalary}</td>
            <td>{p.currentSalary}</td>
            <td>{p.offense}</td>
            <td>{p.defense}</td>
            <td className="flex gap-2 py-2">
              <button onClick={() => onEdit(p)} className="text-xs uppercase underline">
                Edit
              </button>
              <button onClick={() => onDelete(p.id)} className="text-xs uppercase underline text-red-400">
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 3: Create `src/pages/PlayersPage.tsx`**

```tsx
import { useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { PlayerForm } from '../components/PlayerForm'
import { PlayerTable } from '../components/PlayerTable'
import type { Player } from '../optimizer/types'
import type { NewPlayer } from '../data/playersApi'

export function PlayersPage() {
  const { players, loading, error, addPlayer, editPlayer, removePlayer } = usePlayers()
  const [editing, setEditing] = useState<Player | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function handleSubmit(player: NewPlayer) {
    if (editing) {
      await editPlayer(editing.id, player)
    } else {
      await addPlayer(player)
    }
    setEditing(null)
    setShowForm(false)
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm uppercase tracking-widest text-muted">Players</h1>
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold"
        >
          Add Player
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <p className="text-muted text-sm">Loading...</p>}

      {showForm && (
        <PlayerForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
        />
      )}

      <PlayerTable
        players={players}
        onEdit={(player) => {
          setEditing(player)
          setShowForm(true)
        }}
        onDelete={removePlayer}
      />
    </div>
  )
}
```

- [ ] **Step 4: Update `src/App.tsx` to use the real `PlayersPage`**

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { LoginPage } from './auth/LoginPage'
import { AppLayout } from './components/AppLayout'
import { PlayersPage } from './pages/PlayersPage'

function LineupBuilderPagePlaceholder() {
  return <div className="p-6 text-muted">Lineup builder coming soon.</div>
}

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
            <Route path="/lineup" element={<LineupBuilderPagePlaceholder />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 5: Verify the project type-checks**

Run: `npm run build`
Expected: completes without errors.

- [ ] **Step 6: Manual verification (requires a real Supabase project)**

Run: `npm run dev`, log in, go to `/players`, and confirm:
1. "Add Player" opens the form; submitting a regular player adds it to the table.
2. Checking "X Player" disables and locks Base/Current Salary to 999, and shows a validation error if Offense+Defense ≠ 500 (blocking Save until fixed).
3. "Edit" pre-fills the form and updates the row on save.
4. "Delete" removes the row.
5. Reloading the page still shows the same players (confirms Supabase persistence).

- [ ] **Step 7: Commit**

```bash
git add src/components/PlayerForm.tsx src/components/PlayerTable.tsx src/pages/PlayersPage.tsx src/App.tsx
git commit -m "feat: add Players page with add/edit/delete UI"
```

---

### Task 7: Settings data layer (salary cap)

**Files:**
- Create: `src/data/settingsApi.ts`
- Create: `src/data/useSettings.ts`

**Interfaces:**
- Consumes: `supabase` client (Task 3), `useAuth()` (Task 4).
- Produces: `getSalaryCap`, `setSalaryCap` in `settingsApi.ts`; `useSettings()` hook returning `{ salaryCap, loading, updateSalaryCap }`. Consumed by Task 8.

- [ ] **Step 1: Create `src/data/settingsApi.ts`**

```ts
import { supabase } from '../lib/supabaseClient'

const DEFAULT_CAP = 3000

export async function getSalaryCap(): Promise<number> {
  const { data, error } = await supabase.from('settings').select('salary_cap').maybeSingle()
  if (error) throw error
  return data?.salary_cap ?? DEFAULT_CAP
}

export async function setSalaryCap(userId: string, salaryCap: number): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, salary_cap: salaryCap })
  if (error) throw error
}
```

- [ ] **Step 2: Create `src/data/useSettings.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'
import { getSalaryCap, setSalaryCap } from './settingsApi'
import { useAuth } from '../auth/AuthContext'

export function useSettings() {
  const { session } = useAuth()
  const [salaryCap, setSalaryCapState] = useState(3000)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    setSalaryCapState(await getSalaryCap())
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

  return { salaryCap, loading, updateSalaryCap }
}
```

- [ ] **Step 3: Verify the project type-checks**

Run: `npm run build`
Expected: completes without errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/settingsApi.ts src/data/useSettings.ts
git commit -m "feat: add settings data-access layer and useSettings hook"
```

---

### Task 8: Lineup Builder UI

**Files:**
- Create: `src/components/LineupResultPanel.tsx`
- Create: `src/pages/LineupBuilderPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `usePlayers()` (Task 5), `useSettings()` (Task 7), `findBestLineup` and `LineupResult` (Task 2).
- Produces: `LineupBuilderPage`, mounted at `/lineup` in place of the Task 6 placeholder.

- [ ] **Step 1: Create `src/components/LineupResultPanel.tsx`**

```tsx
import type { LineupResult } from '../optimizer/types'

export function LineupResultPanel({ result }: { result: LineupResult | null }) {
  if (!result) return null

  if (!result.success && result.reason === 'missing_position') {
    return (
      <div className="border border-border bg-panel p-4 text-sm text-red-400">
        Missing owned players for: {result.missingPositions.join(', ')}
      </div>
    )
  }

  if (!result.success && result.reason === 'cap_too_low') {
    return (
      <div className="border border-border bg-panel p-4 text-sm text-red-400">
        No lineup fits under this cap. Cheapest possible lineup costs {result.cheapestPossibleBaseSalary}{' '}
        base salary.
      </div>
    )
  }

  if (!result.success) return null

  return (
    <div className="border border-border bg-panel p-4 flex flex-col gap-3">
      {result.slots.map((slot) => (
        <div key={slot.position} className="flex justify-between text-sm">
          <span className="text-muted uppercase tracking-widest">{slot.position}</span>
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
    </div>
  )
}
```

- [ ] **Step 2: Create `src/pages/LineupBuilderPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useSettings } from '../data/useSettings'
import { findBestLineup } from '../optimizer/findBestLineup'
import type { LineupResult } from '../optimizer/types'
import { LineupResultPanel } from '../components/LineupResultPanel'

export function LineupBuilderPage() {
  const { players } = usePlayers()
  const { salaryCap, updateSalaryCap } = useSettings()
  const [capInput, setCapInput] = useState(salaryCap)
  const [result, setResult] = useState<LineupResult | null>(null)

  useEffect(() => {
    setCapInput(salaryCap)
  }, [salaryCap])

  function handleCalculate() {
    setResult(findBestLineup(players, capInput))
  }

  async function handleCapChange(value: number) {
    setCapInput(value)
    await updateSalaryCap(value)
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

      <button
        onClick={handleCalculate}
        className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold"
      >
        Calculate Best Lineup
      </button>

      <LineupResultPanel result={result} />
    </div>
  )
}
```

- [ ] **Step 3: Update `src/App.tsx` to use the real `LineupBuilderPage`**

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { LoginPage } from './auth/LoginPage'
import { AppLayout } from './components/AppLayout'
import { PlayersPage } from './pages/PlayersPage'
import { LineupBuilderPage } from './pages/LineupBuilderPage'

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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 4: Verify the project type-checks**

Run: `npm run build`
Expected: completes without errors.

- [ ] **Step 5: Manual verification (requires a real Supabase project, with players already added per Task 6)**

Run: `npm run dev`, log in, go to `/lineup`, and confirm:
1. The Salary Cap field is pre-filled from your saved settings (defaults to 3000 the first time).
2. Changing the cap and clicking "Calculate Best Lineup" shows a result panel with one player per position, totals, and remaining cap — matching what you'd expect from your owned players.
3. If you temporarily remove all players at one position (via `/players`), recalculating shows the "Missing owned players for: ..." message.
4. Setting the cap very low shows the "No lineup fits under this cap" message with a cheapest-possible reference number.

- [ ] **Step 6: Commit**

```bash
git add src/components/LineupResultPanel.tsx src/pages/LineupBuilderPage.tsx src/App.tsx
git commit -m "feat: add Lineup Builder page"
```

---

### Task 9: Visual polish — stat strip and final verification

**Files:**
- Create: `src/components/StatStrip.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `usePlayers()` (Task 5), `useSettings()` (Task 7), `AppLayout` (Task 4).
- Produces: a persistent bottom stat strip visible on every protected page.

- [ ] **Step 1: Create `src/components/StatStrip.tsx`**

```tsx
import { usePlayers } from '../data/usePlayers'
import { useSettings } from '../data/useSettings'

export function StatStrip() {
  const { players } = usePlayers()
  const { salaryCap } = useSettings()
  const totalPower = players.reduce((sum, p) => sum + p.currentSalary, 0)

  return (
    <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-panel px-6 py-2 flex gap-8 text-xs uppercase tracking-widest text-muted">
      <span>Players Owned: {players.length}</span>
      <span>Total Power: {totalPower}</span>
      <span>Salary Cap: {salaryCap}</span>
    </footer>
  )
}
```

- [ ] **Step 2: Update `src/components/AppLayout.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import { StatStrip } from './StatStrip'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg text-text pb-16">
      <NavBar />
      <Outlet />
      <StatStrip />
    </div>
  )
}
```

- [ ] **Step 3: Append a verification checklist to `README.md`**

Add this section to the end of `README.md`:

```markdown
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
```

- [ ] **Step 4: Verify the project type-checks and builds**

Run: `npm run build`
Expected: completes without errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all optimizer tests pass.

- [ ] **Step 6: Manual end-to-end verification**

Follow the checklist just added to `README.md`, using a real Supabase project. This is the final confirmation that auth, players CRUD, settings persistence, and the optimizer are correctly wired together end to end.

- [ ] **Step 7: Commit**

```bash
git add src/components/StatStrip.tsx src/components/AppLayout.tsx README.md
git commit -m "feat: add stat strip and finalize setup docs"
```
