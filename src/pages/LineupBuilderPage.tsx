import { useEffect, useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useSettings } from '../data/useSettings'
import { findBestLineup } from '../optimizer/findBestLineup'
import type { LineupResult } from '../optimizer/types'
import { LineupResultPanel } from '../components/LineupResultPanel'

export function LineupBuilderPage() {
  const { players } = usePlayers()
  const {
    salaryCap,
    updateSalaryCap,
    requiredPlayerIds,
    updateRequiredPlayerIds,
    objectiveMode,
    updateObjectiveMode,
    offenseWeight,
    updateOffenseWeight,
  } = useSettings()
  const [capInput, setCapInput] = useState(salaryCap)
  const [result, setResult] = useState<LineupResult | null>(null)
  const [preferredSearch, setPreferredSearch] = useState('')

  useEffect(() => {
    setCapInput(salaryCap)
  }, [salaryCap])

  function handleCalculate() {
    setResult(findBestLineup(players, capInput, { requiredPlayerIds, objectiveMode, offenseWeight }))
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

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(preferredSearch.toLowerCase()),
  )

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

      <div className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Preferred Players
        <input
          className="bg-bg border border-border px-2 py-1 text-text normal-case tracking-normal text-sm"
          placeholder="Search player..."
          value={preferredSearch}
          onChange={(e) => setPreferredSearch(e.target.value)}
        />
        <div className="border border-border bg-panel p-2 flex flex-col gap-1 max-h-48 overflow-y-auto">
          {players.length === 0 && <span className="text-muted normal-case">No owned players yet.</span>}
          {players.length > 0 && filteredPlayers.length === 0 && (
            <span className="text-muted normal-case">No players match "{preferredSearch}".</span>
          )}
          {filteredPlayers.map((p) => (
            <label key={p.id} className="flex items-center gap-2 normal-case tracking-normal text-text text-sm">
              <input
                type="checkbox"
                checked={requiredPlayerIds.includes(p.id)}
                onChange={() => toggleRequired(p.id)}
              />
              {p.name} ({p.positions.join('/')})
            </label>
          ))}
        </div>
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

      <LineupResultPanel result={result} players={players} />
    </div>
  )
}
