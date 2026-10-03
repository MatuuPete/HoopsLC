import { useState } from 'react'
import type { Player } from '../optimizer/types'
import { roleOf, withRole, type PlayerRole, type PlayerRoleLists } from '../optimizer/playerRoles'
import { xPlayersFit } from '../optimizer/xRule'
import { SORT_OPTIONS, formatSortValue, sortPlayers, type SortKey } from '../lib/playerSort'
import { TierBadge } from './LineupParts'
import { PlayerSortControl, usePlayerSort } from './PlayerSortControl'

type Tab = 'all' | PlayerRole

const ROLE_LABEL: Record<PlayerRole, string> = { start: 'Start', bench: 'Bench', out: 'Out' }

const ROLE_ACTIVE: Record<PlayerRole, string> = {
  start: 'bg-accent text-ink',
  bench: 'bg-accent/25 text-accent',
  out: 'bg-red-400/20 text-red-300',
}

const ROW_TINT: Record<PlayerRole, string> = {
  start: 'bg-accent/[0.06]',
  bench: 'bg-accent/[0.03]',
  out: '',
}

const EMPTY_TAB: Record<PlayerRole, string> = {
  start: 'No one is set to start. Press Start on a player to keep them in the starting five.',
  bench: 'No one is set to the bench. Press Bench on a player to keep them on the bench.',
  out: 'No one is out. Press Out on a player to leave them out, like one a friend has borrowed.',
}

/** Sort keys whose value is worth showing on each row; the rest are already visible or self-evident. */
const SHOWN_METRICS: SortKey[] = ['power', 'offense', 'defense', 'value', 'market', 'gain']

function RoleToggle({
  player,
  role,
  roles,
  startBlocked,
  onPick,
}: {
  player: Player
  role: PlayerRole | null
  roles: PlayerRole[]
  /** Why Start is unavailable for this player, if it is. */
  startBlocked: string | null
  onPick: (role: PlayerRole | null) => void
}) {
  return (
    <div role="group" aria-label={`${player.name} role`} className="flex shrink-0 rounded-md border border-border bg-bg p-0.5">
      {roles.map((option) => {
        const active = role === option
        const blockedReason =
          option === 'bench' && player.isXPlayer
            ? 'X Players only start'
            : option === 'start' && !active
              ? startBlocked
              : null
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            disabled={blockedReason !== null}
            title={blockedReason ?? undefined}
            onClick={() => onPick(active ? null : option)}
            className={`rounded-[5px] px-2 py-1 text-[11px] font-medium leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-border ${
              active ? ROLE_ACTIVE[option] : 'text-muted hover:bg-white/[0.06] hover:text-text'
            }`}
          >
            {ROLE_LABEL[option]}
          </button>
        )
      })}
    </div>
  )
}

/**
 * One searchable list of the players you can use, where each can be set to
 * Start (always in the five), Bench (always on the bench) or Out (left out).
 * Replaces three separate checklists; a player holds one role at most.
 */
