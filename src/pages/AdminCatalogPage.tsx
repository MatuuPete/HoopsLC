import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useCatalog } from '../data/useCatalog'
import { parseCatalogImport } from '../catalog/parseCatalogImport'
import { diffCatalogImport } from '../catalog/diffCatalogImport'
import type { CatalogDiffEntry, CatalogDiffStatus, CatalogPlayer } from '../catalog/types'
import { useXPool } from '../data/useXPool'
import { diffXPoolImport, parseXPoolImport, type XPoolDiffEntry, type XPoolPlayer } from '../catalog/xPool'
import { Eyebrow, TierBadge } from '../components/LineupParts'
import { SearchInput, buttonPrimary, buttonSecondary } from '../components/ui'

type Tab = 'catalog' | 'xpool'

/** Each dataset keeps the color it has across the app: green catalog, gold X Pool. */
const TONES = {
  accent: {
    text: 'text-accent',
    border: 'border-accent',
    line: 'bg-accent',
    soft: 'bg-accent/[0.06]',
    ring: 'border-accent/40',
    focus: 'focus:border-accent/60',
  },
  star: {
    text: 'text-star',
    border: 'border-star',
    line: 'bg-star',
    soft: 'bg-star/[0.06]',
    ring: 'border-star/40',
    focus: 'focus:border-star/60',
  },
} as const
type Tone = keyof typeof TONES

const CATALOG_EXAMPLE = `[
  { "name": "Nikola Jokic", "team": "DEN", "positions": ["C"], "price": 2400, "offense": 249, "defense": 119 },
  { "name": "Jamal Murray", "team": "DEN" }
]`

const XPOOL_EXAMPLE = `[
  { "name": "Carmelo Anthony", "team": "DEN", "positions": ["SF", "PF"], "offense": 267, "defense": 183 },
  { "name": "Some Legend", "team": "LAL", "positions": ["SG"], "offense": 300, "defense": 200, "tier": "legend" }
]`

/** Which dataset a pasted batch looks like, from its first row, to catch a paste into the wrong tab. */
function looksLike(raw: string): Tab | null {
  try {
    const value: unknown = JSON.parse(raw)
    const first = Array.isArray(value) ? value[0] : value
    if (typeof first !== 'object' || first === null) return null
    if ('price' in first) return 'catalog'
    if ('positions' in first && 'offense' in first) return 'xpool'
    if ('team' in first && !('positions' in first)) return 'catalog'
  } catch {
    return null
  }
  return null
}

const TAB_LABELS: Record<Tab, string> = { catalog: 'Player Catalog', xpool: 'X Pool' }

