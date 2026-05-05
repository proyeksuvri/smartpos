import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'
import { AuthContext, type AuthContextValue } from './auth-context-value'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, name, pin_hash, is_active, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    setProfile(data as Profile | null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: activeSession },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      throw error
    }

    setSession(activeSession)

    if (activeSession?.user) {
      await loadProfile(activeSession.user.id)
    } else {
      setProfile(null)
    }
  }, [loadProfile])

  useEffect(() => {
    let mounted = true

    // Track whether initial session has been resolved
    let initialised = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return

      // TOKEN_REFRESHED: just update session, DO NOT reset profile
      // This is the main cause of the flash when switching tabs
      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession)
        return
      }

      // INITIAL_SESSION: handled below via getSession() for reliability
      // Skip to avoid double-loading
      if (event === 'INITIAL_SESSION') {
        return
      }

      // SIGNED_IN / SIGNED_OUT / USER_UPDATED
      setSession(nextSession)

      if (nextSession?.user) {
        // Only reset profile if user actually changed
        void loadProfile(nextSession.user.id)
      } else {
        setProfile(null)
      }

      // Mark as initialised if not yet (fallback)
      if (!initialised) {
        initialised = true
        setLoading(false)
      }
    })

    // Get initial session synchronously from storage first
    async function initialiseSession() {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setSession(initialSession)

      if (initialSession?.user) {
        await loadProfile(initialSession.user.id)
      } else {
        setProfile(null)
      }

      if (mounted) {
        initialised = true
        setLoading(false)
      }
    }

    void initialiseSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }

    setSession(null)
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signOut,
      refreshProfile,
    }),
    [loading, profile, refreshProfile, session, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
