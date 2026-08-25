import { useState, type FormEvent } from 'react'
import type { Position } from '../optimizer/types'

interface CatalogPlayerSalaryFormProps {
  name: string
  position: Position
  price: number
  offense: number
  defense: number
  initialBaseSalary?: number
  onSubmit: (baseSalary: number) => Promise<void>
  onCancel: () => void
}

export function CatalogPlayerSalaryForm({
  name,
  position,
  price,
  offense,
  defense,
  initialBaseSalary,
  onSubmit,
  onCancel,
}: CatalogPlayerSalaryFormProps) {
  const [baseSalary, setBaseSalary] = useState(initialBaseSalary ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(baseSalary)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save player')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-panel p-4 flex flex-col gap-3">
      <div className="flex justify-between text-sm">
        <span>{name}</span>
        <span className="text-muted uppercase tracking-widest">{position}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Price</span>
        <span>{price}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Offense</span>
        <span>{offense}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Defense</span>
        <span>{defense}</span>
      </div>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Base Salary
        <input
          type="number"
          min={0}
          className="bg-bg border border-border px-2 py-1 text-text"
          value={baseSalary || ''}
          onChange={(e) => setBaseSalary(e.target.value === '' ? 0 : Number(e.target.value))}
          required
        />
      </label>

      {submitError && <p className="text-xs text-red-400">{submitError}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-border px-4 py-2 uppercase tracking-widest text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
