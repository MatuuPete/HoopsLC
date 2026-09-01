import type { SavedLineup } from '../data/lineupsApi'
import { summarizeSavedLineup } from '../optimizer/summarizeSavedLineup'

interface SavedLineupsPanelProps {
  lineups: SavedLineup[]
  error: string | null
  onDelete: (id: string) => void
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Saved lineup'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function SavedLineupsPanel({ lineups, error, onDelete }: SavedLineupsPanelProps) {
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h2 className="text-sm uppercase tracking-widest text-muted">Saved Lineups</h2>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {lineups.length === 0 && !error && (
        <p className="text-muted text-sm">No saved lineups yet.</p>
      )}

      {lineups.map((lineup) => {
        const totals = summarizeSavedLineup(lineup.slots)
        return (
          <div key={lineup.id} className="border border-border bg-panel p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs uppercase tracking-widest text-muted">
              <span>{formatSavedAt(lineup.createdAt)}</span>
              <button
                onClick={() => onDelete(lineup.id)}
                className="text-red-400"
                aria-label="Delete saved lineup"
              >
                &times;
              </button>
            </div>

            {lineup.slots.map((slot) => (
              <div key={slot.position} className="flex justify-between text-sm">
                <span className="text-muted uppercase tracking-widest">
                  {slot.position}
                  {slot.isXPlayer ? ' (X)' : ''}
                </span>
                <span>{slot.name}</span>
                <span>{slot.currentSalary}</span>
              </div>
            ))}

            <div className="border-t border-border pt-3 flex justify-between text-xs uppercase tracking-widest text-muted">
              <span>Total Power by Sal</span>
              <span>{totals.totalPowerBySal}</span>
            </div>
            <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
              <span>Total Base Salary</span>
              <span>{totals.totalBaseSalary}</span>
            </div>
            <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
              <span>Total Offense</span>
              <span>{totals.totalOffense}</span>
            </div>
            <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
              <span>Total Defense</span>
              <span>{totals.totalDefense}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
