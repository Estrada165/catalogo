// Boletas (notas de venta internas): cálculo de montos, montos en letras y armado desde un pedido.
export const IGV_RATE = 18

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export const lineAmount = (it) => r2(Math.max(0, num(it.qty) * num(it.unit_price) - num(it.discount)))

// Totales. El IGV (18%) se considera incluido en los precios: se desglosa sin cambiar el total.
export function computeTotals({ items = [], discount_type = 'amount', discount_value = 0, igv = false, igv_rate = IGV_RATE }) {
  const lines = items.filter((it) => String(it.description || '').trim() && num(it.qty) > 0)
  const subtotal = r2(lines.reduce((s, it) => s + lineAmount(it), 0))
  const lineDiscounts = r2(lines.reduce((s, it) => s + Math.min(num(it.discount), num(it.qty) * num(it.unit_price)), 0))
  let discount = discount_type === 'percent' ? r2((subtotal * Math.min(100, Math.max(0, num(discount_value)))) / 100) : r2(Math.max(0, num(discount_value)))
  discount = Math.min(discount, subtotal)
  const total = r2(subtotal - discount)
  const rate = num(igv_rate) || IGV_RATE
  const taxable = igv ? r2(total / (1 + rate / 100)) : total
  const igv_amount = igv ? r2(total - taxable) : 0
  return { lines, subtotal, lineDiscounts, discount, taxable, igv_amount, total, rate }
}

// ─── Montos en letras: "CIENTO VEINTE CON 50/100 SOLES" ───
const U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function under1000(n) {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100)
  const rest = n % 100
  let out = C[c]
  if (rest) {
    const part = rest < 30 ? U[rest] : D[Math.floor(rest / 10)] + (rest % 10 ? ` Y ${U[rest % 10]}` : '')
    out = out ? `${out} ${part}` : part
  }
  return out.trim()
}

export function numberToWords(n) {
  n = Math.floor(Math.abs(n))
  if (n === 0) return 'CERO'
  const millions = Math.floor(n / 1e6)
  const thousands = Math.floor((n % 1e6) / 1000)
  const rest = n % 1000
  const parts = []
  if (millions) parts.push(millions === 1 ? 'UN MILLÓN' : `${under1000(millions).replace(/UNO$/, 'UN')} MILLONES`)
  if (thousands) parts.push(thousands === 1 ? 'MIL' : `${under1000(thousands).replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN')} MIL`)
  if (rest) parts.push(under1000(rest))
  return parts.join(' ')
}

export function amountInWords(total, currency = 'PEN') {
  const t = r2(total)
  const ent = Math.floor(t)
  const cents = Math.round((t - ent) * 100)
  const name = currency === 'USD' ? (ent === 1 ? 'DÓLAR' : 'DÓLARES') : ent === 1 ? 'SOL' : 'SOLES'
  return `SON: ${numberToWords(ent)} CON ${String(cents).padStart(2, '0')}/100 ${name}`
}

// ─── Datos por defecto ───
export const emptyItem = () => ({ key: Math.random().toString(36).slice(2), description: '', qty: 1, unit: 'und', unit_price: '', discount: '' })

export function emptyReceipt(issuer = {}) {
  return {
    series: issuer.series || 'NV01',
    customer: { name: '', doc_type: 'DNI', doc_number: '', phone: '', address: '' },
    items: [emptyItem()],
    discount_type: 'amount',
    discount_value: '',
    igv: !!issuer.igv_default,
    payment_method: '',
    notes: '',
    issued_at: new Date().toISOString(),
    order_id: null,
  }
}

// Arma una boleta a partir de un pedido del catálogo (productos, delivery, cliente y pago)
export function receiptFromOrder(order, issuer = {}) {
  const items = (order.items || []).map((l) => ({
    key: Math.random().toString(36).slice(2),
    description: l.variant && !/^(único|unico)$/i.test(l.variant) ? `${l.product} · ${l.variant}` : l.product,
    qty: Number(l.qty) || 1,
    unit: l.unit || 'und',
    unit_price: l.price === null || l.price === undefined ? '' : Number(l.price),
    discount: '',
  }))
  if (Number(order.delivery_cost) > 0) {
    items.push({ key: 'delivery', description: `Delivery${order.customer?.zone_name ? ` · ${order.customer.zone_name}` : ''}`, qty: 1, unit: 'und', unit_price: Number(order.delivery_cost), discount: '' })
  }
  const c = order.customer || {}
  return {
    ...emptyReceipt(issuer),
    order_id: order.id,
    customer: { name: c.name || '', doc_type: 'DNI', doc_number: '', phone: c.phone || '', address: c.delivery === 'delivery' ? c.address || '' : '' },
    items: items.length ? items : [emptyItem()],
    payment_method: order.payment?.method || '',
    notes: `Pedido ${order.code}`,
  }
}

// Lo que se guarda en la base
export function toRow(draft, tenantId) {
  const t = computeTotals(draft)
  return {
    tenant_id: tenantId,
    series: draft.series || 'NV01',
    order_id: draft.order_id || null,
    customer: Object.fromEntries(Object.entries(draft.customer || {}).map(([k, v]) => [k, String(v ?? '').trim()])),
    items: t.lines.map((it) => ({
      description: String(it.description).trim(),
      qty: num(it.qty),
      unit: it.unit || 'und',
      unit_price: r2(num(it.unit_price)),
      discount: r2(Math.min(num(it.discount), num(it.qty) * num(it.unit_price))),
      amount: lineAmount(it),
    })),
    discount_type: draft.discount_type === 'percent' ? 'percent' : 'amount',
    discount_value: r2(num(draft.discount_value)),
    igv: !!draft.igv,
    igv_rate: IGV_RATE,
    subtotal: t.subtotal,
    discount: t.discount,
    taxable: t.taxable,
    igv_amount: t.igv_amount,
    total: t.total,
    payment_method: String(draft.payment_method || '').trim() || null,
    notes: String(draft.notes || '').trim() || null,
    issued_at: draft.issued_at || new Date().toISOString(),
  }
}

export function draftFromRow(row) {
  return {
    ...row,
    items: (row.items || []).map((it) => ({ ...it, key: Math.random().toString(36).slice(2), discount: it.discount || '' })),
    discount_value: row.discount_value || '',
  }
}

export const money = (n, sym = 'S/') => `${sym} ${r2(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const qtyText = (q, unit) => {
  const n = num(q)
  const s = Number.isInteger(n) ? String(n) : n.toLocaleString('es-PE', { maximumFractionDigits: 3 })
  return unit && unit !== 'und' ? `${s} ${unit}` : s
}
