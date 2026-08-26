import { useState, type FormEvent } from 'react'
import type { NewPlayer } from '../data/playersApi'
import type { Position } from '../optimizer/types'

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
const X_PLAYER_STAT_TOTAL = 450
const X_PLAYER_SALARY = 999

interface PlayerFormProps {
  initial?: NewPlayer
  onSubmit: (player: NewPlayer) => Promise<void>
  onCancel?: () => void
}

export function PlayerForm({ initial, onSubmit, onCancel }: PlayerFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [positions, setPositions] = useState<Position[]>(initial?.positions ?? ['PG'])
  const [offense, setOffense] = useState(initial?.offense ?? 0)
  const [defense, setDefense] = useState(initial?.defense ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const statsValid = offense + defense === X_PLAYER_STAT_TOTAL
  const positionsValid = positions.length > 0

  function togglePosition(position: Position) {
    setPositions((current) =>
      current.includes(position) ? current.filter((p) => p !== position) : [...current, position],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!statsValid || !positionsValid) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({
        name,
        positions,
        isXPlayer: true,
        baseSalary: X_PLAYER_SALARY,
        currentSalary: X_PLAYER_SALARY,
        offense,
        defense,
        catalogPlayerId: null,
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save player')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-panel p-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Name
        <input
          className="bg-bg border border-border px-2 py-1 text-text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <div className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Positions
        <div className="flex gap-2">
          {POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePosition(p)}
              className={
                positions.includes(p)
                  ? 'border border-accent text-accent px-3 py-1'
                  : 'border border-border text-muted px-3 py-1'
              }
            >
              {p}
            </button>
          ))}
        </div>
        {!positionsValid && (
          <p className="text-xs text-red-400 normal-case tracking-normal">Select at least one position.</p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Offense
        <input
          type="number"
          className="bg-bg border border-border px-2 py-1 text-text"
          value={offense || ''}
          onChange={(e) => setOffense(e.target.value === '' ? 0 : Number(e.target.value))}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Defense
        <input
          type="number"
          className="bg-bg border border-border px-2 py-1 text-text"
          value={defense || ''}
          onChange={(e) => setDefense(e.target.value === '' ? 0 : Number(e.target.value))}
          required
        />
      </label>

      {!statsValid && (
        <p className="text-xs text-red-400">
          Offense + Defense must equal exactly {X_PLAYER_STAT_TOTAL} for an X Player.
        </p>
      )}

      {submitError && <p className="text-xs text-red-400">{submitError}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !statsValid || !positionsValid}
          className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold disabled:opacity-50"
        >
          Save
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border border-border px-4 py-2 uppercase tracking-widest text-xs"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
