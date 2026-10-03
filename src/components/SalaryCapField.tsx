import { useEffect, useRef, useState } from 'react'

/** Digits only, at most 7 of them. Empty means "no value yet". */
function cleanDigits(text: string): string {
  return text.replace(/\D/g, '').slice(0, 7)
}

/**
 * The salary cap input. It keeps its own text while you type and commits
 * once, on blur or Enter. Committing on every keystroke saved each digit to
 * the server, and each save echoed back into the field, overwriting digits
 * typed since. A text input (not type="number") also means the mouse wheel
 * can't change the value and an empty field doesn't turn into 0.
 */
export function SalaryCapField({
  id,
  value,
  onCommit,
}: {
  id: string
  value: number
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)
  // Escape blurs to cancel; the blur handler still sees the typed draft, so it checks this first.
  const cancelled = useRef(false)

  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  function commit() {
    if (cancelled.current) {
      cancelled.current = false
      setDraft(String(value))
      return
    }
    if (draft === '') {
      setDraft(String(value))
      return
    }
    const next = Number(draft)
    setDraft(String(next))
    if (next !== value) onCommit(next)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className="w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-lg tabular-nums text-text transition-colors focus:border-accent/60 focus:outline-none"
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(cleanDigits(e.target.value))}
      onBlur={() => {
        setFocused(false)
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
    />
  )
}
