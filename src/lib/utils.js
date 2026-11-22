export const RESERVED_SLUGS = new Set([
  'login', 'registro', 'registrarse', 'salir', 'logout', 'panel', 'admin', 'superadmin',
  'q', 'qr', 'api', 'app', 'assets', 'static', 'public', 'www', 'web', 'mail',
  'soporte', 'ayuda', 'contacto', 'terminos', 'privacidad', 'precios', 'planes',
  'blog', 'docs', 'status', 'pedido', 'pedidos', 'cotizacion', 'catalogo', 'c',
  'recuperar', 'reset', 'cuenta', 'perfil', 'config', 'configuracion',
])

export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function isValidSlug(slug) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 40 && !RESERVED_SLUGS.has(slug)
}

export function formatPrice(value) {
  if (value === null || value === undefined) return 'A consultar'
  return 'S/ ' + Number(value).toFixed(2)
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysLeft(value) {
  if (!value) return null
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
}

export function getSessionId() {
  try {
    let id = sessionStorage.getItem('sid')
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 32)
      sessionStorage.setItem('sid', id)
    }
    return id
  } catch {
    return 'nosession'
  }
}

export function catalogUrl(slug) {
  return `${window.location.origin}/${slug}`
}
