import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { GoogleSignInButton } from './GoogleSignInButton'
import { AuthLayout } from './AuthLayout'

export function SignUpPage() {
  const { session } = useAuth()

  if (session) return <Navigate to="/players" replace />

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Sign up with your Google account. You'll choose a username next."
      footer={
        <Link to="/" className="transition-colors hover:text-text">
          ← Back to home
        </Link>
      }
    >
      <GoogleSignInButton />

      <p className="mt-6 text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-text underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
