import { useState, type ReactNode } from 'react'
import { MAX_BENCH_SIZE, type ObjectiveMode, type Player } from '../optimizer/types'
import { BIG3_SIZE, MAX_BIG3_COUNT, SUPER_BIG3_SIZE, starTeam, type Big3, type Big3Mode } from '../optimizer/big3'
import type { PlayerRoleLists } from '../optimizer/playerRoles'
import { Eyebrow, Switch, TierBadge } from './LineupParts'
import { PlayerRolePicker } from './PlayerRolePicker'
import { SearchInput } from './ui'
import { SalaryCapField } from './SalaryCapField'

export interface LineupSettingsPanelProps {
  cap: number
  onCapCommit: (value: number) => void
  objectiveMode: ObjectiveMode
  onObjectiveModeChange: (mode: ObjectiveMode) => void
  offenseWeight: number
  onOffenseWeightChange: (weight: number) => void
  benchEnabled: boolean
  onBenchEnabledChange: (enabled: boolean) => void
  benchSize: number
  onBenchSizeChange: (size: number) => void
  legendEventEnabled: boolean
  onLegendEventChange: (enabled: boolean) => void
  /** How many Team Big 3s a lineup may count: 0 (off), 1 or 2. */
  /** Which Big 3 bonus the builder uses, and how many Team Big 3s count. */
  big3Mode: Big3Mode
  big3Count: number
  onBig3Change: (mode: Big3Mode, count: number) => void
  /** A locked Super Big 3 (three owned, available players); empty means the builder picks. */
  superBig3PlayerIds: string[]
  onSuperBig3Change: (playerIds: string[]) => void
  /** catalogPlayerId → team for every Team Big 3 star (see big3Stars). */
  stars: Map<string, string>
  /** Locked Team Big 3s; empty means the builder picks them. */
  teamBig3Locks: Big3[]
  onTeamBig3LocksChange: (locks: Big3[]) => void
  /** Whether any catalog player has a team yet; without teams there are no stars. */
  hasTeams: boolean
  /** Owned players not locked into a saved lineup. */
  players: Player[]
  /** Every owned player, to name a locked Super Big 3 even if one is in a saved lineup. */
  allPlayers: Player[]
  roles: PlayerRoleLists
  onRolesChange: (roles: PlayerRoleLists) => void
  /** Names of owned players hidden because a saved lineup already uses them. */
  hiddenNames: string[]
  onCalculate: () => void
}

/**
 * The lineup builder's settings column: the rules (cap, objective, bench, event) up
 * top, one player list for Start / Bench / Out picks, then Calculate.
 */
