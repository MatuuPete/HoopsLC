import { useEffect, useState, type KeyboardEvent } from 'react'
import { useClips } from '../data/useClips'
import type { Clip } from '../data/clipsApi'
import { Eyebrow } from '../components/LineupParts'
import { IconButton, SearchInput, buttonPrimary, buttonSecondary, trashPath } from '../components/ui'

const canReadClipboard = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText

/** Clips longer than this start collapsed. */
const COLLAPSE_LINES = 6
const COLLAPSE_CHARS = 420

function formatRelative(iso: string, now: number): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.floor((now - date.getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  if (hours < 48) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatFull(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Re-renders every minute so relative timestamps stay current. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const id = window.setTimeout(() => setState('idle'), 1800)
    return () => window.clearTimeout(id)
  }, [state])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        state === 'copied'
          ? 'bg-accent/10 text-accent'
          : state === 'failed'
            ? 'text-red-400'
            : 'text-muted hover:bg-white/[0.06] hover:text-text'
      }`}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
        {state === 'copied' ? (
          <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" stroke="currentColor" strokeWidth="1.4" />
          </>
        )}
      </svg>
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
    </button>
  )
}

function ClipCard({
  clip,
  latest,
  now,
  onDelete,
}: {
  clip: Clip
  latest: boolean
  now: number
  onDelete: (id: string) => void
}) {
  const long = clip.body.split('\n').length > COLLAPSE_LINES || clip.body.length > COLLAPSE_CHARS
  const [expanded, setExpanded] = useState(false)
  const bodyId = `clip-${clip.id}`

  return (
    <article
      className={`rounded-xl border bg-panel transition-colors ${latest ? 'border-accent/30' : 'border-border'}`}
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
          {latest && (
            <span className="inline-flex h-5 items-center gap-1.5 rounded-full bg-accent/10 px-2 text-[11px] font-semibold text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Latest
            </span>
          )}
          <time dateTime={clip.createdAt} title={formatFull(clip.createdAt)}>
            {formatRelative(clip.createdAt, now)}
          </time>
          <span className="text-border" aria-hidden>
            /
          </span>
          <span className="font-mono text-[11px] tabular-nums">
            {clip.body.length.toLocaleString()} chars
          </span>
        </div>
        <div className="-mr-1 flex items-center gap-0.5">
          <CopyButton text={clip.body} />
          <IconButton label="Delete clip" tone="danger" onClick={() => onDelete(clip.id)}>
            {trashPath}
          </IconButton>
        </div>
      </header>

      <div className="px-4 pb-4 pt-2">
        <p
          id={bodyId}
          className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed text-text ${
            long && !expanded ? 'line-clamp-6' : ''
          }`}
        >
          {clip.body}
        </p>
        {long && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={bodyId}
            className="mt-2 text-xs font-medium text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {expanded ? 'Show less' : 'Show all'}
          </button>
        )}
      </div>
    </article>
  )
}

export function AdminClipboardPage() {
  const { clips, loading, error, addClip, removeClip } = useClips()
  const now = useNow()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const trimmed = draft.trim()
  const needle = query.trim().toLowerCase()
  const visible = needle ? clips.filter((clip) => clip.body.toLowerCase().includes(needle)) : clips

  async function handleSave() {
    if (!trimmed || saving) return
    setSaving(true)
    setNotice(null)
    try {
      await addClip(draft)
      setDraft('')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to save clip')
    } finally {
      setSaving(false)
    }
  }

  async function handlePaste() {
    setNotice(null)
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        setNotice('Your clipboard is empty.')
        return
      }
      setDraft((prev) => (prev.trim() ? `${prev}\n${text}` : text))
    } catch {
      setNotice('Clipboard access was blocked. Long-press the box and choose Paste instead.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await removeClip(id)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to delete clip')
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 font-body sm:px-6 lg:py-10">
      <header className="border-b border-border pb-6">
        <h1 className="font-display text-4xl uppercase leading-none tracking-wide text-text sm:text-5xl">
          Clipboard
        </h1>
        <p className="mt-3 text-sm text-muted">
          Paste on one device, pick it up on another. Clips are private to your account.
        </p>
      </header>

      <section className="mt-6 rounded-xl border border-border bg-panel focus-within:border-accent/40 lg:mt-8">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 sm:px-5">
          <label htmlFor="clip-draft">
            <Eyebrow>New clip</Eyebrow>
          </label>
          {canReadClipboard && (
            <button
              type="button"
              onClick={handlePaste}
              className="-mr-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                <rect x="3" y="3" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6 3V2.5A.5.5 0 0 1 6.5 2h3a.5.5 0 0 1 .5.5V3M5.5 7h5M5.5 10h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Paste from clipboard
            </button>
          )}
        </div>
        <textarea
          id="clip-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste or type text here…"
          rows={6}
          className="block min-h-[9rem] w-full resize-y bg-transparent px-4 py-4 text-[15px] leading-relaxed text-text placeholder:text-muted/70 focus:outline-none sm:px-5"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
          <span className="font-mono text-[11px] tabular-nums text-muted">
            {draft.length.toLocaleString()} chars
            <span className="hidden sm:inline">
              <span className="mx-2 text-border">/</span>Ctrl + Enter to save
            </span>
          </span>
          <div className="flex gap-2">
            {draft && (
              <button type="button" onClick={() => setDraft('')} className={buttonSecondary}>
                Clear
              </button>
            )}
            <button type="button" onClick={handleSave} disabled={!trimmed || saving} className={buttonPrimary}>
              {saving ? 'Saving…' : 'Save clip'}
            </button>
          </div>
        </div>
      </section>

      {(notice || error) && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-400/25 bg-red-400/[0.05] px-5 py-3 text-sm text-red-300"
        >
          {notice ?? error}
        </p>
      )}

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eyebrow>Saved clips</Eyebrow>
            <span className="rounded-full bg-white/[0.08] px-1.5 font-mono text-[11px] tabular-nums text-text">
              {clips.length}
            </span>
          </div>
          {clips.length > 3 && (
            <div className="w-full sm:w-64">
              <SearchInput value={query} onChange={setQuery} placeholder="Search clips" label="Search clips" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-panel px-5 py-10 text-center text-sm text-muted">
            Loading clips…
          </div>
        ) : clips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm text-text">Nothing saved yet</p>
            <p className="mt-1 text-sm text-muted">
              Save a clip on your phone and it shows up here on your laptop.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-border bg-panel px-5 py-10 text-center text-sm text-muted">
            No clips match “{query.trim()}”.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                latest={clip.id === clips[0].id}
                now={now}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
