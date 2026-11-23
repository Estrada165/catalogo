// App instalable del panel y del admin (el catálogo de los clientes no se instala).
// Maneja: botón "Instalar app", aviso de versión nueva y actualización rápida.

const APP_PATHS = /^\/(panel|admin|login|registro|recuperar|app)(\/|$)/
export const isAppPath = (p = location.pathname) => APP_PATHS.test(p)
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

const state = {
  canInstall: false, // el navegador ofrece su propio cuadro de instalación
  installed: false, // ya se está usando como app
  updateReady: false, // hay una versión nueva esperando
  ios: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
}
let snapshot = { ...state }
const listeners = new Set()
const emit = () => { snapshot = { ...state }; listeners.forEach((l) => l()) }
export const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
export const getSnapshot = () => snapshot

let deferred = null
let reg = null
let waitingWorker = null
const loadedAt = Date.now()

const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone === true

// Manifest e íconos solo en las páginas del panel (así el catálogo público no ofrece instalarse)
export function setupHead() {
  if (!isAppPath() || document.querySelector('link[rel="manifest"]')) return
  const add = (tag, attrs) => { const el = document.createElement(tag); Object.assign(el, attrs); document.head.appendChild(el); return el }
  add('link', { rel: 'manifest', href: '/manifest.webmanifest' })
  add('link', { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' })
  const meta = (name, content) => { const m = document.createElement('meta'); m.name = name; m.content = content; document.head.appendChild(m) }
  meta('apple-mobile-web-app-capable', 'yes')
  meta('mobile-web-app-capable', 'yes')
  meta('apple-mobile-web-app-status-bar-style', 'black-translucent')
  meta('apple-mobile-web-app-title', 'Panel')
}

function applyNow() {
  if (!waitingWorker) return
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    location.reload()
  })
  waitingWorker.postMessage('SKIP_WAITING')
}

function onWaiting(worker) {
  waitingWorker = worker
  // Recién abierta (o en segundo plano): se actualiza sola sin preguntar
  if (Date.now() - loadedAt < 12000 || document.visibilityState === 'hidden') return applyNow()
  state.updateReady = true
  emit()
}

export function applyUpdate() {
  if (waitingWorker) applyNow()
  else location.reload()
}

export async function promptInstall() {
  if (deferred) {
    deferred.prompt()
    const { outcome } = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }))
    deferred = null
    state.canInstall = false
    emit()
    return outcome === 'accepted' ? 'installed' : 'dismissed'
  }
  return state.ios ? 'ios' : 'manual'
}

export function initPwa() {
  state.installed = standalone()
  matchMedia('(display-mode: standalone)').addEventListener?.('change', () => { state.installed = standalone(); emit() })

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    state.canInstall = true
    emit()
  })
  addEventListener('appinstalled', () => { state.installed = true; state.canInstall = false; deferred = null; emit() })

  // Si una versión vieja abierta pide un archivo que ya no existe tras actualizar, recarga una sola vez
  const chunkFail = (msg) => /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(String(msg || ''))
  const recover = (msg) => {
    if (!chunkFail(msg)) return
    try { if (sessionStorage.getItem('chunk-reload')) return; sessionStorage.setItem('chunk-reload', '1') } catch { /* nada */ }
    location.reload()
  }
  addEventListener('error', (e) => recover(e.message))
  addEventListener('unhandledrejection', (e) => recover(e.reason?.message || e.reason))
  setTimeout(() => { try { sessionStorage.removeItem('chunk-reload') } catch { /* nada */ } }, 15000)

  setupHead()
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !isAppPath()) return

  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((r) => {
    reg = r
    if (r.waiting && navigator.serviceWorker.controller) onWaiting(r.waiting)
    r.addEventListener('updatefound', () => {
      const w = r.installing
      w?.addEventListener('statechange', () => {
        // Solo es "actualización" si ya había una versión controlando la página
        if (w.state === 'installed' && navigator.serviceWorker.controller) onWaiting(w)
      })
    })
  }).catch(() => {})

  // Busca versiones nuevas al volver a la app y cada 10 minutos
  const check = () => reg?.update().catch(() => {})
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  addEventListener('focus', check)
  setInterval(check, 10 * 60 * 1000)
}
