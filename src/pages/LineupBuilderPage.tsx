import { useEffect, useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useSettings } from '../data/useSettings'
import { findBestLineup } from '../optimizer/findBestLineup'
import type { LineupResult } from '../optimizer/types'
import { LineupResultPanel } from '../components/LineupResultPanel'
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
  } = useSettings()
  const [capInput, setCapInput] = useState(salaryCap)
  const [result, setResult] = useState<LineupResult | null>(null)
  const [preferredSearch, setPreferredSearch] = useState('')
  const [unavailableSearch, setUnavailableSearch] = useState('')

  useEffect(() => {
    setCapInput(salaryCap)
  }, [salaryCap])

  function handleCalculate() {
    setResult(
      findBestLineup(players, capInput, {
        requiredPlayerIds,
        unavailablePlayerIds,
        objectiveMode,
        offenseWeight,
      }),
    )
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
    if (!requiredPlayerIds.includes(playerId) && unavailablePlayerIds.includes(playerId)) {
      updateUnavailablePlayerIds(unavailablePlayerIds.filter((id) => id !== playerId))
    }
  }

  function toggleUnavailable(playerId: string) {
    const next = unavailablePlayerIds.includes(playerId)
      ? unavailablePlayerIds.filter((id) => id !== playerId)
      : [...unavailablePlayerIds, playerId]
    updateUnavailablePlayerIds(next)
    if (!unavailablePlayerIds.includes(playerId) && requiredPlayerIds.includes(playerId)) {
      updateRequiredPlayerIds(requiredPlayerIds.filter((id) => id !== playerId))
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-md">
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

      <PlayerChecklist
        label="Preferred Players"
        players={players}
        selectedIds={requiredPlayerIds}
        search={preferredSearch}
        onSearchChange={setPreferredSearch}
        onToggle={toggleRequired}
      />

      <PlayerChecklist
        label="Unavailable Players"
        players={players}
        selectedIds={unavailablePlayerIds}
        search={unavailableSearch}
        onSearchChange={setUnavailableSearch}
        onToggle={toggleUnavailable}
      />

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

      <LineupResultPanel result={result} players={players} />
    </div>
  )
}
