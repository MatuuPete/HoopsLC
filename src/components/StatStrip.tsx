import { usePlayers } from '../data/usePlayers'
import { useSettings } from '../data/useSettings'

export function StatStrip() {
  const { players } = usePlayers()
  const { salaryCap } = useSettings()
  const totalPower = players.reduce((sum, p) => sum + p.offense + p.defense, 0)

  return (
    <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-panel px-6 py-2 flex gap-8 text-xs uppercase tracking-widest text-muted">
      <span>Players Owned: {players.length}</span>
      <span>Total Power: {totalPower}</span>
      <span>Salary Cap: {salaryCap}</span>
    </footer>
  )
}