export function AdminCatalogPage() {
  const catalog = useCatalog()
  const xPool = useXPool()
  const [tab, setTab] = useState<Tab>('catalog')
  const [raw, setRaw] = useState<Record<Tab, string>>({ catalog: '', xpool: '' })

  const teamCount = useMemo(
    () => new Set(catalog.catalog.flatMap((p) => (p.team ? [p.team] : []))).size,
    [catalog.catalog],
  )
  const lastUpdated = useMemo(() => {
    const latest = catalog.catalog.reduce((max, p) => (p.updatedAt > max ? p.updatedAt : max), '')
    return latest ? new Date(latest).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'
  }, [catalog.catalog])

  /** Moves a batch pasted into the wrong tab over to the right one. */
  function moveTo(target: Tab) {
    setRaw((current) => ({ ...current, [target]: current[tab], [tab]: '' }))
    setTab(target)
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 font-body sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-border pb-6">
        <div>
          <h1 className="font-display text-4xl uppercase leading-none tracking-wide text-text sm:text-5xl">
            Catalog admin
          </h1>
          <p className="mt-3 text-sm text-muted">
            The shared player data every roster is built from. Changes here reach every user.
          </p>
        </div>
        <dl className="flex gap-6 sm:gap-8">
          <HeaderStat label="Catalog players" value={catalog.catalog.length} />
          <HeaderStat label="Teams" value={teamCount} />
          <HeaderStat label="X Pool" value={xPool.pool.length} />
          <HeaderStat label="Catalog updated" value={lastUpdated} />
        </dl>
      </header>

      <div role="tablist" aria-label="Dataset" className="mt-6 flex gap-6 border-b border-border">
        {(['catalog', 'xpool'] as Tab[]).map((t) => {
          const tone = TONES[t === 'catalog' ? 'accent' : 'star']
          const active = tab === t
          const count = t === 'catalog' ? catalog.catalog.length : xPool.pool.length
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                active ? `${tone.border} text-text` : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {TAB_LABELS[t]}
              <span
                className={`rounded-full px-1.5 font-mono text-[11px] tabular-nums ${
                  active ? `${tone.soft} ${tone.text}` : 'bg-white/[0.06] text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {tab === 'catalog' ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8">
          <ImportWorkbench<CatalogDiffEntry>
            key="catalog"
            tone="accent"
            noun={['player', 'players']}
            raw={raw.catalog}
            onRawChange={(value) => setRaw((r) => ({ ...r, catalog: value }))}
            disabled={catalog.loading || !!catalog.error}
            loadError={catalog.error}
            analyze={(text) => diffCatalogImport(parseCatalogImport(text, catalog.catalog), catalog.catalog)}
            wrongTab={looksLike(raw.catalog) === 'xpool' ? { label: 'X Pool', onMove: () => moveTo('xpool') } : null}
            renderFields={(e) => <CatalogFields entry={e} />}
            onImport={(entries) => catalog.importBatch(entries.map((e) => e.row))}
            doneNote="Owned players linked to these catalog players now show the new prices and ratings."
            format={{
              example: CATALOG_EXAMPLE,
              notes: (
                <>
                  A full row adds a player or updates them. A row with only <Code>name</Code> and{' '}
                  <Code>team</Code> sets just the team and keeps the current price and ratings. Positions are
                  any of PG, SG, SF, PF, C.
                </>
              ),
            }}
          />
          <CatalogTable players={catalog.catalog} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8">
          <ImportWorkbench<XPoolDiffEntry>
            key="xpool"
            tone="star"
            noun={['X Player', 'X Players']}
            raw={raw.xpool}
            onRawChange={(value) => setRaw((r) => ({ ...r, xpool: value }))}
            disabled={xPool.loading || !!xPool.error}
            loadError={xPool.error}
            analyze={(text) => diffXPoolImport(parseXPoolImport(text), xPool.pool)}
            wrongTab={
              looksLike(raw.xpool) === 'catalog'
                ? { label: 'Player Catalog', onMove: () => moveTo('catalog') }
                : null
            }
            renderFields={(e) => <XPoolFields entry={e} />}
            onImport={(entries) => xPool.importBatch(entries.map((e) => e.row))}
            doneNote="Owned X Players with the same names are linked and now match the pool, for every user."
            format={{
              example: XPOOL_EXAMPLE,
              notes: (
                <>
                  Every row needs <Code>name</Code>, <Code>team</Code>, <Code>positions</Code>,{' '}
                  <Code>offense</Code> and <Code>defense</Code>. Offense plus defense must total 450, or 500
                  with <Code>"tier": "legend"</Code>.
                </>
              ),
            }}
          />
          <XPoolTable pool={xPool.pool} />
        </div>
      )}
    </div>
  )
}

function HeaderStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-xl tabular-nums leading-none text-text">{value}</dd>
    </div>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-white/[0.06] px-1 py-px font-mono text-[11px] text-text/90">{children}</code>
}

// --- Import ---------------------------------------------------------------

type Step = 'paste' | 'review' | 'done'
type Filter = 'changes' | CatalogDiffStatus | 'all'

interface DiffEntryLike {
  status: CatalogDiffStatus
  row: { name: string }
}

interface ImportWorkbenchProps<E extends DiffEntryLike> {
  tone: Tone
  /** Singular and plural name for a row, e.g. ['X Player', 'X Players']. */
  noun: [string, string]
  raw: string
  onRawChange: (raw: string) => void
  disabled: boolean
  loadError: string | null
  /** Parses and compares a batch against what's live; throws a row-level error. */
  analyze: (raw: string) => E[]
  /** Set when the pasted batch belongs to the other tab. */
  wrongTab: { label: string; onMove: () => void } | null
  renderFields: (entry: E) => ReactNode
  onImport: (entries: E[]) => Promise<void>
  doneNote: string
  format: { example: string; notes: ReactNode }
}

const STEPS: { id: Step; label: string }[] = [
  { id: 'paste', label: 'Paste' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
]

/** Paste or upload a batch, review every change against what's live, then import it. */
function ImportWorkbench<E extends DiffEntryLike>({
  tone,
  noun,
  raw,
  onRawChange,
  disabled,
  loadError,
  analyze,
  wrongTab,
  renderFields,
  onImport,
  doneNote,
  format,
}: ImportWorkbenchProps<E>) {
  const t = TONES[tone]
  const [step, setStep] = useState<Step>('paste')
  const [entries, setEntries] = useState<E[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('changes')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [imported, setImported] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)

  const counts = {
    new: entries.filter((e) => e.status === 'new').length,
    changed: entries.filter((e) => e.status === 'changed').length,
    unchanged: entries.filter((e) => e.status === 'unchanged').length,
  }
  const changeCount = counts.new + counts.changed
  const visible = entries.filter((e) =>
    filter === 'all' ? true : filter === 'changes' ? e.status !== 'unchanged' : e.status === filter,
  )
  const plural = (n: number) => `${n} ${n === 1 ? noun[0] : noun[1]}`

  function handleReview() {
    setParseError(null)
    try {
      const next = analyze(raw)
      setEntries(next)
      setFilter(next.some((e) => e.status !== 'unchanged') ? 'changes' : 'all')
      setStep('review')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'This batch could not be read.')
    }
  }

  async function handleImport() {
    setImporting(true)
    setImportError(null)
    try {
      await onImport(entries)
      setImported(entries.length)
      onRawChange('')
      setStep('done')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    onRawChange(await file.text())
    setParseError(null)
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <section aria-label="Import" className="flex flex-col self-start rounded-xl border border-border bg-panel">
      <ol className="flex items-center gap-2 border-b border-border px-5 py-4">
        {STEPS.map((s, i) => {
          const reached = i <= stepIndex
          return (
            <li key={s.id} className="flex items-center gap-2" aria-current={i === stepIndex ? 'step' : undefined}>
              {i > 0 && <span aria-hidden className={`h-px w-6 sm:w-10 ${reached ? t.line : 'bg-border'}`} />}
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[11px] ${
                  reached ? `${t.border} ${t.text}` : 'border-border text-muted'
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-xs font-medium ${i === stepIndex ? 'text-text' : 'text-muted'}`}>{s.label}</span>
            </li>
          )
        })}
      </ol>

      {loadError && <p className="px-5 pt-4 text-sm text-red-400">Couldn't load the current data: {loadError}</p>}

      {step === 'paste' && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`batch-${tone}`}>
              <Eyebrow>Batch JSON</Eyebrow>
            </label>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="text-xs text-muted underline decoration-border underline-offset-2 hover:text-text hover:decoration-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Upload .json file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
          <textarea
            id={`batch-${tone}`}
            spellCheck={false}
            placeholder={`Paste a JSON array of ${noun[1]}…`}
            className={`h-64 w-full resize-y rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-xs leading-relaxed text-text placeholder:text-muted/60 focus:outline-none ${t.focus}`}
            value={raw}
            onChange={(e) => {
              onRawChange(e.target.value)
              setParseError(null)
            }}
          />

          {wrongTab ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-400/25 bg-red-400/[0.05] px-3 py-2.5 text-sm">
              <span className="text-red-300">This looks like {wrongTab.label} data.</span>
              <button type="button" onClick={wrongTab.onMove} className={`${buttonSecondary} py-1.5 text-xs`}>
                Move it to {wrongTab.label}
              </button>
            </div>
          ) : (
            parseError && (
              <p role="alert" className="rounded-md border border-red-400/25 bg-red-400/[0.05] px-3 py-2.5 text-sm text-red-300">
                {parseError}
              </p>
            )
          )}

          <FormatHelp example={format.example} notes={format.notes} />

          <div className="flex justify-end border-t border-border pt-4">
            <button
              type="button"
              onClick={handleReview}
              disabled={disabled || raw.trim() === '' || !!wrongTab}
              className={buttonPrimary}
            >
              Review changes
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="flex flex-col">
          <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-1.5 px-5 pt-5">
            <FilterChip label="Changes" count={changeCount} active={filter === 'changes'} onClick={() => setFilter('changes')} />
            <FilterChip label="New" count={counts.new} active={filter === 'new'} onClick={() => setFilter('new')} />
            <FilterChip label="Changed" count={counts.changed} active={filter === 'changed'} onClick={() => setFilter('changed')} />
            <FilterChip label="Unchanged" count={counts.unchanged} active={filter === 'unchanged'} onClick={() => setFilter('unchanged')} />
            <FilterChip label="All" count={entries.length} active={filter === 'all'} onClick={() => setFilter('all')} />
          </div>

          <ul className="scrollbar-slim mt-4 max-h-[28rem] divide-y divide-white/[0.05] overflow-y-auto border-y border-border">
            {visible.map((entry, i) => (
              <li key={`${entry.row.name}-${i}`} className="flex flex-col gap-1.5 px-5 py-3">
                <span className="flex items-center gap-2">
                  <StatusTag status={entry.status} tone={tone} />
                  <span className={`truncate text-sm font-medium ${entry.status === 'unchanged' ? 'text-muted' : 'text-text'}`}>
                    {entry.row.name}
                  </span>
                </span>
                <span className="flex flex-wrap gap-x-4 gap-y-1 pl-[4.25rem] font-mono text-[11px] tabular-nums">
                  {renderFields(entry)}
                </span>
              </li>
            ))}
            {visible.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">Nothing in this view.</li>}
          </ul>

          {importError && <p role="alert" className="px-5 pt-4 text-sm text-red-400">{importError}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <button type="button" onClick={() => setStep('paste')} className={buttonSecondary}>
              Back to edit
            </button>
            <button type="button" onClick={handleImport} disabled={importing} className={buttonPrimary}>
              {importing
                ? 'Importing…'
                : changeCount > 0
                  ? `Import ${changeCount} ${changeCount === 1 ? 'change' : 'changes'}`
                  : `Import ${plural(entries.length)} again`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-start gap-3 p-5">
          <p className={`flex items-center gap-2 text-base font-medium ${t.text}`}>
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
              <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Imported {plural(imported)}
          </p>
          <p className="text-sm text-muted">{doneNote}</p>
          <button type="button" onClick={() => setStep('paste')} className={`${buttonSecondary} mt-2`}>
            Import another batch
          </button>
        </div>
      )}
    </section>
  )
}

