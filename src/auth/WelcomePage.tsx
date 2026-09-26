import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { AuthLayout } from './AuthLayout'
import { Field, buttonPrimary, inputClass } from '../components/ui'

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
    <AuthLayout
      title="Choose a username"
      subtitle={
        <>
          Signed in as <span className="text-text">{session.user.email}</span>. Pick a username to finish
          setting up.
        </>
      }
      footer={
        <button type="button" onClick={signOut} className="transition-colors hover:text-text">
          Not you? Sign out
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Username" htmlFor="username" hint="3–20 characters: letters, numbers or underscores.">
          <input
            id="username"
            className={`${inputClass} py-2.5`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            minLength={3}
            maxLength={20}
            autoComplete="username"
            autoFocus
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-md border border-red-400/25 bg-red-400/[0.06] px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className={`${buttonPrimary} w-full py-2.5`}>
          {submitting ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </AuthLayout>
  )
}
