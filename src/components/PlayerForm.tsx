import { useState, type FormEvent } from 'react'
import type { NewPlayer } from '../data/playersApi'
import type { Position } from '../optimizer/types'

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
const MAX_SALARY = 2500
const X_PLAYER_STAT_TOTAL = 450

interface PlayerFormProps {
  initial?: NewPlayer
  onSubmit: (player: NewPlayer) => Promise<void>
  onCancel?: () => void
}

export function PlayerForm({ initial, onSubmit, onCancel }: PlayerFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [position, setPosition] = useState<Position>(initial?.position ?? 'PG')
  const [isXPlayer, setIsXPlayer] = useState(initial?.isXPlayer ?? false)
  const [baseSalary, setBaseSalary] = useState(initial?.baseSalary ?? 0)
  const [currentSalary, setCurrentSalary] = useState(initial?.currentSalary ?? 0)
  const [offense, setOffense] = useState(initial?.offense ?? 0)
  const [defense, setDefense] = useState(initial?.defense ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const statsValid = !isXPlayer || offense + defense === X_PLAYER_STAT_TOTAL
  const salaryValid = isXPlayer || (baseSalary <= MAX_SALARY && currentSalary <= MAX_SALARY)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!statsValid || !salaryValid) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({
        name,
        position,
        isXPlayer,
        baseSalary: isXPlayer ? 999 : baseSalary,
        currentSalary: isXPlayer ? 999 : currentSalary,
        offense,
        defense,
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

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Position
        <select
          className="bg-bg border border-border px-2 py-1 text-text"
          value={position}
          onChange={(e) => setPosition(e.target.value as Position)}
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted">
        <input type="checkbox" checked={isXPlayer} onChange={(e) => setIsXPlayer(e.target.checked)} />
        X Player
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Base Salary
        <input
          type="number"
          className="bg-bg border border-border px-2 py-1 text-text disabled:opacity-50"
          value={isXPlayer ? 999 : baseSalary || ''}
          onChange={(e) => setBaseSalary(e.target.value === '' ? 0 : Number(e.target.value))}
          disabled={isXPlayer}
          max={MAX_SALARY}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Current Salary
        <input
          type="number"
          className="bg-bg border border-border px-2 py-1 text-text disabled:opacity-50"
          value={isXPlayer ? 999 : currentSalary || ''}
          onChange={(e) => setCurrentSalary(e.target.value === '' ? 0 : Number(e.target.value))}
          disabled={isXPlayer}
          max={MAX_SALARY}
          required
        />
      </label>

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

      {isXPlayer && !statsValid && (
        <p className="text-xs text-red-400">
          Offense + Defense must equal exactly {X_PLAYER_STAT_TOTAL} for an X Player.
        </p>
      )}

      {!salaryValid && (
        <p className="text-xs text-red-400">Base Salary and Current Salary must be {MAX_SALARY} or less.</p>
      )}

      {submitError && <p className="text-xs text-red-400">{submitError}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !statsValid || !salaryValid}
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
