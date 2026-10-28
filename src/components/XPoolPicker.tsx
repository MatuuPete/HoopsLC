import { useState } from 'react'
import { conferenceOf, type Conference, type XPoolPlayer } from '../catalog/xPool'
import { TierBadge } from './LineupParts'
import { FormCard, SearchInput } from './ui'

type ConferenceFilter = 'All' | Conference

const FILTERS: ConferenceFilter[] = ['All', 'East', 'West']

interface XPoolPickerProps {
  pool: XPoolPlayer[]
  /** Pool entries the user already owns; shown but not addable twice. */
  ownedPoolIds: Set<string>
  onSelect: (player: XPoolPlayer) => Promise<void>
  onCustom: () => void
  onCancel: () => void
}

/**
 * Add an X Player by picking from the shared X Pool, filtered by conference
 * like the game's own X Pool screen. One click adds the player with the
 * pool's team, positions and stats.
 */
export function XPoolPicker({ pool, ownedPoolIds, onSelect, onCustom, onCancel }: XPoolPickerProps) {
  const [search, setSearch] = useState('')
  const [conference, setConference] = useState<ConferenceFilter>('All')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  const query = search.trim().toLowerCase()
  const filtered = pool.filter(
    (p) =>
      (conference === 'All' || conferenceOf(p.team) === conference) &&
      (query === '' || p.name.toLowerCase().includes(query) || p.team.toLowerCase().includes(query)),
  )

  async function handleSelect(player: XPoolPlayer) {
    setAddingId(player.id)
    setAddError(null)
    try {
      await onSelect(player)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add X Player')
      setAddingId(null)
    }
  }

  return (
    <FormCard eyebrow="Add X Player" title="Choose from the X Pool" onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="radiogroup" aria-label="Conference" className="flex gap-5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={conference === f}
                onClick={() => setConference(f)}
                className={`border-b-2 pb-1 text-xs font-semibold uppercase tracking-[0.16em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  conference === f ? 'border-star text-star' : 'border-transparent text-muted hover:text-text'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="sm:w-56">
            <SearchInput value={search} onChange={setSearch} placeholder="Search name or team" label="Search the X Pool" />
          </div>
        </div>

        {addError && <p className="text-sm text-red-400">{addError}</p>}

        <div className="scrollbar-slim -mx-1 max-h-[26rem] overflow-y-auto px-1">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((player) => {
              const owned = ownedPoolIds.has(player.id)
              const adding = addingId === player.id
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    disabled={owned || addingId !== null}
                    onClick={() => handleSelect(player)}
                    title={owned ? 'Already on your roster' : `Add ${player.name}`}
                    className={`flex h-full w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                      owned
                        ? 'cursor-default border-border/60 bg-bg/40 opacity-50'
                        : 'border-border bg-bg hover:border-star/40 hover:bg-star/[0.03] disabled:cursor-wait'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-text">{player.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted">
                          <span aria-hidden className="text-star">
                            ★
                          </span>
                          {player.team}
                          <span className="text-border">·</span>
                          {player.positions.join('/')}
                        </span>
                      </span>
                      <TierBadge tier={player.tier} />
                    </span>
                    <span className="mt-auto flex items-baseline justify-between font-mono text-[11px] tabular-nums">
                      <span>
                        <span className="text-muted">OFF</span> <span className="text-text">{player.offense}</span>
                        <span className="px-1 text-border">/</span>
                        <span className="text-muted">DEF</span> <span className="text-text">{player.defense}</span>
                      </span>
                      <span className={owned ? 'text-muted' : 'text-star/80'}>
                        {owned ? 'Owned' : adding ? 'Adding…' : '+ Add'}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {filtered.length === 0 && (
            <p className="px-2 py-8 text-center text-sm text-muted">
              {pool.length === 0 ? 'The X Pool is empty. An admin can import it on the Catalog page.' : 'No X Players match.'}
            </p>
          )}
        </div>

        <p className="border-t border-border pt-3 text-xs text-muted">
          Not in the pool?{' '}
          <button
            type="button"
            onClick={onCustom}
            className="text-text underline decoration-border underline-offset-2 hover:decoration-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Add a custom X Player
          </button>
        </p>
      </div>
    </FormCard>
  )
}
