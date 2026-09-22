import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/

/** First stop after a new sign-in: the user picks a username before entering the app. */
export function WelcomePage() {
  const { session, loading, username, profileLoading, setUsername, signOut } = useAuth()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading || profileLoading) return null
  if (!session) return <Navigate to="/" replace />
  if (username) return <Navigate to="/players" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!USERNAME_PATTERN.test(trimmed)) {
      setError('3–20 characters: letters, numbers or underscores')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await setUsername(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save username')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-text">
      <form onSubmit={handleSubmit} className="border border-border bg-panel p-6 flex flex-col gap-3 w-80">
        <h1 className="text-sm uppercase tracking-widest text-muted">Welcome</h1>
        <p className="text-xs text-muted">
          Signed in as <span className="text-text">{session.user.email}</span>. Choose a username to finish
          setting up.
        </p>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
          Username
          <input
            className="bg-bg border border-border px-2 py-1 text-text normal-case tracking-normal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            minLength={3}
            maxLength={20}
            autoFocus
          />
        </label>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold disabled:opacity-50"
        >
          Continue
        </button>

        <button type="button" onClick={signOut} className="text-xs text-muted uppercase tracking-widest">
          Sign out
        </button>
      </form>
    </div>
  )
}
