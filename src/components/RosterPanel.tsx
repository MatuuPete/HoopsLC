import type { ReactNode } from 'react'
import { X_TIERS, type Player } from '../optimizer/types'
import {
  positionalCoverage,
  valueRanking,
  salaryMovers,
  playerValueRank,
} from '../optimizer/rosterInsights'
import { Eyebrow, TierBadge } from './LineupParts'
import { buttonDanger, buttonSecondary } from './ui'

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
    <aside className="scrollbar-slim rounded-xl border border-border bg-panel lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
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
    </aside>
  )
}

function Bar({ fraction, tone = 'bg-accent/70' }: { fraction: number; tone?: string }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 p-5">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </div>
  )
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

function InspectorStat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className={`font-mono text-lg tabular-nums leading-none ${tone ?? 'text-text'}`}>{value}</span>
    </div>
  )
}

function PlayerInspector({ player, players, onEdit, onDelete, onBack }: PlayerInspectorProps) {
  const change = player.currentSalary - player.baseSalary
  const power = player.offense + player.defense
  const rank = playerValueRank(players, player.id)

  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="flex flex-col gap-4 p-5">
        <button
          onClick={onBack}
          className="-ml-1 flex w-fit items-center gap-1.5 rounded px-1 text-xs text-muted transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
            <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Roster insights
        </button>
        <div className="flex flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-xl font-medium text-text">{player.name}</h2>
            {player.xTier && <TierBadge tier={player.xTier} />}
          </div>
          <span className="font-mono text-xs text-muted">
            {player.positions.join(' / ')}
            {player.xTier ? ` · ${X_TIERS[player.xTier].label}` : ''}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 p-5">
        <InspectorStat label="Base" value={player.baseSalary} />
        <InspectorStat label="Current" value={player.currentSalary} />
        <InspectorStat
          label="Change"
          value={change === 0 ? '0' : signed(change)}
          tone={change > 0 ? 'text-accent' : change < 0 ? 'text-red-400' : undefined}
        />
        <InspectorStat label="Offense" value={player.offense} />
        <InspectorStat label="Defense" value={player.defense} />
        <InspectorStat label="Power" value={power} />
      </div>

      <div className="flex items-baseline justify-between gap-3 p-5">
        <span className="text-xs text-muted">Value (power per salary)</span>
        <span className="font-mono text-sm tabular-nums text-text">
          {rank ? (
            <>
              {rank.value.toFixed(3)}
              <span className="text-muted">
                {' '}
                · #{rank.rank} of {rank.total}
              </span>
            </>
          ) : (
            '—'
          )}
        </span>
      </div>

      <div className="flex gap-2 p-5">
        <button onClick={() => onEdit(player)} className={`${buttonSecondary} flex-1`}>
          Edit player
        </button>
        <button onClick={() => onDelete(player.id)} className={buttonDanger}>
          Delete
        </button>
      </div>
    </div>
  )
}

// --- Dashboard --------------------------------------------------------------

function RosterDashboard({ players }: { players: Player[] }) {
  if (players.length === 0) {
    return (
      <div className="p-5">
        <Eyebrow>Roster insights</Eyebrow>
        <p className="mt-3 text-sm text-muted">Coverage, value and salary changes appear once you add players.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      <CoverageSection players={players} />
      <ValueSection players={players} />
      <MoversSection players={players} />
      <p className="px-5 py-3 text-[11px] text-muted">Select a player in the table to see their details.</p>
    </div>
  )
}

function CoverageSection({ players }: { players: Player[] }) {
  const coverage = positionalCoverage(players)
  const max = Math.max(1, ...coverage.map((c) => c.count))
  const gaps = coverage.filter((c) => c.count === 0).map((c) => c.position)
  const xCount = players.filter((p) => p.isXPlayer).length

  return (
    <Section title="Positional coverage">
      <div className="flex flex-col gap-2">
        {coverage.map((c) => (
          <div key={c.position} className="flex items-center gap-3">
            <span className="w-7 font-mono text-xs text-muted">{c.position}</span>
            <Bar fraction={c.count / max} tone={c.count === 0 ? 'bg-red-400' : 'bg-accent/70'} />
            <span className="w-6 text-right font-mono text-xs tabular-nums text-text">{c.count}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={gaps.length ? 'text-red-400' : 'text-accent'}>
          {gaps.length ? `No players at ${gaps.join(', ')}` : 'All positions covered'}
        </span>
        <span className="text-muted">
          X Players <span className="font-mono tabular-nums text-text">{xCount}</span>
        </span>
      </div>
    </Section>
  )
}

function ValueSection({ players }: { players: Player[] }) {
  const ranking = valueRanking(players)

  if (ranking.length === 0) {
    return (
      <Section title="Value leaderboard">
        <p className="text-sm text-muted">Add priced players to see value.</p>
      </Section>
    )
  }

  const max = ranking[0].value
  const bargains = ranking.slice(0, 3)
  const overpriced = ranking.length > 3 ? ranking.slice(-Math.min(3, ranking.length - 3)).reverse() : []

  const line = (entry: (typeof ranking)[number], tone: string) => (
    <div key={entry.player.id} className="grid grid-cols-[minmax(0,1fr)_4rem_3rem] items-center gap-3">
      <span className="truncate text-sm text-text">{entry.player.name}</span>
      <Bar fraction={entry.value / max} tone={tone} />
      <span className="text-right font-mono text-xs tabular-nums text-text">{entry.value.toFixed(3)}</span>
    </div>
  )

  return (
    <Section title="Value leaderboard">
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted">Best value</span>
        {bargains.map((e) => line(e, 'bg-accent/70'))}
      </div>
      {overpriced.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-xs text-muted">Weakest value</span>
          {overpriced.map((e) => line(e, 'bg-muted/60'))}
        </div>
      )}
    </Section>
  )
}

function MoversSection({ players }: { players: Player[] }) {
  const movers = salaryMovers(players).slice(0, 5)

  return (
    <Section title="Salary movers">
      {movers.length === 0 ? (
        <p className="text-sm text-muted">No salary changes yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {movers.map((m) => {
            const up = m.delta > 0
            return (
              <div key={m.player.id} className="grid grid-cols-[minmax(0,1fr)_auto_3rem] items-center gap-3">
                <span className="truncate text-sm text-text">{m.player.name}</span>
                <span className="font-mono text-xs tabular-nums text-muted">
                  {m.player.baseSalary} → {m.player.currentSalary}
                </span>
                <span className={`text-right font-mono text-xs tabular-nums ${up ? 'text-accent' : 'text-red-400'}`}>
                  {signed(m.delta)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}