export function LineupSettingsPanel({
  cap,
  onCapCommit,
  objectiveMode,
  onObjectiveModeChange,
  offenseWeight,
  onOffenseWeightChange,
  benchEnabled,
  onBenchEnabledChange,
  benchSize,
  onBenchSizeChange,
  legendEventEnabled,
  onLegendEventChange,
  big3Mode,
  big3Count,
  onBig3Change,
  superBig3PlayerIds,
  onSuperBig3Change,
  stars,
  teamBig3Locks,
  onTeamBig3LocksChange,
  hasTeams,
  players,
  allPlayers,
  roles,
  onRolesChange,
  hiddenNames,
  onCalculate,
}: LineupSettingsPanelProps) {
  const offensePct = Math.round(offenseWeight * 100)

  return (
    <section aria-label="Lineup settings" className="rounded-xl border border-border bg-panel">
      <div className="flex flex-col gap-5 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="flex flex-col gap-2">
            <label htmlFor="salary-cap" className="flex">
              <Eyebrow>Salary cap</Eyebrow>
            </label>
            <SalaryCapField id="salary-cap" value={cap} onCommit={onCapCommit} />
          </div>
          <div className="flex flex-col gap-2">
            <Eyebrow>Optimize for</Eyebrow>
            <div
              role="radiogroup"
              aria-label="Optimize for"
              className="grid flex-1 grid-cols-2 gap-1 rounded-lg border border-border bg-bg p-1"
            >
              <SegmentButton active={objectiveMode === 'power'} onClick={() => onObjectiveModeChange('power')}>
                Max power
              </SegmentButton>
              <SegmentButton active={objectiveMode === 'stats'} onClick={() => onObjectiveModeChange('stats')}>
                Stats
              </SegmentButton>
            </div>
          </div>
        </div>

        <div className="-mt-2 flex flex-col gap-2">
          <p className="text-xs leading-relaxed text-muted">
            {objectiveMode === 'power'
              ? 'Highest total power: offense plus defense, award and Big 3 bonuses included.'
              : 'Best offense and defense, weighted by the slider.'}
          </p>
          {objectiveMode === 'stats' && (
            <div className="flex flex-col gap-1.5">
              <input
                type="range"
                min={0}
                max={100}
                aria-label="Offense weight"
                aria-valuetext={`${offensePct}% offense, ${100 - offensePct}% defense`}
                className="w-full accent-accent"
                value={offensePct}
                onChange={(e) => onOffenseWeightChange(Number(e.target.value) / 100)}
              />
              <div className="flex justify-between font-mono text-[11px] tabular-nums text-muted">
                <span>DEF {100 - offensePct}%</span>
                <span>OFF {offensePct}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span id="bench-label" className="text-sm font-medium text-text">
                Bench
              </span>
              <span className="text-xs text-muted">
                {benchEnabled
                  ? `5 starters + ${benchSize} bench, one shared cap`
                  : 'Off: starting five only'}
              </span>
            </div>
            <Switch checked={benchEnabled} onChange={onBenchEnabledChange} aria-labelledby="bench-label" />
          </div>
          {benchEnabled && (
            <div
              role="radiogroup"
              aria-label="Bench size"
              className="grid grid-cols-6 gap-1 rounded-md border border-border bg-bg p-1"
            >
              {Array.from({ length: MAX_BENCH_SIZE }, (_, i) => i + 1).map((size) => (
                <SegmentButton key={size} active={benchSize === size} onClick={() => onBenchSizeChange(size)}>
                  <span className="font-mono tabular-nums">{size}</span>
                </SegmentButton>
              ))}
            </div>
          )}
        </div>

        <LegendEventCard enabled={legendEventEnabled} onChange={onLegendEventChange} />

        <Big3Card
          mode={big3Mode}
          count={big3Count}
          onChange={onBig3Change}
          hasTeams={hasTeams}
          players={players}
          allPlayers={allPlayers}
          lockedIds={superBig3PlayerIds}
          onLockedChange={onSuperBig3Change}
          stars={stars}
          teamLocks={teamBig3Locks}
          onTeamLocksChange={onTeamBig3LocksChange}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-border p-5">
        <div className="flex flex-col gap-1">
          <Eyebrow>Players</Eyebrow>
          <p className="text-xs leading-relaxed text-muted">
            <span className="text-text/80">Start</span> keeps a player in the five
            {benchEnabled && (
              <>
                , <span className="text-text/80">Bench</span> on the bench
              </>
            )}
            , <span className="text-text/80">Out</span> leaves them out. Everyone else is picked for
            you.
          </p>
        </div>
        <PlayerRolePicker
          players={players}
          lists={roles}
          benchEnabled={benchEnabled}
          benchSize={benchSize}
          extraLegendX={legendEventEnabled}
          onChange={onRolesChange}
        />
        {hiddenNames.length > 0 && (
          <details className="group text-xs text-muted">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 hover:text-text [&::-webkit-details-marker]:hidden">
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3 transition-transform group-open:rotate-90"
                fill="none"
                aria-hidden
              >
                <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {hiddenNames.length} hidden, already in a saved lineup
            </summary>
            <p className="mt-1.5 pl-[18px] leading-relaxed">{hiddenNames.join(', ')}</p>
          </details>
        )}
      </div>

      <div className="border-t border-border p-5">
        <button
          onClick={onCalculate}
          className="w-full rounded-lg bg-text py-3 text-sm font-semibold text-bg transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-text/90"
        >
          Calculate best lineup
        </button>
      </div>
    </section>
  )
}

/**
 * The Legend X event toggle. Below it, the lineup's X Player slots: the one
 * every lineup has, and the extra Legend X slot the event unlocks.
 */
function LegendEventCard({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-3 transition-colors ${
        enabled ? 'border-rim/40 bg-rim/[0.05]' : 'border-border bg-bg/60'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span id="legend-event-label" className="text-sm font-medium text-text">
            Legend X event
          </span>
          <span className="text-xs text-muted">
            {enabled ? 'On: one X Player plus one more Legend X' : 'Off: one X Player or Legend X per lineup'}
          </span>
        </div>
        <Switch tone="rim" checked={enabled} onChange={onChange} aria-labelledby="legend-event-label" />
      </div>
      <ul aria-label="X Player slots" className="grid grid-cols-2 gap-1.5">
        <XSlot label="X slot" caption="Every lineup" active>
          <TierBadge tier="standard" />
          <span className="text-[10px] text-muted">or</span>
          <TierBadge tier="legend" />
        </XSlot>
        <XSlot label="Event slot" caption={enabled ? 'Legend X, when it helps' : 'Turn on for events'} active={enabled}>
          {enabled ? (
            <TierBadge tier="legend" />
          ) : (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-muted" fill="none" aria-label="Locked">
              <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          )}
        </XSlot>
      </ul>
    </div>
  )
}

const BIG3_MODES: { mode: Big3Mode; label: string }[] = [
  { mode: 'off', label: 'Off' },
  { mode: 'team', label: 'Team Big 3' },
  { mode: 'super', label: 'Super Big 3' },
]

/**
 * The Big 3 setting: off, Team Big 3 (three stars of one team, +25%), or
 * Super Big 3 (any three starters, +20%). Only one applies to a lineup.
 */
function Big3Card({
  mode,
  count,
  onChange,
  hasTeams,
  players,
  allPlayers,
  lockedIds,
  onLockedChange,
  stars,
  teamLocks,
  onTeamLocksChange,
}: {
  mode: Big3Mode
  count: number
  onChange: (mode: Big3Mode, count: number) => void
  hasTeams: boolean
  players: Player[]
  allPlayers: Player[]
  lockedIds: string[]
  onLockedChange: (playerIds: string[]) => void
  stars: Map<string, string>
  teamLocks: Big3[]
  onTeamLocksChange: (locks: Big3[]) => void
}) {
  const on = mode !== 'off'
  const teamCount = Math.max(1, count)
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-3 transition-colors ${
        on ? 'border-star/35 bg-star/[0.04]' : 'border-border bg-bg/60'
      }`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id="big3-label" className="flex items-center gap-1.5 text-sm font-medium text-text">
          Big 3 bonus
          <span aria-hidden className={on ? 'text-star' : 'text-muted'}>
            {mode === 'super' ? '★★' : '★'}
          </span>
        </span>
        <span className="text-xs text-muted">
          {mode === 'off'
            ? 'Off: no Big 3 bonus'
            : mode === 'team'
              ? teamCount === 1
                ? 'Three stars of one team: +25% each'
                : 'Up to two teams, three stars each: +25%'
              : 'Any three starters you choose: +20% each'}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="big3-label"
        className="grid grid-cols-3 gap-1 rounded-md border border-border bg-bg p-1"
      >
        {BIG3_MODES.map((option) => (
          <SegmentButton
            key={option.mode}
            active={mode === option.mode}
            onClick={() => onChange(option.mode, option.mode === 'team' ? teamCount : count)}
          >
            <span className="text-[13px]">{option.label}</span>
          </SegmentButton>
        ))}
      </div>

      {mode === 'team' && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span id="big3-count-label" className="text-xs text-muted">
              Big 3s per lineup
            </span>
            <div
              role="radiogroup"
              aria-labelledby="big3-count-label"
              className="grid w-28 grid-cols-2 gap-1 rounded-md border border-border bg-bg p-1"
            >
              {Array.from({ length: MAX_BIG3_COUNT }, (_, i) => i + 1).map((option) => (
                <SegmentButton key={option} active={teamCount === option} onClick={() => onChange('team', option)}>
                  <span className="font-mono tabular-nums">{option}</span>
                </SegmentButton>
              ))}
            </div>
          </div>
          {hasTeams ? (
            <TeamBig3Locker
              players={players}
              allPlayers={allPlayers}
              stars={stars}
              locks={teamLocks}
              maxCount={teamCount}
              onChange={onTeamLocksChange}
            />
          ) : (
            <p className="text-[11px] leading-relaxed text-muted">
              No teams in the catalog yet. Add a <span className="font-mono text-text/80">team</span> to each
              player in the catalog import to find each team's stars.
            </p>
          )}
        </>
      )}

      {mode === 'super' && (
        <SuperBig3Picker players={players} allPlayers={allPlayers} lockedIds={lockedIds} onChange={onLockedChange} />
      )}
    </div>
  )
}

/**
 * Which Team Big 3s the builder fields: its own pick by default, or trios
 * you lock in (one per team, up to the Big 3 count). A team's eligible
 * players are its catalog stars and its X Players.
 */
function TeamBig3Locker({
  players,
  allPlayers,
  stars,
  locks,
  maxCount,
  onChange,
}: {
  players: Player[]
  allPlayers: Player[]
  stars: Map<string, string>
  locks: Big3[]
  maxCount: number
  onChange: (locks: Big3[]) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const active = locks.slice(0, maxCount)
  const nameOf = (id: string) => allPlayers.find((p) => p.id === id)?.name ?? 'Unknown player'

  // Players you can lock into a Big 3, by team: teams with three or more you
  // own that aren't locked already.
  const byTeam = new Map<string, Player[]>()
  for (const p of players) {
    const t = starTeam(p, stars)
    if (t) byTeam.set(t, [...(byTeam.get(t) ?? []), p])
  }
  const teams = [...byTeam.entries()]
    .filter(([t, group]) => group.length >= BIG3_SIZE && !active.some((l) => l.team === t))
    .sort(([a], [b]) => a.localeCompare(b))

  function start() {
    setDraft([])
    setSearch('')
    setChoosing(true)
  }

  if (choosing) {
    // The first pick sets the team; all three must share it.
    const draftTeam = draft.length > 0 ? teams.find(([, group]) => group.some((p) => p.id === draft[0]))?.[0] : undefined
    const query = search.trim().toLowerCase()
    const visible = teams
      .map(([t, group]) => [
        t,
        group.filter((p) => query === '' || p.name.toLowerCase().includes(query) || t.toLowerCase().includes(query)),
      ] as const)
      .filter(([, group]) => group.length > 0)

    return (
      <div className="flex flex-col gap-2 rounded-md border border-border bg-bg p-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs text-text">Pick 3 players from one team</span>
          <span className="font-mono text-[11px] tabular-nums text-muted">
            {draftTeam && <span className="text-star">{draftTeam} · </span>}
            {draft.length} / {BIG3_SIZE}
          </span>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or team" label="Search players" />
        {teams.length === 0 ? (
          <p className="px-1 py-3 text-xs text-muted">
            No team has three eligible players you own and haven't locked yet.
          </p>
        ) : (
          <div className="scrollbar-slim flex max-h-64 flex-col gap-2 overflow-y-auto">
            {visible.map(([t, group]) => {
              const otherTeam = !!draftTeam && draftTeam !== t
              return (
                <section key={t} aria-label={`${t} players`}>
                  <h4
                    className={`px-2 pb-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      otherTeam ? 'text-muted/40' : 'text-star'
                    }`}
                  >
                    ★ {t}
                  </h4>
                  <ul className="flex flex-col gap-0.5">
                    {group.map((p) => {
                      const picked = draft.includes(p.id)
                      const blocked = !picked && (otherTeam || draft.length >= BIG3_SIZE)
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={picked}
                            disabled={blocked}
                            title={otherTeam ? `All three must be from ${draftTeam}` : undefined}
                            onClick={() =>
                              setDraft((current) => (picked ? current.filter((x) => x !== p.id) : [...current, p.id]))
                            }
                            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                              picked
                                ? 'bg-star/10 text-text'
                                : blocked
                                  ? 'text-muted/40'
                                  : 'text-text/85 hover:bg-white/[0.05]'
                            }`}
                          >
                            <span
                              aria-hidden
                              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] ${
                                picked ? 'border-star bg-star text-ink' : 'border-border'
                              }`}
                            >
                              {picked ? '✓' : ''}
                            </span>
                            <span className="truncate">{p.name}</span>
                            {p.xTier && <TierBadge tier={p.xTier} />}
                            <span className="ml-auto font-mono text-[11px] text-muted">{p.positions.join('/')}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
            {visible.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted">No players match.</p>}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setChoosing(false)}
            className="rounded-md px-2.5 py-1 text-xs text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={draft.length !== BIG3_SIZE || !draftTeam}
            onClick={() => {
              if (!draftTeam) return
              onChange([...active, { team: draftTeam, playerIds: draft }])
              setChoosing(false)
            }}
            className="rounded-md bg-star px-2.5 py-1 text-xs font-semibold text-ink transition-opacity disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Lock this Big 3
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {active.length > 0 ? (
        <ul aria-label="Locked Team Big 3s" className="flex flex-col gap-1.5">
          {active.map((lock) => (
            <li
              key={lock.team}
              className="flex items-center gap-2 rounded-md border border-star/40 bg-star/[0.08] px-2.5 py-1.5 text-xs text-text"
            >
              <span className="shrink-0 font-mono text-[10px] font-semibold text-star">★ {lock.team}</span>
              <span className="min-w-0 flex-1 truncate">{lock.playerIds.map(nameOf).join(' · ')}</span>
              <button
                type="button"
                onClick={() => onChange(active.filter((l) => l !== lock))}
                aria-label={`Unlock the ${lock.team} Big 3`}
                className="shrink-0 rounded px-1 text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs leading-relaxed text-muted">
          <span className="text-text/85">Suggested:</span> the builder fields the Big 3 that makes your lineup
          strongest.
        </p>
      )}
      {active.length > 0 && active.length < maxCount && (
        <p className="text-[11px] text-muted">The builder picks your other Big 3.</p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {active.length < maxCount && (
          <button
            type="button"
            onClick={start}
            className="text-text underline decoration-border underline-offset-2 hover:decoration-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {active.length === 0 ? 'Choose a Big 3' : 'Choose another Big 3'}
          </button>
        )}
        {active.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-muted underline decoration-border underline-offset-2 hover:text-text hover:decoration-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Use suggestion
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Who gets the Super Big 3: the builder's pick by default, or three
 * players you lock in. Locked players always start.
 */
function SuperBig3Picker({
  players,
  allPlayers,
  lockedIds,
  onChange,
}: {
  players: Player[]
  allPlayers: Player[]
  lockedIds: string[]
  onChange: (playerIds: string[]) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const [draft, setDraft] = useState<string[]>(lockedIds)
  const [search, setSearch] = useState('')
  const locked = lockedIds.map((id) => allPlayers.find((p) => p.id === id)).filter((p): p is Player => !!p)

  function toggle(id: string) {
    setDraft((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length < SUPER_BIG3_SIZE
          ? [...current, id]
          : current,
    )
  }

  if (choosing) {
    const query = search.trim().toLowerCase()
    const visible = players.filter((p) => query === '' || p.name.toLowerCase().includes(query))
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border bg-bg p-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs text-text">Choose 3 starters</span>
          <span className="font-mono text-[11px] tabular-nums text-muted">
            {draft.length} / {SUPER_BIG3_SIZE}
          </span>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search players" label="Search players" />
        <ul className="scrollbar-slim flex max-h-56 flex-col gap-0.5 overflow-y-auto">
          {visible.map((p) => {
            const picked = draft.includes(p.id)
            const full = !picked && draft.length >= SUPER_BIG3_SIZE
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={picked}
                  disabled={full}
                  onClick={() => toggle(p.id)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                    picked ? 'bg-star/10 text-text' : full ? 'text-muted/50' : 'text-text/85 hover:bg-white/[0.05]'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] ${
                      picked ? 'border-star bg-star text-ink' : 'border-border'
                    }`}
                  >
                    {picked ? '✓' : ''}
                  </span>
                  <span className="truncate">{p.name}</span>
                  {p.xTier && <TierBadge tier={p.xTier} />}
                  <span className="ml-auto font-mono text-[11px] text-muted">{p.positions.join('/')}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex justify-end gap-2 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => {
              setChoosing(false)
              setDraft(lockedIds)
            }}
            className="rounded-md px-2.5 py-1 text-xs text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={draft.length !== SUPER_BIG3_SIZE}
            onClick={() => {
              onChange(draft)
              setChoosing(false)
            }}
            className="rounded-md bg-star px-2.5 py-1 text-xs font-semibold text-ink transition-opacity disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Lock these 3
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {locked.length === SUPER_BIG3_SIZE ? (
        <ul aria-label="Locked Super Big 3" className="flex flex-wrap gap-1.5">
          {locked.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-1.5 rounded-full border border-star/40 bg-star/[0.08] px-2.5 py-1 text-xs text-text"
            >
              <span aria-hidden className="text-star">
                ★
              </span>
              {p.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs leading-relaxed text-muted">
          <span className="text-text/85">Suggested:</span> the builder boosts the three starters that make your
          lineup strongest under the cap.
        </p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <button
          type="button"
          onClick={() => {
            setDraft(locked.length === SUPER_BIG3_SIZE ? lockedIds : [])
            setChoosing(true)
          }}
          className="text-text underline decoration-border underline-offset-2 hover:decoration-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {locked.length === SUPER_BIG3_SIZE ? 'Change players' : 'Choose 3 players'}
        </button>
        {locked.length === SUPER_BIG3_SIZE && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-muted underline decoration-border underline-offset-2 hover:text-text hover:decoration-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Use suggestion
          </button>
        )}
      </div>
    </div>
  )
}

function XSlot({
  label,
  caption,
  active,
  children,
}: {
  label: string
  caption: string
  active: boolean
  children: ReactNode
}) {
  return (
    <li
      className={`flex flex-col gap-1 rounded-md border px-2.5 py-2 transition-colors ${
        active ? 'border-rim/35 bg-rim/[0.05]' : 'border-dashed border-border'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${active ? 'text-rim' : 'text-muted'}`}>
          {label}
        </span>
        <span className="flex items-center gap-1">{children}</span>
      </span>
      <span className="truncate text-[11px] text-muted">{caption}</span>
    </li>
  )
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        active
          ? 'bg-white/[0.09] text-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
          : 'text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}
