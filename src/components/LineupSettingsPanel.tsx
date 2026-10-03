import type { ReactNode } from 'react'
import { MAX_BENCH_SIZE, type ObjectiveMode, type Player } from '../optimizer/types'
import type { PlayerRoleLists } from '../optimizer/playerRoles'
import { Eyebrow, Switch } from './LineupParts'
import { PlayerRolePicker } from './PlayerRolePicker'
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
  /** Owned players not locked into a saved lineup. */
  players: Player[]
  roles: PlayerRoleLists
  onRolesChange: (roles: PlayerRoleLists) => void
  /** Names of owned players hidden because a saved lineup already uses them. */
  hiddenNames: string[]
  onCalculate: () => void
}

/**
 * The lineup builder's settings column: the rules (cap, objective, bench) up
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
  players,
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
              ? 'Highest total power: offense plus defense, award bonuses included.'
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
