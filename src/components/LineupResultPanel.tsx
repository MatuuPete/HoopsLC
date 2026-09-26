import { useState, type ReactNode } from 'react'
import { POSITIONS, type LineupResult, type LineupSlot, type Player } from '../optimizer/types'
import { CapStack, Eyebrow, SlotRow, Stat, type SlotView } from './LineupParts'

function toSlotView(slot: LineupSlot): SlotView {
  return {
    position: slot.position,
    name: slot.player.name,
    xTier: slot.player.xTier,
    salary: slot.player.baseSalary,
    offense: slot.player.offense,
    defense: slot.player.defense,
  }
}

function sumOffense(slots: LineupSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.player.offense, 0)
}

function sumDefense(slots: LineupSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.player.defense, 0)
}

function sumStatPower(slots: LineupSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.player.offense + slot.player.defense, 0)
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

function LineupCard({
  title,
  slots,
  cap,
  action,
}: {
  title: string
  slots: LineupSlot[]
  cap: number
  action?: ReactNode
}) {
  const views = slots
    .map(toSlotView)
    .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position))
  return (
    <section className="rounded-xl border border-border bg-panel">
      <header className="flex items-center justify-between gap-3 px-5 pt-5">
        <Eyebrow>{title}</Eyebrow>
        {action}
      </header>

      <div className="px-5 pt-4 pb-5">
        <CapStack slots={views} cap={cap} />
      </div>

      <ul className="divide-y divide-white/[0.06] border-t border-border px-5">
        {views.map((slot) => (
          <SlotRow key={slot.position} slot={slot} />
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border px-5 py-5 sm:grid-cols-4">
        <Stat label="Offense" value={sumOffense(slots)} />
        <Stat label="Defense" value={sumDefense(slots)} />
        <Stat label="TPower · salary" value={sumCurrentSalary(slots)} />
        <Stat label="TPower · stats" value={sumStatPower(slots)} />
      </div>
      <p className="border-t border-border px-5 py-3 text-[11px] text-muted">
        TPower totals exclude kits. Salaries shown are what you own each player at.
      </p>
    </section>
  )
}

/** Placeholder shown in the result column before the first calculation. */
export function LineupResultPlaceholder() {
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
      <p className="border-t border-border px-5 py-4 text-sm text-muted">
        Set your cap and preferences, then press <span className="text-text">Calculate best lineup</span>.
        The strongest five that fits will appear here.
      </p>
    </section>
  )
}

export function LineupResultPanel({ result, players, cap, onSave }: LineupResultPanelProps) {
  if (!result) return null

  if (!result.success && result.reason === 'missing_position') {
    return (
      <Notice title="Some positions are empty">
        You don't own an available player for {result.missingPositions.join(', ')}. Add one on the
        Players page, or free one up from your unavailable list or a saved lineup.
      </Notice>
    )
  }

  if (!result.success && result.reason === 'required_players_conflict') {
    const names = result.conflictingPlayerIds
      .map((id) => players.find((p) => p.id === id)?.name ?? id)
      .join(', ')
    return (
      <Notice title="Preferred players don't fit together">
        {names} can't all be in one lineup. Uncheck one of them and calculate again.
      </Notice>
    )
  }

  if (!result.success && result.reason === 'no_valid_x_slot') {
    return (
      <Notice title="No valid X Player slot">
        Every lineup needs exactly one X Player. Positions with no X Player:{' '}
        <span className="text-text">{result.positionsWithoutXPlayer.join(', ') || 'none'}</span>.
        Positions with no regular player:{' '}
        <span className="text-text">{result.positionsWithoutRegularPlayer.join(', ') || 'none'}</span>.
      </Notice>
    )
  }

  if (!result.success && result.reason === 'cap_too_low') {
    return (
      <div className="flex flex-col gap-4">
        <Notice title="No lineup fits under this cap">
          The cheapest possible lineup costs{' '}
          <span className="font-mono text-text">{result.cheapestPossibleBaseSalary}</span>. Raise the cap
          or mark fewer players as preferred.
        </Notice>
        <LineupCard title="Closest lineup" slots={result.closestLineup} cap={cap} />
      </div>
    )
  }

  if (!result.success) return null

  return (
    <LineupCard
      title="Best lineup"
      slots={result.slots}
      cap={result.totalBaseSalary + result.remainingCap}
      action={onSave && <SaveLineupButton onSave={onSave} />}
    />
  )
}
