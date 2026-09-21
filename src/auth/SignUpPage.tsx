import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function SignUpPage() {
  const { signUp, session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  if (session) return <Navigate to="/players" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { error: authError, needsConfirmation } = await signUp(email, password)
      if (authError) setError(authError)
      else if (needsConfirmation) setAwaitingConfirmation(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text">
        <div className="border border-border bg-panel p-6 flex flex-col gap-3 w-80">
          <h1 className="text-sm uppercase tracking-widest text-muted">Check Your Email</h1>
          <p className="text-xs text-muted">
            We sent a confirmation link to <span className="text-text">{email}</span>. Follow it to
            activate your account, then sign in.
          </p>
          <Link to="/login" className="text-accent text-xs uppercase tracking-widest">
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-text">
      <form onSubmit={handleSubmit} className="border border-border bg-panel p-6 flex flex-col gap-3 w-80">
        <h1 className="text-sm uppercase tracking-widest text-muted">Sign Up</h1>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
          Email
          <input
            type="email"
            className="bg-bg border border-border px-2 py-1 text-text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
          Password
          <input
            type="password"
            className="bg-bg border border-border px-2 py-1 text-text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
          Confirm Password
          <input
            type="password"
            className="bg-bg border border-border px-2 py-1 text-text"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold disabled:opacity-50"
        >
          Create Account
        </button>

        <p className="text-xs text-muted">
          Have an account?{' '}
          <Link to="/login" className="text-accent uppercase tracking-widest">
            Sign In
          </Link>
        </p>
      </form>
    </div>
  )
}
