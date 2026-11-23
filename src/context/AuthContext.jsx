import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Copia local de la última sesión: el panel abre al instante y se actualiza por detrás
const SNAP = 'auth-snap'
const readSnap = (uid) => {
  try {
    const s = JSON.parse(localStorage.getItem(SNAP) || 'null')
    return s && s.uid === uid && Date.now() - s.t < 7 * 86400000 ? s : null
  } catch { return null }
}
const writeSnap = (uid, profile, tenant, config) => {
  try { localStorage.setItem(SNAP, JSON.stringify({ uid, t: Date.now(), profile, tenant, config })) } catch { /* nada */ }
}
const dropSnap = () => { try { localStorage.removeItem(SNAP) } catch { /* nada */ } }

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [tenantConfig, setTenantConfig] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [dataReady, setDataReady] = useState(false)
  const [authError, setAuthError] = useState(null)
  const loadedFor = useRef(undefined)

  const loadUserData = useCallback(async (user) => {
    if (!user) {
      loadedFor.current = null
      setProfile(null)
      setTenant(null)
      setTenantConfig(undefined)
      dropSnap()
      setDataReady(true)
      return
    }
    // Recarga silenciosa si es el mismo usuario (otra pestaña o la vista previa renovaron la sesión)
    if (loadedFor.current !== user.id) setDataReady(false)
    loadedFor.current = user.id
    // Perfil, negocio y su configuración en un solo viaje
    let [{ data: prof, error: e1 }, { data: ten, error: e2 }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('tenants').select('*, tenant_config(*)').eq('owner_id', user.id).maybeSingle(),
    ])
    if (e2) ({ data: ten, error: e2 } = await supabase.from('tenants').select('*').eq('owner_id', user.id).maybeSingle())
    const err = e1 || e2
    let cfg
    if (ten && 'tenant_config' in ten) {
      const raw = ten.tenant_config
      cfg = (Array.isArray(raw) ? raw[0] : raw) || null
      delete ten.tenant_config
    }
    setAuthError(err ? `${err.code || ''} ${err.message}`.trim() : null)
    setProfile(prof || null)
    setTenant(ten || null)
    setTenantConfig(cfg)
    if (!err) writeSnap(user.id, prof || null, ten || null, cfg)
    setDataReady(true)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      const user = data.session?.user
      const snap = user && readSnap(user.id)
      if (snap) {
        // Pinta con lo guardado y revalida sin bloquear
        loadedFor.current = user.id
        setProfile(snap.profile)
        setTenant(snap.tenant)
        setTenantConfig(snap.config ?? undefined)
        setDataReady(true)
        setLoading(false)
        loadUserData(user)
        return
      }
      await loadUserData(user)
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

  // Tras guardar la configuración, la copia local queda al día
  const cacheConfig = useCallback((cfg) => {
    setTenantConfig(cfg)
    try {
      const s = JSON.parse(localStorage.getItem(SNAP) || 'null')
      if (s && s.uid === loadedFor.current) localStorage.setItem(SNAP, JSON.stringify({ ...s, config: cfg }))
    } catch { /* nada */ }
  }, [])

  const refresh = useCallback(() => loadUserData(session?.user), [loadUserData, session])

  const signOut = useCallback(async () => {
    dropSnap()
    await supabase.auth.signOut()
    setProfile(null)
    setTenant(null)
    setTenantConfig(undefined)
  }, [])

  const value = {
    session,
    user: session?.user || null,
    profile,
    tenant,
    tenantConfig,
    cacheConfig,
    isSuperadmin: profile?.role === 'superadmin',
    authError,
    loading: loading || !dataReady,
    refresh,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
