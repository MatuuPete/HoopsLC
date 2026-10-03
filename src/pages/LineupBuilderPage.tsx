import { useEffect, useMemo, useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useSettings } from '../data/useSettings'
import { useLineups } from '../data/useLineups'
import { findBestLineup } from '../optimizer/findBestLineup'
import { lockedPlayerIds } from '../optimizer/lockedPlayerIds'
import { awardFor, effectiveDefense, effectiveOffense, type Award } from '../optimizer/awards'
import type { LineupResult } from '../optimizer/types'
import { LineupResultPanel, LineupResultPlaceholder } from '../components/LineupResultPanel'
import { SavedLineupsPanel } from '../components/SavedLineupsPanel'
import { LineupSettingsPanel } from '../components/LineupSettingsPanel'

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
    unavailablePlayerIds,
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
    updatePlayerRoles,
  } = useSettings()
  const { lineups, error: lineupsError, saveLineup, renameLineup, removeLineup } = useLineups()
  const [capInput, setCapInput] = useState(salaryCap)
  const [result, setResult] = useState<LineupResult | null>(null)
  // The cap the current result was calculated against, and a counter that
  // remounts the result card (resetting its "Saved" state) on each calculate.
  const [resultCap, setResultCap] = useState(salaryCap)
  const [resultId, setResultId] = useState(0)

  // Players already committed to a saved lineup are locked out of new ones.
  const lockedIds = useMemo(() => lockedPlayerIds(lineups, players), [lineups, players])
  const availablePlayers = useMemo(
    () => players.filter((p) => !lockedIds.has(p.id)),
    [players, lockedIds],
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

  const activeBenchSize = benchEnabled ? benchSize : 0

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
        <div className="lg:col-start-1 lg:row-start-1">
          <LineupSettingsPanel
            cap={capInput}
            onCapCommit={handleCapChange}
            objectiveMode={objectiveMode}
            onObjectiveModeChange={updateObjectiveMode}
            offenseWeight={offenseWeight}
            onOffenseWeightChange={updateOffenseWeight}
            benchEnabled={benchEnabled}
            onBenchEnabledChange={updateBenchEnabled}
            benchSize={benchSize}
            onBenchSizeChange={updateBenchSize}
            players={availablePlayers}
            roles={{ requiredPlayerIds, preferredBenchPlayerIds, unavailablePlayerIds }}
            onRolesChange={updatePlayerRoles}
            hiddenNames={committedNames}
            onCalculate={handleCalculate}
          />
        </div>

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