export function PlayerRolePicker({
  players,
  lists,
  benchEnabled,
  benchSize,
  extraLegendX,
  onChange,
}: {
  players: Player[]
  lists: PlayerRoleLists
  benchEnabled: boolean
  benchSize: number
  /** Legend X event on: Start allows a second X Player if one is a Legend X. */
  extraLegendX: boolean
  onChange: (lists: PlayerRoleLists) => void
}) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [sort, setSort] = usePlayerSort('lineup-players')

  const roles: PlayerRole[] = benchEnabled ? ['start', 'bench', 'out'] : ['start', 'out']
  // With the bench off, bench picks are kept but ignored, so they show as unset.
  const visibleRole = (p: Player) => {
    const role = roleOf(lists, p.id)
    return role && roles.includes(role) ? role : null
  }
  const activeTab: Tab = tab === 'all' || roles.includes(tab) ? tab : 'all'

  const counts = { start: 0, bench: 0, out: 0 }
  for (const p of players) {
    const role = visibleRole(p)
    if (role) counts[role]++
  }

  const query = search.trim().toLowerCase()
  const shown = sortPlayers(
    players.filter((p) => (activeTab === 'all' || visibleRole(p) === activeTab) && p.name.toLowerCase().includes(query)),
    sort,
  )
  const metric = SHOWN_METRICS.includes(sort.key) ? (sort.key as Exclude<SortKey, 'name'>) : null

  // Start is blocked on any X Player that wouldn't fit beside the X Players already starting.
  const startingX = players.filter((p) => p.isXPlayer && roleOf(lists, p.id) === 'start')
  const startLimit = extraLegendX ? 'Start allows one X Player plus one Legend X' : 'Only one X Player can start'
  const startBlockedFor = (p: Player) =>
    p.isXPlayer && !startingX.includes(p) && !xPlayersFit([...startingX, p], extraLegendX) ? startLimit : null

  function clearTab(role: PlayerRole) {
    let next = lists
    for (const p of players) if (visibleRole(p) === role) next = withRole(next, p.id, null)
    onChange(next)
  }

  const tabs: { id: Tab; label: string; count: string; over?: boolean }[] = [
    { id: 'all', label: 'All', count: String(players.length) },
    ...roles.map((role) => ({
      id: role,
      label: ROLE_LABEL[role],
      count: role === 'bench' ? `${counts.bench}/${benchSize}` : String(counts[role]),
      over: role === 'bench' && counts.bench > benchSize,
    })),
  ]

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex items-center gap-2 border-b border-border px-3">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-muted" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          aria-label="Search players"
          className="w-full bg-transparent py-2.5 text-sm text-text placeholder:text-muted/70 focus:outline-none"
          placeholder="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {activeTab !== 'all' && counts[activeTab] > 0 && (
          <button
            type="button"
            onClick={() => clearTab(activeTab)}
            className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Clear {counts[activeTab]}
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Filter players" className="flex border-b border-border px-1.5">
        {tabs.map((t) => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                active ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {t.label}
              <span className={`font-mono text-[11px] tabular-nums ${t.over ? 'text-red-400' : active ? 'text-text/80' : 'text-muted'}`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center border-b border-border px-3 py-2">
        <PlayerSortControl sort={sort} onChange={setSort} className="w-full justify-between" />
      </div>

      <ul className="scrollbar-slim flex max-h-80 flex-col gap-px overflow-y-auto p-1.5">
        {players.length === 0 && <li className="px-2.5 py-2 text-sm text-muted">No owned players available.</li>}
        {players.length > 0 && shown.length === 0 && (
          <li className="px-2.5 py-3 text-sm leading-relaxed text-muted">
            {query ? `No players match “${search.trim()}”.` : activeTab !== 'all' ? EMPTY_TAB[activeTab] : null}
          </li>
        )}
        {shown.map((p) => {
          const role = visibleRole(p)
          return (
            <li
              key={p.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2.5 py-1.5 ${role ? ROW_TINT[role] : ''}`}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`truncate text-sm ${role === 'out' ? 'text-muted line-through decoration-muted/60' : 'text-text'}`}>
                    {p.name}
                  </span>
                  {p.xTier && <TierBadge tier={p.xTier} />}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-muted">
                  {p.positions.join('/')}
                  {!p.isXPlayer && (
                    <>
                      <span className="px-1 text-border">·</span>
                      {p.baseSalary}
                    </>
                  )}
                  {metric && (
                    <>
                      <span className="px-1 text-border">·</span>
                      <span className="text-text/80">
                        {SORT_OPTIONS[metric].short} {formatSortValue(p, metric)}
                      </span>
                    </>
                  )}
                </span>
              </span>
              <RoleToggle
                player={p}
                role={role}
                roles={roles}
                startBlocked={startBlockedFor(p)}
                onPick={(next) => onChange(withRole(lists, p.id, next))}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
