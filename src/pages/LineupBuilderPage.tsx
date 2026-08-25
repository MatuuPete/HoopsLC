import { useEffect, useState } from 'react'
import { usePlayers } from '../data/usePlayers'
import { useSettings } from '../data/useSettings'
import { findBestLineup } from '../optimizer/findBestLineup'
import type { LineupResult } from '../optimizer/types'
import { LineupResultPanel } from '../components/LineupResultPanel'

export function LineupBuilderPage() {
  const { players } = usePlayers()
  const { salaryCap, updateSalaryCap } = useSettings()
  const [capInput, setCapInput] = useState(salaryCap)
  const [result, setResult] = useState<LineupResult | null>(null)

  useEffect(() => {
    setCapInput(salaryCap)
  }, [salaryCap])

  function handleCalculate() {
    setResult(findBestLineup(players, capInput))
  }

  async function handleCapChange(value: number) {
    setCapInput(value)
    await updateSalaryCap(value)
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

      <button
        onClick={handleCalculate}
        className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold"
      >
        Calculate Best Lineup
      </button>

      <LineupResultPanel result={result} />
    </div>
  )
}
