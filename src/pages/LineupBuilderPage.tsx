import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useSettings } from '../data/useSettings'
import { useLineups } from '../data/useLineups'
import { findBestLineup } from '../optimizer/findBestLineup'
import { lockedPlayerIds } from '../optimizer/lockedPlayerIds'
import { awardFor, effectiveDefense, effectiveOffense, type Award } from '../optimizer/awards'
import { MAX_BENCH_SIZE, type LineupResult } from '../optimizer/types'
import { LineupResultPanel, LineupResultPlaceholder } from '../components/LineupResultPanel'
import { SavedLineupsPanel } from '../components/SavedLineupsPanel'
import { PlayerChecklist } from '../components/PlayerChecklist'
import { Eyebrow, Switch } from '../components/LineupParts'
import { SalaryCapField } from '../components/SalaryCapField'

/** The award goes into a saved slot only when the player has one. */
function awardField(name: string): { award?: Award } {
  const award = awardFor(name)
  return award ? { award } : {}
}

export function LineupBuilderPage() {
  const { players } = usePlayers()
  const {
    salaryCap,
    updateSalaryCap,
    requiredPlayerIds,
    updateRequiredPlayerIds,
    unavailablePlayerIds,
    updateUnavailablePlayerIds,
    objectiveMode,
    updateObjectiveMode,
    offenseWeight,
    updateOffenseWeight,
    savedLineupCount,
    updateSavedLineupCount,
    benchEnabled,
    updateBenchEnabled,
    benchSize,
    updateBenchSize,
    preferredBenchPlayerIds,
    updatePreferredBenchPlayerIds,
  } = useSettings()
  const { lineups, error: lineupsError, saveLineup, renameLineup, removeLineup } = useLineups()
  const [capInput, setCapInput] = useState(salaryCap)
  const [result, setResult] = useState<LineupResult | null>(null)
  // The cap the current result was calculated against, and a counter that
  // remounts the result card (resetting its "Saved" state) on each calculate.
  const [resultCap, setResultCap] = useState(salaryCap)
  const [resultId, setResultId] = useState(0)
  const [preferredSearch, setPreferredSearch] = useState('')
  const [unavailableSearch, setUnavailableSearch] = useState('')
  const [benchSearch, setBenchSearch] = useState('')
  const [showUnavailable, setShowUnavailable] = useState(false)

  // Players already committed to a saved lineup are locked out of new ones.
  const lockedIds = useMemo(() => lockedPlayerIds(lineups, players), [lineups, players])
  const availablePlayers = useMemo(
    () => players.filter((p) => !lockedIds.has(p.id)),
    [players, lockedIds],
  )
  // Only count ids that still map to an owned player not already locked, so
  // stale ids left in settings don't inflate the badge.
  const unavailableCount = useMemo(
    () => availablePlayers.filter((p) => unavailablePlayerIds.includes(p.id)).length,
    [availablePlayers, unavailablePlayerIds],
  )
  const committedNames = useMemo(
    () =>
      players
        .filter((p) => lockedIds.has(p.id))
        .map((p) => p.name)
        .sort(),
    [players, lockedIds],
  )

  useEffect(() => {
    setCapInput(salaryCap)
  }, [salaryCap])

  function handleCalculate() {
    setResultCap(capInput)
    setResultId((id) => id + 1)
    setResult(
      findBestLineup(players, capInput, {
        requiredPlayerIds,
        unavailablePlayerIds: [...new Set([...lockedIds, ...unavailablePlayerIds])],
        objectiveMode,
        offenseWeight,
        benchSize: activeBenchSize,
        preferredBenchPlayerIds,
      }),
    )
  }

  async function handleSaveLineup() {
    if (!result || !result.success) return
    const nextCount = savedLineupCount + 1
    const bench = result.bench.map((player) => ({
      playerId: player.id,
      name: player.name,
      positions: player.positions,
      currentSalary: player.currentSalary,
      baseSalary: player.baseSalary,
      offense: effectiveOffense(player),
      defense: effectiveDefense(player),
      ...awardField(player.name),
    }))
    await saveLineup(
      result.slots.map((slot) => ({
        position: slot.position,
        playerId: slot.player.id,
        name: slot.player.name,
        isXPlayer: slot.player.isXPlayer,
        ...(slot.player.xTier ? { xTier: slot.player.xTier } : {}),
        currentSalary: slot.player.currentSalary,
        baseSalary: slot.player.baseSalary,
        offense: effectiveOffense(slot.player),
        defense: effectiveDefense(slot.player),
        ...awardField(slot.player.name),
      })),
      bench,
      `Lineup ${nextCount}`,
    )
    await updateSavedLineupCount(nextCount)
  }

  async function handleCapChange(value: number) {
    setCapInput(value)
    await updateSalaryCap(value)
  }

  // A player is preferred for the starting five or the bench, never both:
  // ticking one list unticks the other.
  function toggleRequired(playerId: string) {
    const adding = !requiredPlayerIds.includes(playerId)
    const next = adding ? [...requiredPlayerIds, playerId] : requiredPlayerIds.filter((id) => id !== playerId)
    updateRequiredPlayerIds(next)
    if (adding && preferredBenchPlayerIds.includes(playerId)) {
      updatePreferredBenchPlayerIds(preferredBenchPlayerIds.filter((id) => id !== playerId))
    }
  }

  function togglePreferredBench(playerId: string) {
    const adding = !preferredBenchPlayerIds.includes(playerId)
    const next = adding
      ? [...preferredBenchPlayerIds, playerId]
      : preferredBenchPlayerIds.filter((id) => id !== playerId)
    updatePreferredBenchPlayerIds(next)
    if (adding && requiredPlayerIds.includes(playerId)) {
      updateRequiredPlayerIds(requiredPlayerIds.filter((id) => id !== playerId))
    }
  }

  function toggleUnavailable(playerId: string) {
    const next = unavailablePlayerIds.includes(playerId)
      ? unavailablePlayerIds.filter((id) => id !== playerId)
      : [...unavailablePlayerIds, playerId]
    updateUnavailablePlayerIds(next)
  }

  const activeBenchSize = benchEnabled ? benchSize : 0
  const requiredCount = availablePlayers.filter((p) => requiredPlayerIds.includes(p.id)).length
  // X Players can't sit on the bench, so they aren't offered here.
  const benchCandidates = availablePlayers.filter((p) => !p.isXPlayer)
  const preferredBenchCount = benchCandidates.filter((p) => preferredBenchPlayerIds.includes(p.id)).length
  const offensePct = Math.round(offenseWeight * 100)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 font-body sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-border pb-6">
        <div>
          <h1 className="font-display text-4xl uppercase leading-none tracking-wide text-text sm:text-5xl">
            Lineup builder
          </h1>
          <p className="mt-3 text-sm text-muted">
            Find the strongest five you can field under your salary cap
            {activeBenchSize > 0 ? `, plus a ${activeBenchSize}-player bench.` : '.'}
          </p>
        </div>
        <dl className="flex gap-6 sm:gap-8">
          <HeaderStat label="Available" value={availablePlayers.length} />
          <HeaderStat label="In saved lineups" value={lockedIds.size} />
          <HeaderStat label="Saved lineups" value={lineups.length} />
        </dl>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-8">
        <section
          aria-label="Lineup settings"
          className="rounded-xl border border-border bg-panel lg:col-start-1 lg:row-start-1"
        >
          <div className="divide-y divide-border">
            <div className="flex flex-col gap-2 p-5">
              <label htmlFor="salary-cap">
                <Eyebrow>Salary cap</Eyebrow>
              </label>
              <SalaryCapField id="salary-cap" value={capInput} onCommit={handleCapChange} />
            </div>

            <div className="flex flex-col gap-3 p-5">
              <Eyebrow>Optimize for</Eyebrow>
              <div
                role="radiogroup"
                aria-label="Optimize for"
                className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg p-1"
              >
                <SegmentButton active={objectiveMode === 'power'} onClick={() => updateObjectiveMode('power')}>
                  Max power
                </SegmentButton>
                <SegmentButton active={objectiveMode === 'stats'} onClick={() => updateObjectiveMode('stats')}>
                  Stats
                </SegmentButton>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {objectiveMode === 'power'
                  ? 'Picks the five with the highest total power: offense plus defense, award bonuses included.'
                  : 'Picks the five with the best offense and defense, weighted by the slider.'}
              </p>

              {objectiveMode === 'stats' && (
                <div className="flex flex-col gap-2 pt-1">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    aria-label="Offense weight"
                    aria-valuetext={`${offensePct}% offense, ${100 - offensePct}% defense`}
                    className="w-full accent-accent"
                    value={offensePct}
                    onChange={(e) => updateOffenseWeight(Number(e.target.value) / 100)}
                  />
                  <div className="flex justify-between font-mono text-[11px] tabular-nums text-muted">
                    <span>DEF {100 - offensePct}%</span>
                    <span>OFF {offensePct}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <span id="bench-label">
                  <Eyebrow>Bench</Eyebrow>
                </span>
                <Switch
                  checked={benchEnabled}
                  onChange={updateBenchEnabled}
                  aria-labelledby="bench-label"
                />
              </div>
              <p className="-mt-1 text-xs leading-relaxed text-muted">
                {benchEnabled
                  ? 'Your best five comes first, with cap held back so the full bench fits. Bench players can play any position; X Players only start.'
                  : 'Just the starting five. Turn on to add bench players under the same cap.'}
              </p>

              {benchEnabled && (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span id="bench-size-label" className="text-muted">
                      Bench size
                    </span>
                    <span className="font-mono tabular-nums text-text">
                      5 + {benchSize} <span className="text-muted">= {5 + benchSize} players</span>
                    </span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-labelledby="bench-size-label"
                    className="grid grid-cols-6 gap-1 rounded-lg border border-border bg-bg p-1"
                  >
                    {Array.from({ length: MAX_BENCH_SIZE }, (_, i) => i + 1).map((size) => (
                      <SegmentButton key={size} active={benchSize === size} onClick={() => updateBenchSize(size)}>
                        <span className="font-mono tabular-nums">{size}</span>
                      </SegmentButton>
                    ))}
                  </div>
                </div>
              )}

              {benchEnabled && (
                <div className="flex flex-col gap-2 border-t border-white/[0.05] pt-4">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-muted">Preferred bench players</span>
                    {preferredBenchCount > 0 && (
                      <span className={preferredBenchCount > benchSize ? 'text-red-400' : 'text-accent'}>
                        {preferredBenchCount} of {benchSize} spots
                      </span>
                    )}
                  </div>
                  <p className="-mt-1 text-xs text-muted">
                    Kept on the bench whenever they fit. Any spots left go to the strongest players.
                  </p>
                  <PlayerChecklist
                    label="Preferred bench players"
                    players={benchCandidates}
                    selectedIds={preferredBenchPlayerIds}
                    search={benchSearch}
                    onSearchChange={setBenchSearch}
                    onToggle={togglePreferredBench}
                    onClearAll={() => updatePreferredBenchPlayerIds([])}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <Eyebrow>Preferred players</Eyebrow>
                {requiredCount > 0 && <span className="text-xs text-accent">{requiredCount} selected</span>}
              </div>
              <p className="-mt-1 text-xs text-muted">
                Kept in the {activeBenchSize > 0 ? 'starting five' : 'lineup'} whenever they fit.
              </p>
              <PlayerChecklist
                label="Preferred players"
                players={availablePlayers}
                selectedIds={requiredPlayerIds}
                search={preferredSearch}
                onSearchChange={setPreferredSearch}
                onToggle={toggleRequired}
                onClearAll={() => updateRequiredPlayerIds([])}
              />
              {committedNames.length > 0 && (
                <p className="text-xs leading-relaxed text-muted">
                  <span className="text-text/80">Hidden, already in a saved lineup:</span>{' '}
                  {committedNames.join(', ')}
                </p>
              )}
            </div>

            <div className="flex flex-col">
              <button
                onClick={() => setShowUnavailable((v) => !v)}
                aria-expanded={showUnavailable}
                aria-controls="unavailable-players"
                className="flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <span className="flex items-center gap-2">
                  <Eyebrow>Unavailable players</Eyebrow>
                  {unavailableCount > 0 && (
                    <span className="rounded-full bg-white/[0.08] px-1.5 font-mono text-[11px] tabular-nums text-text">
                      {unavailableCount}
                    </span>
                  )}
                </span>
                <svg
                  viewBox="0 0 16 16"
                  className={`h-3.5 w-3.5 text-muted transition-transform ${showUnavailable ? 'rotate-180' : ''}`}
                  fill="none"
                  aria-hidden
                >
                  <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {showUnavailable && (
                <div id="unavailable-players" className="flex flex-col gap-3 px-5 pb-5">
                  <p className="text-xs text-muted">
                    Left out of the calculation, for players a friend has borrowed.
                  </p>
                  <PlayerChecklist
                    label="Unavailable players"
                    players={availablePlayers}
                    selectedIds={unavailablePlayerIds}
                    search={unavailableSearch}
                    onSearchChange={setUnavailableSearch}
                    onToggle={toggleUnavailable}
                    onClearAll={() => updateUnavailablePlayerIds([])}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border p-5">
            <button
              onClick={handleCalculate}
              className="w-full rounded-lg bg-text py-3 text-sm font-semibold text-bg transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-text/90"
            >
              Calculate best lineup
            </button>
          </div>
        </section>

        <div className="self-start lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {result ? (
            <LineupResultPanel
              key={resultId}
              result={result}
              players={players}
              cap={resultCap}
              onSave={result.success ? handleSaveLineup : undefined}
            />
          ) : (
            <LineupResultPlaceholder benchSize={activeBenchSize} />
          )}
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <SavedLineupsPanel
            lineups={lineups}
            error={lineupsError}
            onRename={renameLineup}
            onDelete={removeLineup}
          />
        </div>
      </div>
    </div>
  )
}

function HeaderStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-xl tabular-nums leading-none text-text">{value}</dd>
    </div>
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
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        active
          ? 'bg-white/[0.09] text-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
          : 'text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

