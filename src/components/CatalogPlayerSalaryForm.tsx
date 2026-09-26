import { useState, type FormEvent } from 'react'
import type { Position } from '../optimizer/types'
import { Field, FormCard, PositionPicker, buttonPrimary, buttonSecondary, numberInputClass } from './ui'

interface CatalogPlayerSalaryFormProps {
  name: string
  positions: Position[]
  price: number
  offense: number
  defense: number
  initialBaseSalary?: number
  onSubmit: (baseSalary: number, positions: Position[]) => Promise<void>
  onCancel: () => void
}

function ReadOnlyStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-base tabular-nums leading-none text-text">{value}</span>
    </div>
  )
}

export function CatalogPlayerSalaryForm({
  name,
  positions,
  price,
  offense,
  defense,
  initialBaseSalary,
  onSubmit,
  onCancel,
}: CatalogPlayerSalaryFormProps) {
  const [baseSalary, setBaseSalary] = useState(initialBaseSalary ?? 0)
  const [selectedPositions, setSelectedPositions] = useState<Position[]>(positions)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const editing = initialBaseSalary !== undefined
  const positionsValid = selectedPositions.length > 0

  function togglePosition(position: Position) {
    setSelectedPositions((current) =>
      current.includes(position) ? current.filter((p) => p !== position) : [...current, position],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!positionsValid) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(baseSalary, selectedPositions)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save player')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormCard eyebrow={editing ? 'Edit player' : 'Add to roster'} title={name} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-bg px-4 py-3">
          <ReadOnlyStat label="Catalog price" value={price} />
          <ReadOnlyStat label="Offense" value={offense} />
          <ReadOnlyStat label="Defense" value={defense} />
        </div>

        <Field
          label="Base salary"
          htmlFor="base-salary"
          hint="The price you own this player at. The lineup builder counts this against your cap."
        >
          <input
            id="base-salary"
            type="number"
            min={0}
            inputMode="numeric"
            autoFocus
            className={numberInputClass}
            value={baseSalary || ''}
            onChange={(e) => setBaseSalary(e.target.value === '' ? 0 : Number(e.target.value))}
            required
          />
        </Field>

        <Field
          label="Positions"
          hint={!positionsValid ? <span className="text-red-400">Select at least one position.</span> : undefined}
        >
          <PositionPicker selected={selectedPositions} onToggle={togglePosition} />
        </Field>

        {submitError && <p className="text-sm text-red-400">{submitError}</p>}

        <div className="flex gap-2 border-t border-border pt-5">
          <button type="submit" disabled={submitting || !positionsValid} className={buttonPrimary}>
            {submitting ? 'Saving…' : editing ? 'Save changes' : 'Add to roster'}
          </button>
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        </div>
      </form>
    </FormCard>
  )
}
