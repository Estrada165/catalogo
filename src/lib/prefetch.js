// Arranca las descargas apenas abre la página, sin esperar a que React y el código de la sección terminen de cargar
import { supabase } from './supabase'
import { RESERVED_SLUGS } from './utils'

export function startPrefetch() {
  const seg = location.pathname.split('/').filter(Boolean)
  const first = (seg[0] || '').toLowerCase()
  if (seg.length === 1 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(first) && !RESERVED_SLUGS.has(first)) {
    // Catálogo: datos y código en paralelo
    window.__catPrefetch = { slug: first, p: supabase.rpc('get_catalog', { p_slug: first }) }
    import('../catalog/CatalogPage')
  } else if (first === 'panel' || first === 'admin' || first === 'login' || first === 'registro') {
    import('../pages/entries')
  }
}

export function takePrefetch(slug) {
  const pre = window.__catPrefetch
  if (pre && pre.slug === slug) {
    window.__catPrefetch = null
    return pre.p
  }
  return null
}
