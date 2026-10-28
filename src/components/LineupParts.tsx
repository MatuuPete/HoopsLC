import type { ReactNode } from 'react'
import type { Award } from '../optimizer/awards'
import type { Big3Bonus } from '../optimizer/big3'
import { X_TIERS, type Position, type XTier } from '../optimizer/types'

/** Small uppercase label used for section and field headings across the builder. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] text-muted ${className}`}>
      {children}
    </span>
  )
}

export function TierBadge({ tier }: { tier: XTier }) {
  const { label, shortLabel } = X_TIERS[tier]
  const tone =
    tier === 'legend' ? 'bg-rim text-ink border-rim' : 'border-rim/60 text-rim bg-transparent'
  return (
    <span
      title={label}
      className={`inline-flex h-4 items-center rounded-sm border px-1 font-mono text-[10px] font-semibold leading-none ${tone}`}
    >
      {shortLabel}
    </span>
  )
}

/** A season award; the tooltip names it and its stat bonus. */
export function AwardBadge({ award }: { award: Award }) {
  return (
    <span
      title={`${award.award}: +${award.offense} OFF / +${award.defense} DEF`}
      className="inline-flex h-4 shrink-0 items-center rounded-sm border border-accent/50 px-1 font-mono text-[10px] font-semibold leading-none text-accent"
    >
      {award.short}
    </span>
  )
}

/**
 * Marks a player in a Team Big 3. `bonus` is absent on saved lineups, whose
 * stats already include it.
 */
export interface Big3View {
  team: string
  bonus?: Big3Bonus
}

/** A Team Big 3 player; the tooltip names the team and the bonus. */
export function Big3Badge({ big3 }: { big3: Big3View }) {
  const bonus = big3.bonus ? `: +${big3.bonus.offense} OFF / +${big3.bonus.defense} DEF` : ''
  return (
    <span
      title={`Team Big 3 (${big3.team})${bonus}`}
      className="inline-flex h-4 shrink-0 items-center rounded-sm border border-star/50 px-1 font-mono text-[10px] font-semibold leading-none text-star"
    >
      B3
    </span>
  )
}

export interface SlotView {
  position: Position
  name: string
  xTier: XTier | null
  salary: number
  /** Offense and defense include any award and Big 3 bonus. */
  offense: number
  defense: number
  award: Award | null
  big3: Big3View | null
}

/** One position in a lineup. `lg` is the result card, `sm` the saved-lineup cards. */
export function SlotRow({ slot, size = 'lg' }: { slot: SlotView; size?: 'lg' | 'sm' }) {
  if (size === 'sm') {
    return (
      <li className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5 text-sm">
        <span className="font-mono text-xs text-muted">{slot.position}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-text">{slot.name}</span>
          {slot.xTier && <TierBadge tier={slot.xTier} />}
          {slot.award && <AwardBadge award={slot.award} />}
          {slot.big3 && <Big3Badge big3={slot.big3} />}
        </span>
        <span className="font-mono text-xs tabular-nums text-text">{slot.salary}</span>
      </li>
    )
  }

  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 py-3">
      <span className="font-display text-[28px] leading-none tracking-wide text-muted/70">
        {slot.position}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-medium text-text">{slot.name}</span>
          {slot.xTier && <TierBadge tier={slot.xTier} />}
          {slot.award && <AwardBadge award={slot.award} />}
          {slot.big3 && <Big3Badge big3={slot.big3} />}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          OFF {slot.offense} <span className="text-border">/</span> DEF {slot.defense}
        </span>
      </span>
      <span className="font-mono text-base tabular-nums text-text">{slot.salary}</span>
    </li>
  )
}

export interface BenchView {
  id: string
  name: string
  /** Every position the player can play; the bench has no slots. */
  positions: Position[]
  salary: number
  offense: number
  defense: number
  award: Award | null
  big3: Big3View | null
}

/** One bench player. `lg` is the result card, `sm` the saved-lineup cards. */
export function BenchRow({ player, size = 'lg' }: { player: BenchView; size?: 'lg' | 'sm' }) {
  const positions = player.positions.join('/')

  if (size === 'sm') {
    return (
      <li className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5 text-sm">
        <span className="font-mono text-[10px] text-muted">
          {positions}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-text/85">{player.name}</span>
          {player.award && <AwardBadge award={player.award} />}
          {player.big3 && <Big3Badge big3={player.big3} />}
        </span>
        <span className="font-mono text-xs tabular-nums text-text/85">{player.salary}</span>
      </li>
    )
  }

  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
      <span className="font-mono text-[11px] leading-tight text-muted">{positions}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-text/90">{player.name}</span>
          {player.award && <AwardBadge award={player.award} />}
          {player.big3 && <Big3Badge big3={player.big3} />}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          OFF {player.offense} <span className="text-border">/</span> DEF {player.defense}
        </span>
      </span>
      <span className="font-mono text-sm tabular-nums text-text/85">{player.salary}</span>
    </li>
  )
}