function FormatHelp({ example, notes }: { example: string; notes: ReactNode }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(example)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <details className="group rounded-md border border-border bg-bg/60">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs text-muted hover:text-text [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 16 16" className="h-3 w-3 transition-transform group-open:rotate-90" fill="none" aria-hidden>
          <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        JSON format
      </summary>
      <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
        <p className="text-xs leading-relaxed text-muted">{notes}</p>
        <div className="relative">
          <pre className="scrollbar-slim overflow-x-auto rounded bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-text/85">
            {example}
          </pre>
          <button
            type="button"
            onClick={copy}
            className="absolute right-2 top-2 rounded border border-border bg-panel px-2 py-0.5 text-[11px] text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </details>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        active ? 'border-text/30 bg-white/[0.08] text-text' : 'border-border text-muted hover:text-text'
      }`}
    >
      {label}
      <span className="font-mono tabular-nums">{count}</span>
    </button>
  )
}

function StatusTag({ status, tone }: { status: CatalogDiffStatus; tone: Tone }) {
  const t = TONES[tone]
  const styles: Record<CatalogDiffStatus, string> = {
    new: `${t.ring} ${t.text}`,
    changed: 'border-text/25 text-text',
    unchanged: 'border-border text-muted',
  }
  return (
    <span
      className={`inline-flex w-[3.75rem] shrink-0 justify-center rounded-sm border py-px font-mono text-[10px] uppercase tracking-wider ${styles[status]}`}
    >
      {status === 'unchanged' ? 'same' : status}
    </span>
  )
}

/**
 * One field in the change ledger: the live value struck through, then the
 * incoming one. Numbers going up read green and going down read red.
 */
function Delta({
  label,
  from,
  to,
}: {
  label: string
  from: number | string | null | undefined
  to: number | string
}) {
  const changed = from !== undefined && from !== null && from !== to
  const direction = changed && typeof from === 'number' && typeof to === 'number' ? Math.sign(to - from) : 0
  const toColor = direction > 0 ? 'text-accent' : direction < 0 ? 'text-red-400' : changed ? 'text-text' : 'text-muted'
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted/70">{label} </span>
      {changed && <span className="text-muted/60 line-through decoration-muted/50">{from}</span>}
      {changed && <span className="px-1 text-muted/60">→</span>}
      <span className={toColor}>{to}</span>
    </span>
  )
}

function CatalogFields({ entry }: { entry: CatalogDiffEntry }) {
  const { row, existing } = entry
  return (
    <>
      {row.team !== undefined && <Delta label="Team" from={existing?.team} to={row.team} />}
      <Delta label="Pos" from={existing?.positions.join('/')} to={row.positions.join('/')} />
      <Delta label="Price" from={existing?.price} to={row.price} />
      <Delta label="OFF" from={existing?.offense} to={row.offense} />
      <Delta label="DEF" from={existing?.defense} to={row.defense} />
    </>
  )
}

function XPoolFields({ entry }: { entry: XPoolDiffEntry }) {
  const { row, existing } = entry
  return (
    <>
      <Delta label="Team" from={existing?.team} to={row.team} />
      <Delta label="Pos" from={existing?.positions.join('/')} to={row.positions.join('/')} />
      <Delta label="OFF" from={existing?.offense} to={row.offense} />
      <Delta label="DEF" from={existing?.defense} to={row.defense} />
      {(row.tier === 'legend' || existing?.tier === 'legend') && (
        <Delta label="Tier" from={existing?.tier} to={row.tier} />
      )}
    </>
  )
}

// --- Live data ----------------------------------------------------------------

interface Column<T> {
  label: string
  align?: 'right'
  render: (row: T) => ReactNode
}

/** What's live right now, searchable, so a batch can be checked against it. */
function LiveTable<T extends { id: string; name: string; team: string | null }>({
  title,
  rows,
  columns,
  noun,
}: {
  title: string
  rows: T[]
  columns: Column<T>[]
  noun: string
}) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const visible = rows.filter(
    (r) => query === '' || r.name.toLowerCase().includes(query) || (r.team ?? '').toLowerCase().includes(query),
  )
  return (
    <section aria-label={title} className="flex min-w-0 flex-col self-start rounded-xl border border-border bg-panel">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <Eyebrow>{title}</Eyebrow>
          <span className="font-mono text-[11px] tabular-nums text-muted">
            {visible.length === rows.length ? rows.length : `${visible.length} of ${rows.length}`}
          </span>
        </div>
        <div className="sm:w-52">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or team" label={`Search ${title}`} />
        </div>
      </div>
      <div className="scrollbar-slim max-h-[34rem] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-panel">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.label}
                  className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-border/60 hover:bg-white/[0.02]">
                {columns.map((c) => (
                  <td key={c.label} className={`px-4 py-2 ${c.align === 'right' ? 'text-right font-mono tabular-nums' : ''}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted">
            {rows.length === 0 ? `No ${noun} yet. Import a batch to add them.` : `No ${noun} match.`}
          </p>
        )}
      </div>
    </section>
  )
}

