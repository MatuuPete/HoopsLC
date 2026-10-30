import { useEffect, useMemo, useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useSettings } from '../data/useSettings'
import { useLineups } from '../data/useLineups'
import { useCatalog } from '../data/useCatalog'
import { findBestLineup } from '../optimizer/findBestLineup'
import { lockedPlayerIds } from '../optimizer/lockedPlayerIds'
import { awardFor, effectiveDefense, effectiveOffense, type Award } from '../optimizer/awards'
import {
  SUPER_BIG3_SIZE,
  big3BonusMap,
  big3Stars,
  superBig3Bonus,
  type Big3,
  type Big3Tag,
} from '../optimizer/big3'
import type { LineupResult, Player } from '../optimizer/types'
import { LineupResultPanel, LineupResultPlaceholder } from '../components/LineupResultPanel'
import { SavedLineupsPanel } from '../components/SavedLineupsPanel'
import { LineupSettingsPanel } from '../components/LineupSettingsPanel'

/** The award goes into a saved slot only when the player has one. */
function awardField(name: string): { award?: Award } {
  const award = awardFor(name)
  return award ? { award } : {}
}

/** A saved player's stats with every bonus baked in, plus their award and Big 3 marks. */
function savedStats(player: Player, tag: Big3Tag | undefined, inSuperBig3 = false) {
  const superBonus = inSuperBig3 ? superBig3Bonus(player) : null
  return {
    offense: effectiveOffense(player) + (tag?.offense ?? 0) + (superBonus?.offense ?? 0),
    defense: effectiveDefense(player) + (tag?.defense ?? 0) + (superBonus?.defense ?? 0),
    ...awardField(player.name),
    ...(tag ? { big3Team: tag.team } : {}),
    ...(inSuperBig3 ? { superBig3: true } : {}),
  }
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
    legendEventEnabled,
    updateLegendEventEnabled,
    big3Mode,
    big3Count,
    updateBig3,
    superBig3PlayerIds,
    updateSuperBig3PlayerIds,
    teamBig3Locks,
    updateTeamBig3Locks,
    updatePlayerRoles,
    error: settingsError,
  } = useSettings()
  const { lineups, error: lineupsError, saveLineup, renameLineup, removeLineup } = useLineups()
  const { catalog } = useCatalog()
  // Each team's stars come from the whole catalog, so they're the same for every user.
  const stars = useMemo(() => big3Stars(catalog), [catalog])
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

  // A locked Super Big 3 counts only while all three are still owned; otherwise the builder picks.
  const lockedSuperBig3 = useMemo(() => {
    const owned = superBig3PlayerIds.filter((id) => players.some((p) => p.id === id))
    return owned.length === SUPER_BIG3_SIZE ? owned : []
  }, [superBig3PlayerIds, players])

  // Locked Team Big 3s count while all their players are still owned, up to the Big 3 count.
  const teamBig3Count = Math.max(1, big3Count)
  const lockedTeamBig3 = useMemo(
    () =>
      teamBig3Locks
        .filter((lock) => lock.playerIds.every((id) => players.some((p) => p.id === id)))
        .slice(0, teamBig3Count),
    [teamBig3Locks, players, teamBig3Count],
  )

  /** Locks a Big 3 from the result, replacing any lock for the same team and keeping within the count. */
  async function handleLockBig3(big3: Big3) {
    await updateTeamBig3Locks([...lockedTeamBig3.filter((l) => l.team !== big3.team), big3].slice(-teamBig3Count))
  }

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
        extraLegendX: legendEventEnabled,
        big3: big3Mode === 'team' ? { maxCount: teamBig3Count, stars, locked: lockedTeamBig3 } : undefined,
        superBig3: big3Mode === 'super' ? { lockedIds: lockedSuperBig3 } : undefined,
      }),
    )
  }

  async function handleSaveLineup() {
    if (!result || !result.success) return
    const nextCount = savedLineupCount + 1
    const tags = big3BonusMap(result.big3s, [...result.slots.map((s) => s.player), ...result.bench])
    const superIds = new Set(result.superBig3)
    const bench = result.bench.map((player) => ({
      playerId: player.id,
      name: player.name,
      positions: player.positions,
      currentSalary: player.currentSalary,
      baseSalary: player.baseSalary,
      ...savedStats(player, tags.get(player.id)),
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
        ...savedStats(slot.player, tags.get(slot.player.id), superIds.has(slot.player.id)),
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

      {settingsError && <p className="mt-4 text-sm text-red-400">{settingsError}</p>}

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
            legendEventEnabled={legendEventEnabled}
            onLegendEventChange={updateLegendEventEnabled}
            big3Mode={big3Mode}
            big3Count={big3Count}
            onBig3Change={updateBig3}
            superBig3PlayerIds={lockedSuperBig3}
            onSuperBig3Change={updateSuperBig3PlayerIds}
            stars={stars}
            teamBig3Locks={lockedTeamBig3}
            onTeamBig3LocksChange={updateTeamBig3Locks}
            hasTeams={stars.size > 0}
            players={availablePlayers}
            allPlayers={players}
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
              superBig3Locked={lockedSuperBig3.length > 0}
              onLockSuperBig3={updateSuperBig3PlayerIds}
              lockedBig3={lockedTeamBig3}
              onLockBig3={handleLockBig3}
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
