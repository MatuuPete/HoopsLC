import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { GoogleSignInButton } from './GoogleSignInButton'

export function SignUpPage() {
  const { session } = useAuth()

  if (session) return <Navigate to="/players" replace />

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-text">
      <div className="border border-border bg-panel p-6 flex flex-col gap-3 w-80">
        <h1 className="text-sm uppercase tracking-widest text-muted">Sign Up</h1>
        <p className="text-xs text-muted">Use your Google account — you'll pick a username next.</p>

        <GoogleSignInButton />

        <p className="text-xs text-muted">
          Have an account?{' '}
          <Link to="/login" className="text-accent uppercase tracking-widest">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
