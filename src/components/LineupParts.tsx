import type { ReactNode } from 'react'
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

export interface SlotView {
  position: Position
  name: string
  xTier: XTier | null
  salary: number
  offense: number
  defense: number
}

/** One position in a lineup. `lg` is the result card, `sm` the saved-lineup cards. */
export function SlotRow({ slot, size = 'lg' }: { slot: SlotView; size?: 'lg' | 'sm' }) {
  if (size === 'sm') {
    return (
      <li className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5 text-sm">
        <span className="font-mono text-xs text-muted">{slot.position}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-text">{slot.name}</span>
          {slot.xTier && <TierBadge tier={slot.xTier} />}
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
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          OFF {slot.offense} <span className="text-border">/</span> DEF {slot.defense}
        </span>
      </span>
      <span className="font-mono text-base tabular-nums text-text">{slot.salary}</span>
    </li>
  )
}

/**
 * How the salary cap is spent: one segment per slot, sized by base salary, with
 * the X Player in orange. When the lineup costs more than the cap, the bar is
 * scaled to the lineup total and a marker shows where the cap sits.
 */
export function CapStack({ slots, cap }: { slots: SlotView[]; cap: number }) {
  const total = slots.reduce((sum, s) => sum + s.salary, 0)
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
      </div>

      <p className={`text-xs ${over ? 'text-red-400' : 'text-muted'}`}>
        {over ? `${-remaining} over the cap` : `${remaining} left under the cap`}
      </p>
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
