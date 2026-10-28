import { useState } from 'react'
import { awardFor } from '../optimizer/awards'
import { starTeam } from '../optimizer/big3'
import type { Player, Position } from '../optimizer/types'
import { power, sortPlayers, SORT_OPTIONS, type PlayerSort, type SortKey } from '../lib/playerSort'
import { AwardBadge, TierBadge } from './LineupParts'
import { PlayerSortControl, SortArrow, nextSort, usePlayerSort } from './PlayerSortControl'
import { IconButton, PositionFilter, SearchInput, pencilPath, trashPath } from './ui'

interface PlayerTableProps {
  players: Player[]
  onEdit: (player: Player) => void
  onDelete: (id: string) => void
  onSelect?: (player: Player) => void
  selectedId?: string
  /** catalogPlayerId → team for every Team Big 3 star (see big3Stars). */
  stars?: Map<string, string>
}

const th = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted'
const numCell = 'px-4 py-3 text-right font-mono tabular-nums'

/** Marks one of a team's five highest-priced players, who can form a Team Big 3. */
function StarMark({ team }: { team: string }) {
  return (
    <span title={`${team} star: can form a Team Big 3`} className="shrink-0 text-xs leading-none text-star">
      ★<span className="sr-only"> {team} star</span>
    </span>
  )
}

function SalaryChange({ player }: { player: Player }) {
  const delta = player.currentSalary - player.baseSalary
  if (delta === 0) return null
  const up = delta > 0
  return (
    <span className={`ml-2 text-[11px] ${up ? 'text-accent' : 'text-red-400'}`}>
      {up ? '+' : ''}
      {delta}
    </span>
  )
}

/**
 * A column header that sorts the table by `sortKey`: the first click sorts
 * in the key's natural direction, the next flips it.
 */
function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  sort: PlayerSort
  onSort: (sort: PlayerSort) => void
  align?: 'left' | 'right'
}) {
  const active = sort.key === sortKey
  return (
    <th
      className={`${th} ${align === 'right' ? 'text-right' : ''}`}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, sortKey))}
        title={`Sort by ${SORT_OPTIONS[sortKey].label.toLowerCase()}`}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.14em] transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${active ? 'text-text' : ''}`}
      >
        {label}
        <SortArrow dir={active ? sort.dir : 'desc'} className={`h-3 w-3 ${active ? 'text-accent' : 'opacity-0'}`} />
      </button>
    </th>
  )
}

/** The award bonus on top of a catalog stat, e.g. "+10". */
function AwardBonus({ bonus }: { bonus: number | undefined }) {
  if (!bonus) return null
  return <span className="ml-2 text-[11px] text-accent">+{bonus}</span>
}

export function PlayerTable({ players, onEdit, onDelete, onSelect, selectedId, stars }: PlayerTableProps) {
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState<Position | 'ALL'>('ALL')
  const [sort, setSort] = usePlayerSort('roster')

  const query = search.toLowerCase()
  const visible = sortPlayers(
    players.filter(
      (p) =>
        p.name.toLowerCase().includes(query) && (position === 'ALL' || p.positions.includes(position)),
    ),
    sort,
  )

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-panel">
      <div className="flex flex-col gap-3 border-b border-border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-64">
            <SearchInput value={search} onChange={setSearch} placeholder="Search roster" label="Search roster" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <PositionFilter value={position} onChange={setPosition} />
            <span className="font-mono text-xs tabular-nums text-muted sm:hidden">{visible.length}</span>
          </div>
        </div>
        <PlayerSortControl sort={sort} onChange={setSort} className="justify-between sm:justify-start" />
      </div>

      <div className="scrollbar-slim overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <SortHeader label="Player" sortKey="name" sort={sort} onSort={setSort} />
              <SortHeader label="Pos" sortKey="position" sort={sort} onSort={setSort} />
              <SortHeader label="Base" sortKey="salary" sort={sort} onSort={setSort} align="right" />
              <SortHeader label="Current" sortKey="market" sort={sort} onSort={setSort} align="right" />
              <SortHeader label="Off" sortKey="offense" sort={sort} onSort={setSort} align="right" />
              <SortHeader label="Def" sortKey="defense" sort={sort} onSort={setSort} align="right" />
              <SortHeader label="Pwr" sortKey="power" sort={sort} onSort={setSort} align="right" />
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const selected = p.id === selectedId
              const award = awardFor(p.name)
              const team = stars ? starTeam(p, stars) : undefined
              return (
                <tr
                  key={p.id}
                  onClick={onSelect ? () => onSelect(p) : undefined}
                  className={`group border-t border-border/70 transition-colors ${
                    onSelect ? 'cursor-pointer' : ''
                  } ${
                    selected
                      ? 'bg-accent/[0.06] shadow-[inset_2px_0_0_0_#22c55e]'
                      : 'hover:bg-white/[0.025]'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="flex min-w-0 items-center gap-2">
                      {onSelect ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelect(p)
                          }}
                          aria-pressed={selected}
                          className="truncate text-left font-medium text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {p.name}
                        </button>
                      ) : (
                        <span className="truncate font-medium text-text">{p.name}</span>
                      )}
                      {p.xTier && <TierBadge tier={p.xTier} />}
                      {award && <AwardBadge award={award} />}
                      {team && <StarMark team={team} />}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{p.positions.join('/')}</td>
                  <td className={`${numCell} text-muted`}>{p.baseSalary}</td>
                  <td className={`${numCell} text-text`}>
                    {p.currentSalary}
                    <SalaryChange player={p} />
                  </td>
                  <td className={`${numCell} text-text`}>
                    {p.offense}
                    <AwardBonus bonus={award?.offense} />
                  </td>
                  <td className={`${numCell} text-text`}>
                    {p.defense}
                    <AwardBonus bonus={award?.defense} />
                  </td>
                  <td className={`${numCell} font-medium text-text`}>{power(p)}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <span className="flex justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <IconButton label={`Edit ${p.name}`} onClick={() => onEdit(p)}>
                        {pencilPath}
                      </IconButton>
                      <IconButton label={`Delete ${p.name}`} tone="danger" onClick={() => onDelete(p.id)}>
                        {trashPath}
                      </IconButton>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {players.length === 0 && (
        <p className="border-t border-border px-4 py-10 text-center text-sm text-muted">
          Your roster is empty. Add a player from the catalog to get started.
        </p>
      )}
      {players.length > 0 && visible.length === 0 && (
        <p className="border-t border-border px-4 py-10 text-center text-sm text-muted">
          No players match these filters.
        </p>
      )}
    </section>
  )
}
