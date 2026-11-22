import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dataReady, setDataReady] = useState(false)
  const loadedFor = useRef(undefined)

  const loadUserData = useCallback(async (user) => {
    if (!user) {
      loadedFor.current = null
      setProfile(null)
      setTenant(null)
      setDataReady(true)
      return
    }
    // Recarga silenciosa si es el mismo usuario (otra pestaña o la vista previa renovaron la sesión)
    if (loadedFor.current !== user.id) setDataReady(false)
    loadedFor.current = user.id
    const [{ data: prof }, { data: ten }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('tenants').select('*').eq('owner_id', user.id).maybeSingle(),
    ])
    setProfile(prof || null)
    setTenant(ten || null)
    setDataReady(true)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadUserData(data.session?.user)
      if (active) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      const sameUser = (newSession?.user?.id || null) === loadedFor.current
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED' || (event === 'SIGNED_IN' && !sameUser)) {
        setTimeout(() => loadUserData(newSession?.user), 0)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadUserData])

  const refresh = useCallback(() => loadUserData(session?.user), [loadUserData, session])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setTenant(null)
  }, [])

  const value = {
    session,
    user: session?.user || null,
    profile,
    tenant,
    isSuperadmin: profile?.role === 'superadmin',
    loading: loading || !dataReady,
    refresh,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
