import { useState, type ReactNode } from 'react'
import { awardFor, effectiveDefense, effectiveOffense } from '../optimizer/awards'
import { big3BonusMap, sameBig3, superBig3Bonus, type Big3, type Big3Bonus, type Big3Tag } from '../optimizer/big3'
import { POSITIONS, type LineupResult, type LineupSlot, type Player } from '../optimizer/types'
import {
  BenchRow,
  CapStack,
  Eyebrow,
  GroupHeader,
  SlotRow,
  Stat,
  type BenchView,
  type SlotView,
} from './LineupParts'

/** Offense, defense and badges for one player, Team Big 3 bonus included. */
function playerStats(player: Player, tag: Big3Tag | undefined) {
  return {
    offense: effectiveOffense(player) + (tag?.offense ?? 0),
    defense: effectiveDefense(player) + (tag?.defense ?? 0),
    award: awardFor(player.name),
    big3: tag ? { team: tag.team, bonus: { offense: tag.offense, defense: tag.defense } } : null,
  }
}

function toSlotView(slot: LineupSlot, tags: Map<string, Big3Tag>, superIds: Set<string>): SlotView {
  const stats = playerStats(slot.player, tags.get(slot.player.id))
  const bonus: Big3Bonus | null = superIds.has(slot.player.id) ? superBig3Bonus(slot.player) : null
  return {
    position: slot.position,
    name: slot.player.name,
    xTier: slot.player.xTier,
    salary: slot.player.baseSalary,
    ...stats,
    offense: stats.offense + (bonus?.offense ?? 0),
    defense: stats.defense + (bonus?.defense ?? 0),
    superBig3: bonus ? { bonus } : null,
  }
}

function toBenchView(player: Player, tags: Map<string, Big3Tag>): BenchView {
  return {
    id: player.id,
    name: player.name,
    positions: player.positions,
    salary: player.baseSalary,
    ...playerStats(player, tags.get(player.id)),
  }
}

function sumCurrentSalary(slots: LineupSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.player.currentSalary, 0)
}

interface LineupResultPanelProps {
  result: LineupResult | null
  players: Player[]
  /** The salary cap the result was calculated against. */
  cap: number
  onSave?: () => Promise<void>
  /** Whether the Super Big 3 in the result is one the user locked, not the builder's pick. */
  superBig3Locked?: boolean
  /** Locks the builder's Super Big 3 pick, shown as a button on the result. */
  onLockSuperBig3?: (playerIds: string[]) => Promise<void>
  /** Team Big 3s the user has locked, so the result can mark them. */
  lockedBig3?: Big3[]
  /** Locks one of the builder's Team Big 3s, shown as a button on its line. */
  onLockBig3?: (big3: Big3) => Promise<void>
}

function SaveLineupButton({ onSave }: { onSave: () => Promise<void> }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleClick() {
    setStatus('saving')
    setSaveError(null)
    try {
      await onSave()
      setStatus('saved')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save lineup')
      setStatus('idle')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={status !== 'idle'}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:border-muted hover:bg-white/5 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:border-border disabled:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save lineup'}
      </button>
      {saveError && <p className="text-xs text-red-400">{saveError}</p>}
    </div>
  )
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-red-400/25 bg-red-400/[0.05] p-5">
      <p className="text-sm font-semibold text-red-300">{title}</p>
      <div className="mt-1.5 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  )
}

/** The Team Big 3s a lineup fields, one line per team with its three players. */
function Big3Strip({
  big3s,
  players,
  locked,
  onLock,
}: {
  big3s: Big3[]
  players: Player[]
  locked: Big3[]
  onLock?: (big3: Big3) => Promise<void>
}) {
  return (
    <ul aria-label="Team Big 3" className="flex flex-col gap-1.5 border-t border-border bg-star/[0.04] px-5 py-3">
      {big3s.map((big3) => (
        <Big3Line
          key={big3.team}
          big3={big3}
          players={players}
          locked={locked.some((l) => sameBig3(l, big3))}
          onLock={onLock}
        />
      ))}
    </ul>
  )
}

/** One Team Big 3 in the result, with a button to lock it as the user's own. */
function Big3Line({
  big3,
  players,
  locked,
  onLock,
}: {
  big3: Big3
  players: Player[]
  locked: boolean
  onLock?: (big3: Big3) => Promise<void>
}) {
  const [status, setStatus] = useState<'idle' | 'locking' | 'locked'>(locked ? 'locked' : 'idle')
  async function lock() {
    if (!onLock) return
    setStatus('locking')
    try {
      await onLock(big3)
      setStatus('locked')
    } catch {
      setStatus('idle')
    }
  }
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
      <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-star">
        ★ Big 3 · {big3.team}
      </span>
      <span className="min-w-0 flex-1 truncate text-text/85">
        {big3.playerIds.map((id) => players.find((p) => p.id === id)?.name ?? id).join(', ')}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-muted">+25%</span>
      {status === 'locked' ? (
        <span className="rounded-sm border border-star/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-star">
          Locked
        </span>
      ) : (
        onLock && (
          <button
            type="button"
            onClick={lock}
            disabled={status === 'locking'}
            className="rounded-md border border-star/50 px-2 py-1 text-[11px] font-medium text-star transition-colors hover:bg-star/10 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {status === 'locking' ? 'Locking…' : 'Lock this Big 3'}
          </button>
        )
      )}
    </li>
  )
}

