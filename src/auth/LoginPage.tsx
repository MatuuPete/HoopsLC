import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const action = mode === 'signin' ? signIn : signUp
    const { error: authError } = await action(email, password)
    if (authError) setError(authError)
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-text">
      <form onSubmit={handleSubmit} className="border border-border bg-panel p-6 flex flex-col gap-3 w-80">
        <h1 className="text-sm uppercase tracking-widest text-muted">
          {mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </h1>

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

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold disabled:opacity-50"
        >
          {mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="text-xs uppercase tracking-widest text-muted underline"
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
