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
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}