/** Header for a group of rows inside a lineup card, such as the starting five or the bench. */
export function GroupHeader({ label, count, detail }: { label: string; count?: number; detail?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-4 pb-1">
      <span className="flex items-center gap-2">
        <Eyebrow>{label}</Eyebrow>
        {count !== undefined && (
          <span className="rounded-full bg-white/[0.08] px-1.5 font-mono text-[11px] tabular-nums text-text">
            {count}
          </span>
        )}
      </span>
      {detail && <span className="font-mono text-[11px] tabular-nums text-muted">{detail}</span>}
    </div>
  )
}

/**
 * An on/off toggle. Label it with `aria-labelledby` or `aria-label`. The
 * `rim` tone is for X Player settings, matching the X tier badges.
 */
export function Switch({
  checked,
  onChange,
  tone = 'accent',
  ...aria
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  tone?: 'accent' | 'rim'
  'aria-label'?: string
  'aria-labelledby'?: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      {...aria}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        checked ? (tone === 'rim' ? 'bg-rim' : 'bg-accent') : 'bg-white/[0.12] hover:bg-white/[0.18]'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-4 w-4 rounded-full bg-text shadow-sm motion-safe:transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

/**
 * How the salary cap is spent: one segment per slot, sized by base salary, with
 * the X Player in orange and the bench as a dimmer group at the end. When the
 * lineup costs more than the cap, the bar is scaled to the lineup total and a
 * marker shows where the cap sits.
 */
export function CapStack({ slots, bench = [], cap }: { slots: SlotView[]; bench?: BenchView[]; cap: number }) {
  const startersTotal = slots.reduce((sum, s) => sum + s.salary, 0)
  const benchTotal = bench.reduce((sum, b) => sum + b.salary, 0)
  const total = startersTotal + benchTotal
  const scale = Math.max(cap, total, 1)
  const over = total > cap
  const remaining = cap - total

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Salary used</Eyebrow>
        <span className="font-mono text-sm tabular-nums">
          <span className={over ? 'text-red-400' : 'text-text'}>{total}</span>
          <span className="text-muted"> / {cap}</span>
        </span>
      </div>

      <div className="relative">
        <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-sm bg-white/[0.04]">
          {slots.map((s) => (
            <div
              key={s.position}
              title={`${s.position} · ${s.name} · ${s.salary}`}
              className={`h-full shrink ${s.xTier ? 'bg-rim' : over ? 'bg-red-400/80' : 'bg-accent'} motion-safe:transition-[flex-basis] motion-safe:duration-500`}
              style={{ flexBasis: `${(s.salary / scale) * 100}%` }}
            />
          ))}
          {bench.length > 0 && (
            <div
              className="flex h-full shrink gap-px motion-safe:transition-[flex-basis] motion-safe:duration-500"
              style={{ flexBasis: `${(benchTotal / scale) * 100}%` }}
            >
              {bench.map((b) => (
                <div
                  key={b.id}
                  title={`Bench · ${b.name} · ${b.salary}`}
                  className={`h-full ${over ? 'bg-red-400/40' : 'bg-accent/35'}`}
                  style={{ flexGrow: b.salary, flexBasis: 0 }}
                />
              ))}
            </div>
          )}
        </div>
        {over && (
          <div
            aria-hidden
            className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-text"
            style={{ left: `${(cap / scale) * 100}%` }}
          />
        )}
      </div>

      <div className="flex gap-[3px] font-mono text-[10px] text-muted">
        {slots.map((s) => (
          <span
            key={s.position}
            className="shrink overflow-hidden whitespace-nowrap"
            style={{ flexBasis: `${(s.salary / scale) * 100}%` }}
          >
            {s.position}
          </span>
        ))}
        {bench.length > 0 && (
          <span
            className="shrink overflow-hidden whitespace-nowrap"
            style={{ flexBasis: `${(benchTotal / scale) * 100}%` }}
          >
            BENCH
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
        <p className={over ? 'text-red-400' : 'text-muted'}>
          {over ? `${-remaining} over the cap` : `${remaining} left under the cap`}
        </p>
        {bench.length > 0 && (
          <p className="font-mono text-[11px] tabular-nums text-muted">
            Starters <span className="text-text">{startersTotal}</span>
            <span className="px-1.5 text-border">·</span>
            Bench <span className="text-text">{benchTotal}</span>
          </p>
        )}
      </div>
    </div>
  )
}

/** A labelled number in the totals grid under a lineup. */
export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-lg tabular-nums leading-none text-text">{value}</span>
    </div>
  )
}
