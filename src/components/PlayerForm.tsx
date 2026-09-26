import { useState, type FormEvent } from 'react'
import type { NewPlayer } from '../data/playersApi'
import { X_TIERS, type Position, type XTier } from '../optimizer/types'
import {
  Field,
  FormCard,
  PositionPicker,
  buttonPrimary,
  buttonSecondary,
  inputClass,
  numberInputClass,
} from './ui'

const TIERS = Object.keys(X_TIERS) as XTier[]
const X_PLAYER_SALARY = 999

interface PlayerFormProps {
  initial?: NewPlayer
  onSubmit: (player: NewPlayer) => Promise<void>
  onCancel: () => void
}

export function PlayerForm({ initial, onSubmit, onCancel }: PlayerFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [tier, setTier] = useState<XTier>(initial?.xTier ?? 'standard')
  const [positions, setPositions] = useState<Position[]>(initial?.positions ?? ['PG'])
  const [offense, setOffense] = useState(initial?.offense ?? 0)
  const [defense, setDefense] = useState(initial?.defense ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const statTotal = X_TIERS[tier].statTotal
  const sum = offense + defense
  const statsValid = sum === statTotal
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
        xTier: tier,
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
    <FormCard eyebrow={initial ? 'Edit X Player' : 'Add X Player'} title={initial?.name ?? 'New X Player'} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Type">
          <div role="radiogroup" aria-label="X Player type" className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg p-1">
            {TIERS.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tier === t}
                onClick={() => setTier(t)}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  tier === t
                    ? 'bg-white/[0.09] text-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                    : 'text-muted hover:text-text'
                }`}
              >
                {X_TIERS[t].label}
                <span className="font-mono text-xs text-muted">{X_TIERS[t].statTotal}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Name" htmlFor="x-name">
          <input
            id="x-name"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </Field>

        <Field
          label="Positions"
          hint={!positionsValid ? <span className="text-red-400">Select at least one position.</span> : undefined}
        >
          <PositionPicker selected={positions} onToggle={togglePosition} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Offense" htmlFor="x-offense">
            <input
              id="x-offense"
              type="number"
              inputMode="numeric"
              className={numberInputClass}
              value={offense || ''}
              onChange={(e) => setOffense(e.target.value === '' ? 0 : Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Defense" htmlFor="x-defense">
            <input
              id="x-defense"
              type="number"
              inputMode="numeric"
              className={numberInputClass}
              value={defense || ''}
              onChange={(e) => setDefense(e.target.value === '' ? 0 : Number(e.target.value))}
              required
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg px-4 py-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">Offense + Defense</span>
            <span className="font-mono tabular-nums">
              <span className={statsValid ? 'text-accent' : sum > statTotal ? 'text-red-400' : 'text-text'}>{sum}</span>
              <span className="text-muted"> / {statTotal}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${statsValid ? 'bg-accent' : sum > statTotal ? 'bg-red-400' : 'bg-muted/60'} motion-safe:transition-[width]`}
              style={{ width: `${Math.min(1, sum / statTotal) * 100}%` }}
            />
          </div>
          <p className={`text-xs ${statsValid ? 'text-accent' : 'text-muted'}`}>
            {statsValid
              ? 'Stats add up.'
              : `Must total exactly ${statTotal} for this type. ${
                  sum < statTotal ? `${statTotal - sum} to go.` : `${sum - statTotal} over.`
                }`}
          </p>
        </div>

        <p className="text-xs text-muted">X Players always cost {X_PLAYER_SALARY} salary.</p>

        {submitError && <p className="text-sm text-red-400">{submitError}</p>}

        <div className="flex gap-2 border-t border-border pt-5">
          <button type="submit" disabled={submitting || !statsValid || !positionsValid} className={buttonPrimary}>
            {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add X Player'}
          </button>
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        </div>
      </form>
    </FormCard>
  )
}