function CatalogTable({ players }: { players: CatalogPlayer[] }) {
  const rows = useMemo(() => [...players].sort((a, b) => b.price - a.price), [players])
  return (
    <LiveTable
      title="Live catalog"
      noun="catalog players"
      rows={rows}
      columns={[
        { label: 'Player', render: (p) => <span className="text-text">{p.name}</span> },
        { label: 'Team', render: (p) => <span className="font-mono text-xs text-muted">{p.team ?? '—'}</span> },
        { label: 'Pos', render: (p) => <span className="font-mono text-xs text-muted">{p.positions.join('/')}</span> },
        { label: 'Price', align: 'right', render: (p) => <span className="text-text">{p.price}</span> },
        { label: 'Off', align: 'right', render: (p) => <span className="text-muted">{p.offense}</span> },
        { label: 'Def', align: 'right', render: (p) => <span className="text-muted">{p.defense}</span> },
      ]}
    />
  )
}

function XPoolTable({ pool }: { pool: XPoolPlayer[] }) {
  const rows = useMemo(() => [...pool].sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name)), [pool])
  return (
    <LiveTable
      title="Live X Pool"
      noun="X Players"
      rows={rows}
      columns={[
        {
          label: 'X Player',
          render: (p) => (
            <span className="flex items-center gap-2">
              <span className="text-text">{p.name}</span>
              {p.tier === 'legend' && <TierBadge tier="legend" />}
            </span>
          ),
        },
        { label: 'Team', render: (p) => <span className="font-mono text-xs text-star/90">{p.team}</span> },
        { label: 'Pos', render: (p) => <span className="font-mono text-xs text-muted">{p.positions.join('/')}</span> },
        { label: 'Off', align: 'right', render: (p) => <span className="text-muted">{p.offense}</span> },
        { label: 'Def', align: 'right', render: (p) => <span className="text-muted">{p.defense}</span> },
      ]}
    />
  )
}
