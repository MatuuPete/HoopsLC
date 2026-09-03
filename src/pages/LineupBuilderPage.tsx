import { useEffect, useMemo, useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useSettings } from '../data/useSettings'
import { useLineups } from '../data/useLineups'
import { findBestLineup } from '../optimizer/findBestLineup'
import { lockedPlayerIds } from '../optimizer/lockedPlayerIds'
import type { LineupResult } from '../optimizer/types'
import { LineupResultPanel } from '../components/LineupResultPanel'
import { SavedLineupsPanel } from '../components/SavedLineupsPanel'
import { PlayerChecklist } from '../components/PlayerChecklist'

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
  } = useSettings()
  const { lineups, error: lineupsError, saveLineup, renameLineup, removeLineup } = useLineups()
  const [capInput, setCapInput] = useState(salaryCap)
  const [result, setResult] = useState<LineupResult | null>(null)
  const [preferredSearch, setPreferredSearch] = useState('')
  const [unavailableSearch, setUnavailableSearch] = useState('')
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
    setResult(
      findBestLineup(players, capInput, {
        requiredPlayerIds,
        unavailablePlayerIds: [...new Set([...lockedIds, ...unavailablePlayerIds])],
        objectiveMode,
        offenseWeight,
      }),
    )
  }

  async function handleSaveLineup() {
    if (!result || !result.success) return
    const nextCount = savedLineupCount + 1
    await saveLineup(
      result.slots.map((slot) => ({
        position: slot.position,
        playerId: slot.player.id,
        name: slot.player.name,
        isXPlayer: slot.player.isXPlayer,
        currentSalary: slot.player.currentSalary,
        baseSalary: slot.player.baseSalary,
        offense: slot.player.offense,
        defense: slot.player.defense,
      })),
      `Lineup ${nextCount}`,
    )
    await updateSavedLineupCount(nextCount)
  }

  async function handleCapChange(value: number) {
    setCapInput(value)
    await updateSalaryCap(value)
  }

  function toggleRequired(playerId: string) {
    const next = requiredPlayerIds.includes(playerId)
      ? requiredPlayerIds.filter((id) => id !== playerId)
      : [...requiredPlayerIds, playerId]
    updateRequiredPlayerIds(next)
  }

  function toggleUnavailable(playerId: string) {
    const next = unavailablePlayerIds.includes(playerId)
      ? unavailablePlayerIds.filter((id) => id !== playerId)
      : [...unavailablePlayerIds, playerId]
    updateUnavailablePlayerIds(next)
  }

  return (
    <div className="flex gap-6 p-6">
      <div className="flex flex-col gap-4 w-full max-w-md">
        <h1 className="text-sm uppercase tracking-widest text-muted">Lineup Builder</h1>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
          Salary Cap
          <input
            type="number"
            className="bg-bg border border-border px-2 py-1 text-text"
            value={capInput}
            onChange={(e) => handleCapChange(Number(e.target.value))}
          />
        </label>

        <div className="flex flex-col gap-1">
          <PlayerChecklist
            label="Preferred Players"
            players={availablePlayers}
            selectedIds={requiredPlayerIds}
            search={preferredSearch}
            onSearchChange={setPreferredSearch}
            onToggle={toggleRequired}
            onClearAll={() => updateRequiredPlayerIds([])}
          />
          {committedNames.length > 0 && (
            <p className="text-xs text-muted normal-case tracking-normal">
              Committed to saved lineups: {committedNames.join(', ')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <button
            onClick={() => setShowUnavailable((v) => !v)}
            className="flex items-center justify-between text-xs uppercase tracking-widest text-muted border border-border px-3 py-2"
          >
            <span>
              Unavailable Players{unavailableCount > 0 ? ` (${unavailableCount})` : ''}
            </span>
            <span aria-hidden>{showUnavailable ? '−' : '+'}</span>
          </button>
          {showUnavailable && (
            <>
              <PlayerChecklist
                label="Borrowed / Unavailable"
                players={availablePlayers}
                selectedIds={unavailablePlayerIds}
                search={unavailableSearch}
                onSearchChange={setUnavailableSearch}
                onToggle={toggleUnavailable}
                onClearAll={() => updateUnavailablePlayerIds([])}
              />
              <p className="text-xs text-muted normal-case tracking-normal">
                Excluded from the calculated lineup — for players a friend has borrowed.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 text-xs uppercase tracking-widest text-muted">
          Objective
          <div className="flex gap-2">
            <button
              onClick={() => updateObjectiveMode('power')}
              className={
                objectiveMode === 'power'
                  ? 'border border-accent text-accent px-3 py-1'
                  : 'border border-border text-muted px-3 py-1'
              }
            >
              Maximize Power
            </button>
            <button
              onClick={() => updateObjectiveMode('stats')}
              className={
                objectiveMode === 'stats'
                  ? 'border border-accent text-accent px-3 py-1'
                  : 'border border-border text-muted px-3 py-1'
              }
            >
              Prioritize Stats
            </button>
          </div>

          {objectiveMode === 'stats' && (
            <div className="flex flex-col gap-1">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(offenseWeight * 100)}
                onChange={(e) => updateOffenseWeight(Number(e.target.value) / 100)}
              />
              <div className="flex justify-between normal-case tracking-normal">
                <span>Defense</span>
                <span>{Math.round(offenseWeight * 100)}% Offense</span>
                <span>Offense</span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleCalculate}
          className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold"
        >
          Calculate Best Lineup
        </button>

        <LineupResultPanel
          result={result}
          players={players}
          onSave={result?.success ? handleSaveLineup : undefined}
        />
      </div>

      <SavedLineupsPanel
        lineups={lineups}
        error={lineupsError}
        onRename={renameLineup}
        onDelete={removeLineup}
      />
    </div>
  )
}
