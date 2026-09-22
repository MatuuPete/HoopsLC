import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { getProfile, setUsername as saveUsername } from '../data/profileApi'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  isAdmin: boolean
  username: string | null
  profileLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  setUsername: (username: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [username, setUsernameState] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    // Don't act until the session check itself has resolved: while `loading`
    // is true, `session` is only its unset initial value, not a confirmed
    // "no session" — trusting it here would flip `profileLoading` to false
    // before we actually know whether there's a session to check.
    if (loading) return

    let ignore = false

    if (!userId) {
      setIsAdmin(false)
      setUsernameState(null)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)
    getProfile(userId)
      .then((profile) => {
        if (ignore) return
        setIsAdmin(profile.isAdmin)
        setUsernameState(profile.username)
      })
      .catch(() => {
        if (ignore) return
        setIsAdmin(false)
        setUsernameState(null)
      })
      .finally(() => {
        if (!ignore) setProfileLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [userId, loading])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signInWithGoogle() {
    // Redirects the browser to Google; on return, supabase-js picks the
    // session out of the URL and ProtectedRoute sends new users to /welcome.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/players` },
    })
    return { error: error?.message ?? null }
  }

  async function setUsername(newUsername: string) {
    await saveUsername(newUsername)
    setUsernameState(newUsername)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        isAdmin,
        username,
        profileLoading,
        signIn,
        signInWithGoogle,
        setUsername,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
