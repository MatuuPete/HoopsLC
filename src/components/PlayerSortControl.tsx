import { useState } from 'react'
import {
  DEFAULT_SORT,
  SORT_GROUPS,
  SORT_OPTIONS,
  type PlayerSort,
  type SortKey,
} from '../lib/playerSort'

const STORAGE_PREFIX = 'sixman.sort.'

function readSort(storageKey: string, fallback: PlayerSort): PlayerSort {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + storageKey) ?? 'null')
    if (saved && saved.key in SORT_OPTIONS && (saved.dir === 'asc' || saved.dir === 'desc')) return saved
  } catch {
    // Storage blocked or bad JSON: use the fallback.
  }
  return fallback
}

/** A list's sort, remembered on this device so it survives reloads. */
export function usePlayerSort(storageKey: string, fallback: PlayerSort = DEFAULT_SORT) {
  const [sort, setSortState] = useState(() => readSort(storageKey, fallback))
  function setSort(next: PlayerSort) {
    setSortState(next)
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(next))
    } catch {
      // Not remembered, but the sort still applies.
    }
  }
  return [sort, setSort] as const
}

/** Picking a key starts in its natural direction; picking the current key again flips it. */
export function nextSort(current: PlayerSort, key: SortKey): PlayerSort {
  if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  return { key, dir: SORT_OPTIONS[key].defaultDir }
}

/** Arrow for a sort direction: down for descending, up for ascending. */
export function SortArrow({ dir, className = 'h-3 w-3' }: { dir: 'asc' | 'desc'; className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" aria-hidden>
      <path
        d={dir === 'desc' ? 'M6 2.5v7m0 0L3 6.5m3 3 3-3' : 'M6 9.5v-7m0 0L3 5.5m3-3 3 3'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * "Sort by [key] [direction]": a grouped dropdown of every sort key and a
 * button that flips the direction, labelled in words ("High to low").
 */
export function PlayerSortControl({
  sort,
  onChange,
  className = '',
}: {
  sort: PlayerSort
  onChange: (sort: PlayerSort) => void
  className?: string
}) {
  const option = SORT_OPTIONS[sort.key]
  const flipped = sort.dir === 'asc' ? 'desc' : 'asc'
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      <label className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 text-xs text-muted">Sort by</span>
        <span className="relative min-w-0">
          <select
            value={sort.key}
            onChange={(e) => onChange({ key: e.target.value as SortKey, dir: SORT_OPTIONS[e.target.value as SortKey].defaultDir })}
            className="w-full min-w-0 cursor-pointer appearance-none truncate rounded-md border border-border bg-bg py-1 pl-2 pr-6 text-xs font-medium text-text [color-scheme:dark] hover:border-muted focus:border-accent/60 focus:outline-none"
          >
            {SORT_GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {(Object.keys(SORT_OPTIONS) as SortKey[])
                  .filter((key) => SORT_OPTIONS[key].group === group)
                  .map((key) => (
                    <option key={key} value={key}>
                      {SORT_OPTIONS[key].label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <svg
            viewBox="0 0 16 16"
            className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted"
            fill="none"
            aria-hidden
          >
            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </label>
      <button
        type="button"
        onClick={() => onChange({ key: sort.key, dir: flipped })}
        aria-label={`${option.dirLabel[sort.dir]}. Switch to ${option.dirLabel[flipped].toLowerCase()}`}
        title={`Switch to ${option.dirLabel[flipped].toLowerCase()}`}
        className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <SortArrow dir={sort.dir} />
        <span className="whitespace-nowrap">{option.dirLabel[sort.dir]}</span>
      </button>
    </div>
  )
}
