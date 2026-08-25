import type { LineupResult } from '../optimizer/types'

export function LineupResultPanel({ result }: { result: LineupResult | null }) {
  if (!result) return null

  if (!result.success && result.reason === 'missing_position') {
    return (
      <div className="border border-border bg-panel p-4 text-sm text-red-400">
        Missing owned players for: {result.missingPositions.join(', ')}
      </div>
    )
  }

  if (!result.success && result.reason === 'cap_too_low') {
    return (
      <div className="border border-border bg-panel p-4 text-sm text-red-400">
        No lineup fits under this cap. Cheapest possible lineup costs {result.cheapestPossibleBaseSalary}{' '}
        base salary.
      </div>
    )
  }

  if (!result.success) return null

  return (
    <div className="border border-border bg-panel p-4 flex flex-col gap-3">
      {result.slots.map((slot) => (
        <div key={slot.position} className="flex justify-between text-sm">
          <span className="text-muted uppercase tracking-widest">{slot.position}</span>
          <span>{slot.player.name}</span>
          <span>{slot.player.currentSalary}</span>
        </div>
      ))}
      <div className="border-t border-border pt-3 flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Base Salary</span>
        <span>{result.totalBaseSalary}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Power</span>
        <span>{result.totalCurrentSalary}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Remaining Cap</span>
        <span>{result.remainingCap}</span>
      </div>
    </div>
  )
}
