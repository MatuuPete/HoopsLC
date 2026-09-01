import type { LineupResult, LineupSlot, Player } from '../optimizer/types'

function sumOffense(slots: LineupSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.player.offense, 0)
}

function sumDefense(slots: LineupSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.player.defense, 0)
}

function sumStatPower(slots: LineupSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.player.offense + slot.player.defense, 0)
}

interface LineupResultPanelProps {
  result: LineupResult | null
  players: Player[]
}

export function LineupResultPanel({ result, players }: LineupResultPanelProps) {
  if (!result) return null

  if (!result.success && result.reason === 'missing_position') {
    return (
      <div className="border border-border bg-panel p-4 text-sm text-red-400">
        Missing owned players for: {result.missingPositions.join(', ')}
      </div>
    )
  }

  if (!result.success && result.reason === 'required_players_conflict') {
    const names = result.conflictingPlayerIds
      .map((id) => players.find((p) => p.id === id)?.name ?? id)
      .join(', ')
    return (
      <div className="border border-border bg-panel p-4 text-sm text-red-400">
        Preferred players can't all fit in one lineup: {names}. Try unchecking one.
      </div>
    )
  }

  if (!result.success && result.reason === 'no_valid_x_slot') {
    return (
      <div className="border border-border bg-panel p-4 text-sm text-red-400">
        No valid lineup: every lineup needs exactly one X Player. Positions with no X Player:{' '}
        {result.positionsWithoutXPlayer.join(', ') || 'none'}. Positions with no regular player:{' '}
        {result.positionsWithoutRegularPlayer.join(', ') || 'none'}.
      </div>
    )
  }

  if (!result.success && result.reason === 'cap_too_low') {
    return (
      <div className="border border-border bg-panel p-4 flex flex-col gap-3">
        <p className="text-sm text-red-400">
          No lineup fits under this cap. Closest possible lineup costs {result.cheapestPossibleBaseSalary}{' '}
          base salary.
        </p>
        {result.closestLineup.map((slot) => (
          <div key={slot.position} className="flex justify-between text-sm">
            <span className="text-muted uppercase tracking-widest">
              {slot.position}
              {slot.player.isXPlayer ? ' (X)' : ''}
            </span>
            <span>{slot.player.name}</span>
            <span>{slot.player.currentSalary}</span>
          </div>
        ))}
        <div className="border-t border-border pt-3 flex justify-between text-xs uppercase tracking-widest text-muted">
          <span>Closest Total Base Salary</span>
          <span>{result.cheapestPossibleBaseSalary}</span>
        </div>
        <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
          <span>Closest Total Power by Sal</span>
          <span>{result.closestTotalCurrentSalary}</span>
        </div>
        <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
          <span>Closest Total Power by Stats</span>
          <span>{sumStatPower(result.closestLineup)}</span>
        </div>
        <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
          <span>Closest Total Offense</span>
          <span>{sumOffense(result.closestLineup)}</span>
        </div>
        <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
          <span>Closest Total Defense</span>
          <span>{sumDefense(result.closestLineup)}</span>
        </div>
      </div>
    )
  }

  if (!result.success) return null

  return (
    <div className="border border-border bg-panel p-4 flex flex-col gap-3">
      {result.slots.map((slot) => (
        <div key={slot.position} className="flex justify-between text-sm">
          <span className="text-muted uppercase tracking-widest">
            {slot.position}
            {slot.player.isXPlayer ? ' (X)' : ''}
          </span>
          <span>{slot.player.name}</span>
          <span>{slot.player.currentSalary}</span>
        </div>
      ))}
      <div className="border-t border-border pt-3 flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Base Salary</span>
        <span>{result.totalBaseSalary}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Power by Sal</span>
        <span>{result.totalCurrentSalary}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Power by Stats</span>
        <span>{sumStatPower(result.slots)}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Remaining Cap</span>
        <span>{result.remainingCap}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Offense</span>
        <span>{sumOffense(result.slots)}</span>
      </div>
      <div className="flex justify-between text-xs uppercase tracking-widest text-muted">
        <span>Total Defense</span>
        <span>{sumDefense(result.slots)}</span>
      </div>
    </div>
  )
}