/** The Super Big 3 a lineup fields, with a button to lock the builder's pick. */
function SuperBig3Strip({
  playerIds,
  players,
  locked,
  onLock,
}: {
  playerIds: string[]
  players: Player[]
  locked: boolean
  onLock?: (playerIds: string[]) => Promise<void>
}) {
  const [status, setStatus] = useState<'idle' | 'locking' | 'locked'>(locked ? 'locked' : 'idle')
  async function lock() {
    if (!onLock) return
    setStatus('locking')
    try {
      await onLock(playerIds)
      setStatus('locked')
    } catch {
      setStatus('idle')
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-star/[0.06] px-5 py-3 text-xs">
      <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-star">
        ★★ Super Big 3
      </span>
      <span className="min-w-0 flex-1 truncate text-text/85">
        {playerIds.map((id) => players.find((p) => p.id === id)?.name ?? id).join(', ')}
      </span>
      <span className="font-mono text-[11px] text-muted">+20%</span>
      {status === 'locked' ? (
        <span className="rounded-sm border border-star/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-star">
          Locked
        </span>
      ) : (
        onLock && (
          <button
            type="button"
            onClick={lock}
            disabled={status === 'locking'}
            className="rounded-md border border-star/50 px-2 py-1 text-[11px] font-medium text-star transition-colors hover:bg-star/10 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {status === 'locking' ? 'Locking…' : 'Lock these 3'}
          </button>
        )
      )}
    </div>
  )
}

function LineupCard({
  title,
  slots,
  bench,
  big3s = [],
  superBig3 = [],
  superBig3Locked = false,
  onLockSuperBig3,
  lockedBig3 = [],
  onLockBig3,
  cap,
  action,
}: {
  title: string
  slots: LineupSlot[]
  bench: Player[]
  big3s?: Big3[]
  superBig3?: string[]
  superBig3Locked?: boolean
  onLockSuperBig3?: (playerIds: string[]) => Promise<void>
  lockedBig3?: Big3[]
  onLockBig3?: (big3: Big3) => Promise<void>
  cap: number
  action?: ReactNode
}) {
  const fielded = [...slots.map((s) => s.player), ...bench]
  const tags = big3BonusMap(big3s, fielded)
  const superIds = new Set(superBig3)
  const views = slots
    .map((slot) => toSlotView(slot, tags, superIds))
    .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position))
  const benchViews = bench
    .map((player) => toBenchView(player, tags))
    .sort((a, b) => b.offense + b.defense - (a.offense + a.defense))
  const hasBench = benchViews.length > 0
  // Offense, defense and TPower by stats are team totals: starters plus bench.
  const starterOffense = views.reduce((sum, v) => sum + v.offense, 0)
  const starterDefense = views.reduce((sum, v) => sum + v.defense, 0)
  const benchOffense = benchViews.reduce((sum, b) => sum + b.offense, 0)
  const benchDefense = benchViews.reduce((sum, b) => sum + b.defense, 0)
  const split = (starters: number, benchTotal: number): [number, number] | undefined =>
    hasBench ? [starters, benchTotal] : undefined
  return (
    <section className="rounded-xl border border-border bg-panel">
      <header className="flex items-center justify-between gap-3 px-5 pt-5">
        <span className="flex items-center gap-2">
          <Eyebrow>{title}</Eyebrow>
          {hasBench && (
            <span className="rounded-sm border border-border px-1.5 py-px font-mono text-[10px] tabular-nums text-muted">
              5 + {benchViews.length}
            </span>
          )}
        </span>
        {action}
      </header>

      <div className="px-5 pt-4 pb-5">
        <CapStack slots={views} bench={benchViews} cap={cap} />
      </div>

      {big3s.length > 0 && <Big3Strip big3s={big3s} players={fielded} locked={lockedBig3} onLock={onLockBig3} />}
      {superBig3.length > 0 && (
        <SuperBig3Strip
          playerIds={superBig3}
          players={fielded}
          locked={superBig3Locked}
          onLock={onLockSuperBig3}
        />
      )}

      <div className="border-t border-border px-5">
        {hasBench && <GroupHeader label="Starting five" />}
        <ul className="divide-y divide-white/[0.06]">
          {views.map((slot) => (
            <SlotRow key={slot.position} slot={slot} />
          ))}
        </ul>
      </div>

      {hasBench && (
        <div className="border-t border-border bg-white/[0.015] px-5 pb-2">
          <GroupHeader
            label="Bench"
            count={benchViews.length}
            detail={
              <>
                OFF {benchViews.reduce((sum, b) => sum + b.offense, 0)}{' '}
                <span className="text-border">/</span> DEF{' '}
                {benchViews.reduce((sum, b) => sum + b.defense, 0)}
              </>
            }
          />
          <ul className="divide-y divide-white/[0.05]">
            {benchViews.map((player) => (
              <BenchRow key={player.id} player={player} />
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border px-5 py-5 sm:grid-cols-4">
        <Stat label="Offense" value={starterOffense + benchOffense} split={split(starterOffense, benchOffense)} />
        <Stat label="Defense" value={starterDefense + benchDefense} split={split(starterDefense, benchDefense)} />
        <Stat label="TPower · salary" value={sumCurrentSalary(slots)} />
        <Stat
          label="TPower · stats"
          value={starterOffense + starterDefense + benchOffense + benchDefense}
          split={split(starterOffense + starterDefense, benchOffense + benchDefense)}
        />
      </div>
      <p className="border-t border-border px-5 py-3 text-[11px] text-muted">
        {hasBench &&
          'Offense, defense and TPower · stats are team totals (starters + bench); TPower · salary is the starting five. '}
        Offense and defense include award{big3s.length > 0 || superBig3.length > 0 ? ' and Big 3' : ''} bonuses. TPower totals exclude kits. Salaries shown are
        what you own each player at.
      </p>
    </section>
  )
}

/** Placeholder shown in the result column before the first calculation. */
export function LineupResultPlaceholder({ benchSize }: { benchSize: number }) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-panel/40">
      <header className="px-5 pt-5">
        <Eyebrow>Best lineup</Eyebrow>
      </header>
      <ul className="divide-y divide-white/[0.04] px-5 py-2">
        {POSITIONS.map((position) => (
          <li key={position} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3 py-3">
            <span className="font-display text-[28px] leading-none tracking-wide text-border">
              {position}
            </span>
            <span className="h-2 w-2/5 rounded-sm bg-white/[0.04]" />
          </li>
        ))}
      </ul>
      {benchSize > 0 && (
        <div className="border-t border-dashed border-border px-5 pb-4">
          <GroupHeader label="Bench" count={benchSize} />
          <ul className="flex flex-col gap-3 pt-2">
            {Array.from({ length: benchSize }, (_, i) => (
              <li key={i} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3">
                <span className="h-1.5 w-6 rounded-sm bg-white/[0.04]" />
                <span className="h-1.5 w-1/3 rounded-sm bg-white/[0.04]" />
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="border-t border-border px-5 py-4 text-sm text-muted">
        Set your cap and preferences, then press <span className="text-text">Calculate best lineup</span>.
        {benchSize > 0
          ? ` The strongest five that fits, plus a ${benchSize}-player bench, will appear here.`
          : ' The strongest five that fits will appear here.'}
      </p>
    </section>
  )
}

export function LineupResultPanel({
  result,
  players,
  cap,
  onSave,
  superBig3Locked = false,
  onLockSuperBig3,
  lockedBig3 = [],
  onLockBig3,
}: LineupResultPanelProps) {
  if (!result) return null

  if (!result.success && result.reason === 'big3_locked_unavailable') {
    const names = result.playerIds.map((id) => players.find((p) => p.id === id)?.name ?? id).join(', ')
    return (
      <Notice title="Your locked Big 3 can't be fielded">
        {names} {result.playerIds.length === 1 ? 'is' : 'are'} set to Out, already in a saved lineup, or no longer
        able to join that team's Big 3. Choose another Big 3, or switch back to the suggestion.
      </Notice>
    )
  }

  if (!result.success && result.reason === 'super_big3_unavailable') {
    const names = result.playerIds.map((id) => players.find((p) => p.id === id)?.name ?? id).join(', ')
    return (
      <Notice title="Your locked Super Big 3 can't play">
        {names} {result.playerIds.length === 1 ? 'is' : 'are'} set to Out or already in a saved lineup. Choose
        another player for your Super Big 3, or switch back to the suggestion.
      </Notice>
    )
  }

  if (!result.success && result.reason === 'missing_position') {
    return (
      <Notice title="Some positions are empty">
        You don't own an available player for {result.missingPositions.join(', ')}. Add one on the
        Players page, or free one up from the players you set to Out or a saved lineup.
      </Notice>
    )
  }

  if (!result.success && result.reason === 'required_players_conflict') {
    const names = result.conflictingPlayerIds
      .map((id) => players.find((p) => p.id === id)?.name ?? id)
      .join(', ')
    return (
      <Notice title="Your picks don't fit together">
        {names} can't all be in one lineup. Clear Start or Bench on one of them and calculate again.
      </Notice>
    )
  }

  if (!result.success && result.reason === 'x_players_conflict') {
    const names = result.conflictingPlayerIds
      .map((id) => players.find((p) => p.id === id)?.name ?? id)
      .join(', ')
    return (
      <Notice title="Too many X Players set to Start">
        {names} are all set to Start, but{' '}
        {result.extraLegendX
          ? 'during a Legend X event a lineup fields one X Player plus one Legend X at most.'
          : 'a lineup fields one X Player. Turn on the Legend X event to add a second Legend X.'}{' '}
        Clear Start on one of them and calculate again.
      </Notice>
    )
  }

  if (!result.success && result.reason === 'no_valid_x_slot') {
    return (
      <Notice title="No valid X Player slot">
        Every lineup needs an X Player. Positions with no X Player:{' '}
        <span className="text-text">{result.positionsWithoutXPlayer.join(', ') || 'none'}</span>.
        Positions with no regular player:{' '}
        <span className="text-text">{result.positionsWithoutRegularPlayer.join(', ') || 'none'}</span>.
      </Notice>
    )
  }

  if (!result.success && result.reason === 'bench_preferred_overflow') {
    return (
      <Notice title="Too many players set to Bench">
        You set {result.preferredCount} players to Bench, but the bench has {result.benchSize} spot
        {result.benchSize === 1 ? '' : 's'}. Clear some, or make the bench bigger.
      </Notice>
    )
  }

  if (!result.success && result.reason === 'bench_too_small') {
    const { requestedBenchSize, maxBenchSize } = result
    return (
      <Notice title="Not enough players for the bench">
        You asked for a {requestedBenchSize}-player bench, but after the starting five{' '}
        {maxBenchSize === 0
          ? 'no regular players are left'
          : `only ${maxBenchSize} regular player${maxBenchSize === 1 ? ' is' : 's are'} left`}
        . X Players can't sit on the bench. Pick a smaller bench, or free up players you set to Out
        or used in a saved lineup.
      </Notice>
    )
  }

  if (!result.success && result.reason === 'cap_too_low') {
    const benchSize = result.closestBench.length
    return (
      <div className="flex flex-col gap-4">
        <Notice title="No lineup fits under this cap">
          The cheapest possible lineup{benchSize > 0 && ` with a ${benchSize}-player bench`} costs{' '}
          <span className="font-mono text-text">{result.cheapestPossibleBaseSalary}</span>. Raise the cap
          {benchSize > 0 ? ', shrink the bench' : ''} or set fewer players to Start or Bench.
        </Notice>
        <LineupCard title="Closest lineup" slots={result.closestLineup} bench={result.closestBench} cap={cap} />
      </div>
    )
  }

  if (!result.success) return null

  return (
    <LineupCard
      title="Best lineup"
      slots={result.slots}
      bench={result.bench}
      big3s={result.big3s}
      superBig3={result.superBig3}
      superBig3Locked={superBig3Locked}
      onLockSuperBig3={onLockSuperBig3}
      lockedBig3={lockedBig3}
      onLockBig3={onLockBig3}
      cap={result.totalBaseSalary + result.remainingCap}
      action={onSave && <SaveLineupButton onSave={onSave} />}
    />
  )
}
