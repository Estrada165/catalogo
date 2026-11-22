import { money } from './format'

const round = (n) => Math.round(n * 1000) / 1000

export function clampQty(qty, v) {
  const min = v.min_qty || 1
  const step = v.step || 1
  let q = Math.max(min, round(min + Math.round((qty - min) / step) * step))
  if (v.max !== null && v.max !== undefined) q = Math.min(q, round(v.max))
  return round(q)
}

export function fmtQty(qty, unit) {
  const n = Number(qty)
  const pretty = Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return !unit || unit === 'und' ? pretty : `${pretty} ${unit}`
}

// Líneas guardadas: [{ variantId, qty }]
export function cartReducer(lines, action) {
  switch (action.type) {
    case 'add': {
      const v = action.variant
      const found = lines.find((l) => l.variantId === v.id)
      if (found) return lines.map((l) => (l.variantId === v.id ? { ...l, qty: clampQty(l.qty + (action.qty ?? v.step), v) } : l))
      return [...lines, { variantId: v.id, qty: clampQty(action.qty ?? v.min_qty, v) }]
    }
    case 'dec': {
      const v = action.variant
      const found = lines.find((l) => l.variantId === v.id)
      if (!found) return lines
      const next = round(found.qty - v.step)
      if (next < v.min_qty) return lines.filter((l) => l.variantId !== v.id)
      return lines.map((l) => (l.variantId === v.id ? { ...l, qty: next } : l))
    }
    case 'set':
      return lines.map((l) => (l.variantId === action.variant.id ? { ...l, qty: clampQty(action.qty, action.variant) } : l))
    case 'remove':
      return lines.filter((l) => l.variantId !== action.id)
    case 'clear':
      return []
    case 'sync':
      return lines
        .filter((l) => action.variantById[l.variantId])
        .map((l) => ({ ...l, qty: clampQty(l.qty, action.variantById[l.variantId]) }))
        .filter((l) => {
          const v = action.variantById[l.variantId]
          return v.max === null || v.max > 0
        })
    default:
      return lines
  }
}

export function summarize(lines, cat) {
  const rows = []
  for (const l of lines) {
    const v = cat.variantById[l.variantId]
    if (!v) continue
    const p = v.product
    rows.push({
      key: v.id,
      variant: v,
      product: p,
      qty: l.qty,
      name: p.name,
      detail: [p.variants.length > 1 ? v.label : null, v.price !== null ? `${money(v.price)}${v.unit !== 'und' ? ` / ${v.unit}` : ''}` : 'Precio a consultar']
        .filter(Boolean)
        .join(' · '),
      image: p.images?.[0]?.thumb || p.images?.[0]?.full || null,
      total: v.price === null ? null : Math.round(v.price * l.qty * 100) / 100,
    })
  }
  const subtotal = Math.round(rows.reduce((s, r) => s + (r.total || 0), 0) * 100) / 100
  const count = rows.reduce((s, r) => s + (r.variant.unit === 'und' ? r.qty : 1), 0)
  return { rows, subtotal, count: Math.round(count), hasQuote: rows.some((r) => r.total === null) }
}

export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 9 && digits.startsWith('9')) return '51' + digits
  return digits
}

// api.whatsapp.com conserva bien los emojis (wa.me a veces los convierte en "�" al redirigir)
export function waLink(phone, text) {
  const p = normalizePhone(phone)
  return `https://api.whatsapp.com/send?${p ? `phone=${p}&` : ''}text=${encodeURIComponent(String(text || '').normalize('NFC'))}`
}

// Corta sin partir un emoji por la mitad
export function clip(text, max) {
  const chars = Array.from(String(text || ''))
  return chars.length > max ? chars.slice(0, max).join('') + '…' : chars.join('')
}

export function buildOrderMessage({ order, customer, checkout, method, businessName }) {
  const L = []
  L.push(checkout?.message_header ? `👋 ${checkout.message_header}` : `👋 Hola, quiero hacer este pedido en *${businessName}*:`)
  L.push('')
  L.push(`🧾 Pedido: *${order.code}*`)
  L.push('')
  L.push('🛒 *Productos*')
  for (const it of order.items) {
    const variant = it.variant && it.variant !== 'Único' ? ` (${it.variant})` : ''
    const price = it.line_total === null || it.line_total === undefined ? 'a consultar' : money(it.line_total)
    const qty = it.unit && it.unit !== 'und' ? fmtQty(it.qty, it.unit) : `${fmtQty(it.qty)} x`
    L.push(`• ${qty} ${it.product}${variant} — ${price}`)
  }
  L.push('')
  if (Number(order.delivery) > 0 || customer.delivery === 'delivery') {
    L.push(`💵 Subtotal: ${money(order.subtotal)}`)
    L.push(`🛵 Delivery${customer.zone_name ? ` (${customer.zone_name})` : ''}: ${Number(order.delivery) > 0 ? money(order.delivery) : 'por confirmar'}`)
  }
  if (Number(order.total) > 0) L.push(`✅ *Total: ${money(order.total)}*${order.has_quote_items ? ' + productos a consultar' : ''}`)
  else if (order.has_quote_items) L.push('✅ *Total: a consultar*')
  const who = []
  if (customer.name) who.push(`👤 ${customer.name}`)
  if (customer.phone) who.push(`📱 ${customer.phone}`)
  if (customer.delivery === 'delivery') who.push(`📍 Delivery${customer.address ? `: ${customer.address}` : ''}`)
  if (customer.delivery === 'recojo') who.push('🏪 Recojo en tienda')
  if (customer.date) who.push(`📅 Entrega: ${customer.date}`)
  if (customer.dedication) who.push(`💌 Dedicatoria: ${customer.dedication}`)
  if (customer.note) who.push(`📝 ${customer.note}`)
  if (method) who.push(`💳 Pago: ${method.name}`)
  if (who.length) { L.push(''); L.push(...who) }
  return L.join('\n')
}

export function consultMessage(name, businessName) {
  return `👋 Hola, vi el catálogo de *${businessName}* y quiero consultar por: ${name}`
}
