import type { ReactNode } from 'react'
import type { Player } from '../optimizer/types'
import {
  positionalCoverage,
  valueRanking,
  salaryMovers,
  playerValueRank,
} from '../optimizer/rosterInsights'

interface RosterPanelProps {
  players: Player[]
  selectedPlayerId: string | null
  onEdit: (player: Player) => void
  onDelete: (id: string) => void
  onClearSelection: () => void
}

export function RosterPanel({
  players,
  selectedPlayerId,
  onEdit,
  onDelete,
  onClearSelection,
}: RosterPanelProps) {
  const selected = players.find((p) => p.id === selectedPlayerId)

  return (
    <div className="border border-border bg-panel p-4 flex flex-col gap-4 self-start max-h-[calc(100vh-8rem)] overflow-y-auto">
      {selected ? (
        <PlayerInspector
          player={selected}
          players={players}
          onEdit={onEdit}
          onDelete={onDelete}
          onBack={onClearSelection}
        />
      ) : (
        <RosterDashboard players={players} />
      )}
    </div>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: ReactNode
  value: ReactNode
  tone?: 'up' | 'down'
}) {
  const toneClass = tone === 'up' ? 'text-accent' : tone === 'down' ? 'text-red-400' : 'text-text'
  return (
    <div className="flex justify-between gap-3 text-xs uppercase tracking-widest text-muted">
      <span>{label}</span>
      <span className={toneClass}>{value}</span>
    </div>
  )
}

function Bar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <div className="h-1 flex-1 bg-border">
      <div className="h-full bg-muted" style={{ width: `${pct}%` }} />
    </div>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-xs uppercase tracking-widest text-muted">{children}</h3>
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

// --- Inspector ---------------------------------------------------------------

interface PlayerInspectorProps {
  player: Player
  players: Player[]
  onEdit: (player: Player) => void
  onDelete: (id: string) => void
  onBack: () => void
}

function PlayerInspector({ player, players, onEdit, onDelete, onBack }: PlayerInspectorProps) {
  const change = player.currentSalary - player.baseSalary
  const power = player.offense + player.defense
  const rank = playerValueRank(players, player.id)

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={onBack}
        className="border border-border px-4 py-2 uppercase tracking-widest text-xs w-full text-left hover:bg-border"
      >
        &larr; Back to Roster Insights
      </button>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm uppercase tracking-widest text-text truncate">{player.name}</span>
        <span className="text-xs uppercase tracking-widest text-muted">
          {player.positions.join('/')}
          {player.isXPlayer ? ' · X Player' : ''}
        </span>
      </div>

      <div className="border-t border-border pt-3 flex flex-col gap-1">
        <Row label="Base Salary" value={player.baseSalary} />
        <Row label="Current Salary" value={player.currentSalary} />
        <Row
          label="Change"
          value={change === 0 ? '0' : signed(change)}
          tone={change > 0 ? 'up' : change < 0 ? 'down' : undefined}
        />
      </div>

      <div className="border-t border-border pt-3 flex flex-col gap-1">
        <Row label="Offense" value={player.offense} />
        <Row label="Defense" value={player.defense} />
        <Row label="Power" value={power} />
      </div>

      <div className="border-t border-border pt-3">
        <Row
          label="Value"
          value={rank ? `${rank.value.toFixed(3)} · #${rank.rank} of ${rank.total}` : '—'}
        />
      </div>

      <div className="border-t border-border pt-3 flex gap-4">
        <button
          onClick={() => onEdit(player)}
          className="text-xs uppercase tracking-widest underline"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(player.id)}
          className="text-xs uppercase tracking-widest underline text-red-400"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// --- Dashboard --------------------------------------------------------------

function RosterDashboard({ players }: { players: Player[] }) {
  if (players.length === 0) {
    return <p className="text-muted text-sm">No players yet.</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <CoverageSection players={players} />
      <div className="border-t border-border pt-4">
        <ValueSection players={players} />
      </div>
      <div className="border-t border-border pt-4">
        <MoversSection players={players} />
      </div>
    </div>
  )
}

function CoverageSection({ players }: { players: Player[] }) {
  const coverage = positionalCoverage(players)
  const max = Math.max(1, ...coverage.map((c) => c.count))
  const gaps = coverage.filter((c) => c.count === 0).map((c) => c.position)
  const xCount = players.filter((p) => p.isXPlayer).length

  return (
    <div className="flex flex-col gap-2">
      <SectionHeading>Positional Coverage</SectionHeading>
      {coverage.map((c) => (
        <div
          key={c.position}
          className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted"
        >
          <span className="w-6 text-text">{c.position}</span>
          <Bar fraction={c.count / max} />
          <span className="w-6 text-right text-text">{c.count}</span>
        </div>
      ))}
      <div className="flex justify-between gap-3 text-xs uppercase tracking-widest">
        <span className={gaps.length ? 'text-red-400' : 'text-accent'}>
          {gaps.length ? `No players at ${gaps.join(', ')}` : 'All positions covered'}
        </span>
        <span className="text-muted">X Players: {xCount}</span>
      </div>
    </div>
  )
}

function ValueSection({ players }: { players: Player[] }) {
  const ranking = valueRanking(players)

  if (ranking.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <SectionHeading>Value Leaderboard</SectionHeading>
        <p className="text-xs uppercase tracking-widest text-muted">Add priced players to see value.</p>
      </div>
    )
  }

  const max = ranking[0].value
  const bargains = ranking.slice(0, 3)
  const overpriced = ranking.length > 3 ? ranking.slice(-Math.min(3, ranking.length - 3)).reverse() : []

  const line = (entry: (typeof ranking)[number]) => (
    <div
      key={entry.player.id}
      className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted"
    >
      <span className="flex-1 text-text truncate">{entry.player.name}</span>
      <Bar fraction={entry.value / max} />
      <span className="w-12 text-right text-text">{entry.value.toFixed(3)}</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-2">
      <SectionHeading>Value Leaderboard</SectionHeading>
      <p className="text-xs uppercase tracking-widest text-muted">Bargains</p>
      {bargains.map(line)}
      {overpriced.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-widest text-muted pt-1">Overpriced</p>
          {overpriced.map(line)}
        </>
      )}
    </div>
  )
}

function MoversSection({ players }: { players: Player[] }) {
  const movers = salaryMovers(players).slice(0, 5)

  return (
    <div className="flex flex-col gap-2">
      <SectionHeading>Salary Movers</SectionHeading>
      {movers.length === 0 ? (
        <p className="text-xs uppercase tracking-widest text-muted">No salary changes yet.</p>
      ) : (
        movers.map((m) => {
          const up = m.delta > 0
          return (
            <div
              key={m.player.id}
              className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted"
            >
              <span className={up ? 'text-accent' : 'text-red-400'}>{up ? '▲' : '▼'}</span>
              <span className="flex-1 text-text truncate">{m.player.name}</span>
              <span>
                {m.player.baseSalary} &rarr; {m.player.currentSalary}
              </span>
              <span className={`w-12 text-right ${up ? 'text-accent' : 'text-red-400'}`}>
                {signed(m.delta)}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
