import { supabase } from './supabase'

let cache = null

export async function getContact() {
  if (cache) return cache
  const { data } = await supabase.from('platform_settings').select('value').eq('key', 'contacto').maybeSingle()
  cache = data?.value || {}
  return cache
}

export function clearContactCache() {
  cache = null
}

export function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  if (d.length === 9 && d.startsWith('9')) return '51' + d
  return d
}

// api.whatsapp.com conserva bien los emojis (wa.me a veces los convierte en signos al redirigir)
export function waUrl(phone, text) {
  const p = normalizePhone(phone)
  return `https://api.whatsapp.com/send?${p ? `phone=${p}&` : ''}text=${encodeURIComponent(String(text || '').normalize('NFC'))}`
}

export function fillTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{([\p{L}\d_]+)\}/gu, (m, k) => vars[k] ?? vars[k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')] ?? m)
}

// Variables para los mensajes de cobro y renovación
export function planVars(tenant, ownerName = '') {
  const left = tenant?.expires_at ? Math.ceil((new Date(tenant.expires_at).getTime() - Date.now()) / 86400000) : null
  const fecha = tenant?.expires_at ? new Date(tenant.expires_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' }) : 'sin fecha'
  const nombre = String(ownerName || '').trim().split(/\s+/)[0] || ''
  return {
    negocio: tenant?.name || '',
    enlace: tenant?.slug ? `${location.host}/${tenant.slug}` : '',
    nombre,
    dueno: nombre,
    precio: tenant?.price != null ? `S/ ${Number(tenant.price).toFixed(2)}` : 'por confirmar',
    periodo: String(tenant?.cycle_days || 30),
    vence: fecha,
    dias: left === null ? 'sin vencimiento' : left > 1 ? `quedan ${left} días` : left === 1 ? 'queda 1 día' : left === 0 ? 'vence hoy' : `venció hace ${-left} ${left === -1 ? 'día' : 'días'}`,
  }
}
