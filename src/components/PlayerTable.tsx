import type { Player } from '../optimizer/types'

interface PlayerTableProps {
  players: Player[]
  onEdit: (player: Player) => void
  onDelete: (id: string) => void
}

export function PlayerTable({ players, onEdit, onDelete }: PlayerTableProps) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left text-muted uppercase tracking-widest text-xs border-b border-border">
          <th className="py-2">Name</th>
          <th>Pos</th>
          <th>X</th>
          <th>Base</th>
          <th>Current</th>
          <th>Off</th>
          <th>Def</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.id} className="border-b border-border">
            <td className="py-2">{p.name}</td>
            <td>{p.positions.join('/')}</td>
            <td>{p.isXPlayer ? 'X' : ''}</td>
            <td>{p.baseSalary}</td>
            <td>{p.currentSalary}</td>
            <td>{p.offense}</td>
            <td>{p.defense}</td>
            <td className="flex gap-2 py-2">
              <button onClick={() => onEdit(p)} className="text-xs uppercase underline">
                Edit
              </button>
              <button onClick={() => onDelete(p.id)} className="text-xs uppercase underline text-red-400">
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
