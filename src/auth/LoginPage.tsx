import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { GoogleSignInButton } from './GoogleSignInButton'
import { AuthDivider, AuthLayout } from './AuthLayout'
import { Field, buttonSecondary, inputClass } from '../components/ui'

export function LoginPage() {
  const { signIn, session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/players" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { error: authError } = await signIn(email, password)
      if (authError) setError(authError)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in to Six Man"
      subtitle="Pick up where you left off with your roster and saved lineups."
      footer={
        <Link to="/" className="transition-colors hover:text-text">
          ← Back to home
        </Link>
      }
    >
      <GoogleSignInButton />

      <AuthDivider label="or sign in with email" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`${inputClass} py-2.5`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={`${inputClass} py-2.5`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-md border border-red-400/25 bg-red-400/[0.06] px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className={`${buttonSecondary} w-full py-2.5`}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  )
}
