import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { getIsAdmin } from '../data/profileApi'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  isAdmin: boolean
  adminLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)

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

  useEffect(() => {
    // Don't act until the session check itself has resolved: while `loading`
    // is true, `session` is only its unset initial value, not a confirmed
    // "no session" — trusting it here would flip `adminLoading` to false
    // before we actually know whether there's a session to check.
    if (loading) return

    let ignore = false

    if (!session) {
      setIsAdmin(false)
      setAdminLoading(false)
      return
    }

    setAdminLoading(true)
    getIsAdmin(session.user.id)
      .then((result) => {
        if (!ignore) setIsAdmin(result)
      })
      .catch(() => {
        if (!ignore) setIsAdmin(false)
      })
      .finally(() => {
        if (!ignore) setAdminLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [session, loading])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, isAdmin, adminLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
