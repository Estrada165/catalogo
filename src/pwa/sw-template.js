/* Service worker del panel. Versión: __VERSION__
   - Páginas: siempre se pide la versión nueva a internet; sin conexión se usa la guardada.
   - Archivos de /assets (llevan su huella en el nombre): se guardan y se sirven al instante.
   - Supabase y otros dominios: no se tocan.
   Cada compilación cambia este archivo, así el navegador detecta la actualización enseguida. */
const VERSION = '__VERSION__'
const CACHE = `panel-${VERSION}`
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}))
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    // Conserva los archivos de la versión anterior un tiempo: alguna pestaña abierta aún podría pedirlos
    await Promise.all(keys.filter((k) => k.startsWith('panel-') && k !== CACHE && !k.endsWith('-assets')).map((k) => caches.delete(k)))
    // Archivos viejos: se guardan como máximo 250 (se borran los más antiguos)
    const assets = await caches.open('panel-assets')
    const old = await assets.keys()
    if (old.length > 250) await Promise.all(old.slice(0, old.length - 250).map((r) => assets.delete(r)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js' || url.pathname === '/version.json') return

  // Páginas: red primero (siempre la última versión), con respaldo sin conexión
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-store' })
        const c = await caches.open(CACHE)
        c.put('/', res.clone()).catch(() => {})
        return res
      } catch {
        return (await caches.match('/')) || Response.error()
      }
    })())
    return
  }

  // Código y estilos con huella: guardados para siempre, se sirven al instante
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith((async () => {
      const c = await caches.open('panel-assets')
      const hit = await c.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok) c.put(req, res.clone()).catch(() => {})
      return res
    })())
    return
  }

  // Íconos y manifest: lo guardado, actualizado por detrás
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE)
      const hit = await c.match(req)
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()).catch(() => {}); return res }).catch(() => hit)
      return hit || net
    })())
  }
})
