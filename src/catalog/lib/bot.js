// Asistente local: responde solo con la información que cargó el dueño
// (productos, variantes, características, categorías, preguntas frecuentes, horario, delivery, pagos, dirección).
// No usa IA ni APIs externas: todo corre en el navegador.
// Reglas: nunca lista más de 4 productos en tarjetas; si hay más, lo dice y ofrece verlos en el catálogo.
import { money } from './format'
import { openStatus, hoursRows, DAY_NAMES } from './hours'

export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const STOP = new Set(
  ('de la el los las un una unos unas y o a en con sin para por que cual cuales es son esta estan me te se lo le les mi mis tu tus su sus ' +
    'hay tienen tiene tienes tendran tendras venden vende vendes quiero quisiera queria busco buscando necesito algo algun alguna alguno del al como ' +
    'cuanto cuanta cuantos cuantas cuesta cuestan precio precios vale valen sale salen costo hola buenas buenos dias tardes noches favor gracias porfa pls ' +
    'ustedes usted tu yo mas muy bien ver disponible disponibles stock venta ventas info informacion consulta pregunta otro otra otros otras eso esto este ese ' +
    'ese esa esos esas dame deme muestrame mostrar ensename quisieramos podria puedo pueden puede seria sera hay tambien solo si no ok ya ahi aqui ' +
    'producto productos articulo articulos cosa cosas tipo tipos modelo modelos opcion opciones unidad unidades soles sol s cual barato barata baratos baratas caro cara caros caras economico economica ' +
    'mejor mejores recomiendan recomiendas recomendado recomendacion vendido vendidos pedido pedidos popular populares oferta ofertas descuento descuentos promo promocion promociones ' +
    'incluye incluyen trae traen viene vienen contiene detalle detalles caracteristica caracteristicas especificacion especificaciones medida medidas ' +
    'menos hasta entre desde maximo minimo aprox aproximadamente alrededor menor mayor ' +
    'casa hogar uso diario bueno buena buenos nuevo nueva nuevos original originales urgente hoy manana ahora ahorita rapido pronto porfavor ' +
    'alguien comprar compra pedir encargar llevar mandar quieren queremos necesitamos sabes saben podrias')
    .split(' ')
)

const singular = (w) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)

function tokens(text) {
  return norm(text)
    .split(' ')
    .filter((w) => (w.length > 1 || /\d/.test(w)) && !STOP.has(w))
    .map(singular)
}

function lev1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, diff = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++diff > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return diff + (a.length - i) + (b.length - j) <= 1
}

function wordScore(q, words, weight) {
  let best = 0
  for (const w of words) {
    if (w === q) return weight
    if (/^\d+$/.test(q)) continue // los números solo valen exactos
    if (q.length >= 3 && w.startsWith(q)) best = Math.max(best, weight * 0.85)
    else if (q.length >= 4 && w.length >= 4 && lev1(q, w)) best = Math.max(best, weight * 0.75)
    else if (q.length >= 5 && w.includes(q)) best = Math.max(best, weight * 0.6)
  }
  return best
}

const priceOf = (p) => {
  const sellable = p.variants.filter((v) => v.max === null || v.max > 0)
  const priced = (sellable.length ? sellable : p.variants).filter((v) => v.price !== null)
  return priced.length ? Math.min(...priced.map((v) => v.price)) : null
}

export function buildIndex(cat) {
  return cat.products.map((p) => ({
    p,
    name: tokens(p.name),
    tags: (p.tags || []).flatMap(tokens),
    cat: tokens(cat.catById[p.category_id]?.name || ''),
    attrs: Object.values(p.attributes || {}).flatMap((v) => tokens(v)),
    variants: p.variants.flatMap((v) => tokens(v.label)),
    desc: [...tokens(p.description), ...(p.details || []).flatMap((d) => d.items.flatMap(tokens))].slice(0, 90),
  }))
}

const FIELDS = [['name', 5], ['tags', 4], ['cat', 3], ['attrs', 3], ['variants', 2], ['desc', 1.2]]
const entryScore = (e, q) => Math.max(...FIELDS.map(([f, w]) => wordScore(q, e[f], w)))

// Busca productos. Ignora palabras que no existen en ningún producto ("perfume" en una perfumería),
// da más peso a las palabras raras (taladro) que a las comunes (Bosch) y avisa si no encontró todo.
export function searchProducts(index, text) {
  const qs = [...new Set(tokens(text))]
  if (!qs.length || !index.length) return { items: [], exact: true, terms: [], missing: [] }
  const df = qs.map((q) => index.filter((e) => entryScore(e, q) >= 1.5).length)
  const terms = qs.filter((_, i) => df[i] > 0)
  if (!terms.length) return { items: [], exact: true, terms: [], missing: qs }
  const idf = Object.fromEntries(terms.map((q) => [q, Math.log(1 + index.length / df[qs.indexOf(q)])]))
  const scored = index
    .map((e) => {
      let score = 0
      const hit = []
      for (const q of terms) {
        const s = entryScore(e, q)
        if (s >= 1.5) { hit.push(q); score += s * idf[q] }
      }
      return { p: e.p, score, hit }
    })
    .filter((x) => x.hit.length)
  const full = scored.filter((x) => x.hit.length === terms.length)
  const missing = qs.filter((q) => !terms.includes(q))
  const order = (list) => list.sort((a, b) => (a.p.soldOut - b.p.soldOut) || b.score - a.score)
  if (full.length) {
    const top = Math.max(...full.map((x) => x.score))
    return { items: order(full.filter((x) => x.score >= top * 0.5)).map((x) => x.p), exact: !missing.length, terms, missing }
  }
  // Nada tiene todas las palabras: primero lo de la palabra más específica, luego lo de las demás
  const seen = new Set()
  const items = []
  for (const q of [...terms].sort((a, b) => idf[b] - idf[a])) {
    for (const x of order(scored.filter((y) => y.hit.includes(q)))) {
      if (!seen.has(x.p.id)) { seen.add(x.p.id); items.push(x.p) }
    }
  }
  return { items: items.slice(0, 4), exact: false, union: true, terms, missing }
}

function faqMatch(faqs, text) {
  const t = ` ${norm(text)} `
  const qs = tokens(text)
  let best = null
  for (const f of faqs) {
    let score = 0
    for (const k of f.keywords || []) {
      const nk = norm(k)
      if (nk && t.includes(` ${nk} `)) score += 3
      else if (nk && nk.length >= 4 && qs.some((q) => lev1(q, singular(nk)) || q.startsWith(singular(nk)))) score += 2
    }
    const fq = tokens(f.question)
    const overlap = qs.filter((q) => fq.some((w) => w === q || (q.length >= 4 && lev1(q, w)))).length
    score += overlap * 1.5
    if (fq.length && overlap / fq.length >= 0.6) score += 2
    if (!best || score > best.score) best = { f, score }
  }
  return best && best.score >= 3 ? best.f : null
}

// ─── Intenciones ───
const INTENTS = [
  ['greet', /^(hola|holi|holaa+|buenas|buenos|buen dia|hey|que tal|alo|saludos)\b/],
  ['thanks', /^(gracias|muchas gracias|genial|perfecto|excelente|chevere|ok|okey|listo|dale|bacan|ya|entendido|super)\b/],
  ['human', /\b(asesor|asesora|humano|persona|encargad\w*|vendedor\w*|whatsapp|wsp|llamar|hablar con|numero de contacto|celular|telefono)\b/],
  ['hours', /\b(horario\w*|hora|horas|abren|abierto\w*|cierran|cerrado\w*|atienden|atencion|lunes|martes|miercoles|jueves|viernes|sabado|domingo|feriado\w*|hoy abren)\b/],
  ['delivery', /\b(delivery|deliveri|delivey|envio|envios|envian|enviar|despacho|despachan|llevan|reparto|domicilio|zona|zonas|recojo|recoger|recogo|pasar a recoger|entrega|entregan|llega|llegan|demora|tarda)\b/],
  ['payment', /\b(pago|pagos|pagar|pago con|yape|yapear|plin|transferencia|transferir|tarjeta|tarjetas|visa|mastercard|efectivo|metodo|metodos|cuenta|bcp|interbank|bbva|scotiabank|deposito|binance|usdt|cripto|paypal|contraentrega|contra entrega)\b/],
  ['location', /\b(donde|direccion|ubicacion|ubicados|ubicado|ubican|local|tienda fisica|mapa|como llego|como llegar|referencia)\b/],
  ['offers', /\b(oferta|ofertas|descuento|descuentos|promo|promos|promocion|promociones|rebaja|rebajas|liquidacion)\b/],
  ['cheap', /\b(barato|barata|baratos|baratas|economico|economica|economicos|menor precio|mas bajo)\b/],
  ['pricey', /\b(caro|cara|caros|mas caro|premium|mayor precio|mejor calidad)\b/],
  ['popular', /\b(mas vendido|mas vendidos|mas pedido|mas pedidos|recomiendan|recomiendas|recomendacion|recomendado|populares|lo mejor|top)\b/],
  ['howto', /\b(como compro|como pido|como hago|como comprar|como pedir|hacer pedido|hacer un pedido|carrito|como funciona|pasos)\b/],
  ['includes', /\b(incluye|incluyen|trae|traen|viene con|vienen con|contiene|detalle|detalles|caracteristica|caracteristicas|especificacion\w*|medida|medidas|material|garantia|que es)\b/],
  ['catalog', /\b(que venden|que tienen|que productos|que ofrecen|que hay|catalogo|que cosas|todo lo que|lista de)\b/],
  ['cats', /\b(categoria|categorias|secciones|rubros)\b/],
  ['count', /\b(cuantos productos|cuantas cosas|cuantos articulos|cuantos modelos)\b/],
  ['price', /\b(precio|precios|cuanto|cuesta|cuestan|vale|valen|sale|salen|costo|cobran)\b/],
  ['stock', /\b(hay|tienen|tienes|queda|quedan|stock|disponible|agotado|llego|llegaron)\b/],
]

const INFO_INTENTS = new Set(['greet', 'thanks', 'human', 'hours', 'delivery', 'payment', 'location', 'howto'])

const DAYS = [/\bdomingo/, /\blunes/, /\bmartes/, /\bmiercoles/, /\bjueves/, /\bviernes/, /\bsabado/]

const PAY_GROUPS = [
  ['Yape', /\b(yape|yapear)\b/, /yape/],
  ['Plin', /\bplin\b/, /plin/],
  ['tarjeta', /\b(tarjeta|tarjetas|visa|mastercard|credito|debito|pos)\b/, /tarjeta|visa|master|pos|credito|debito|izipay|niubiz|culqi/],
  ['transferencia', /\b(transferencia|transferir|deposito|bcp|interbank|bbva|scotiabank|cuenta bancaria)\b/, /transfer|deposito|bcp|interbank|bbva|scotia|banco|cuenta/],
  ['efectivo', /\b(efectivo|cash|contraentrega|contra entrega)\b/, /efectivo|contra ?entrega/],
  ['Binance', /\b(binance|usdt|cripto|crypto)\b/, /binance|usdt|cripto/],
  ['PayPal', /\bpaypal\b/, /paypal/],
]

function detect(cat, text) {
  const t = norm(text)
  const found = new Set()
  for (const [k, re] of INTENTS) if (re.test(t)) found.add(k)
  // Un medio de pago que el dueño cargó con otro nombre (ej. "Agora", "Tunki")
  if (cat.payment_methods.some((m) => norm(m.name).length > 2 && t.includes(norm(m.name)))) found.add('payment')
  return { set: found, words: t.split(' ').length, text: t }
}

// "menos de 50", "hasta 50", "entre 20 y 50", "de 20 soles", "más de 100"
function priceRange(t) {
  const n = (s) => Number(s.replace(',', '.'))
  let m = t.match(/\bentre (?:s )?(\d+(?:[.,]\d+)?) (?:y|a) (?:s )?(\d+(?:[.,]\d+)?)/)
  if (m) return { min: Math.min(n(m[1]), n(m[2])), max: Math.max(n(m[1]), n(m[2])), raw: m[0] }
  m = t.match(/\b(?:menos de|hasta|maximo|max|no mas de|por debajo de|debajo de) (?:s )?(\d+(?:[.,]\d+)?)/)
  if (m) return { min: null, max: n(m[1]), raw: m[0] }
  m = t.match(/\b(?:mas de|desde|minimo|arriba de|encima de) (?:s )?(\d+(?:[.,]\d+)?)/)
  if (m) return { min: n(m[1]), max: null, raw: m[0] }
  m = t.match(/\b(?:de|a|por|unos|como) (?:s )?(\d+(?:[.,]\d+)?) (?:soles|sol|lucas|s)\b/) || t.match(/\bs (\d+(?:[.,]\d+)?)\b/)
  if (m) { const v = n(m[1]); return { min: Math.round(v * 0.75), max: Math.round(v * 1.25), around: v, raw: m[0] } }
  return null
}

const join = (arr, last = 'y') => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} ${last} ${arr[arr.length - 1]}`)
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// ─── Bloques de información ───
function deliveryText(cat, intent) {
  const s = cat.checkout || {}
  const hasDelivery = cat.modules.delivery !== false && s.allow_delivery !== false
  const hasPickup = s.allow_pickup !== false
  const t = intent.text
  const asksPickup = /\b(recojo|recoger|recogo|pasar a recoger|ir a la tienda)\b/.test(t)
  const asksTime = /\b(demora|tarda|cuanto tiempo|cuando llega|en cuanto|que dia llega|mismo dia|hoy mismo)\b/.test(t)
  if (!hasDelivery && !hasPickup) return 'Coordinamos la entrega por WhatsApp cuando nos envías tu pedido.'
  const parts = []
  if (asksPickup && !hasDelivery) return `Sí, puedes recoger tu pedido${cat.settings.address ? ` en ${cat.settings.address}` : ' en tienda'}. Por ahora no hacemos delivery.`
  if (asksPickup && hasPickup && !/\b(delivery|envio|envian|domicilio)\b/.test(t)) return `Sí, puedes recoger tu pedido${cat.settings.address ? ` en ${cat.settings.address}` : ' en tienda'}.`
  if (asksPickup && !hasPickup) parts.push('No tenemos recojo en tienda, pero sí hacemos delivery.')
  if (hasDelivery) {
    const zone = cat.zones.find((z) => norm(z.name).length > 2 && ` ${t} `.includes(` ${norm(z.name)} `))
    const cost = (z) => (Number(z.cost) > 0 ? money(z.cost) : 'gratis')
    const place = !zone && (t.match(/\b(?:a|en|hasta|para|por) ((?:[a-zñ]+ ?){1,3})$/) || [])[1]?.trim()
    const asksPlace = place && !/^(domicilio|casa|mi casa|tienda|todo|toda|todos|la tienda|lima metropolitana|cuanto|cuanto sale|cuanto cuesta)$/.test(place) && !STOP.has(place)
    if (zone) parts.push(`Sí, llegamos a ${zone.name}: el delivery ${Number(zone.cost) > 0 ? `cuesta ${cost(zone)}` : 'es gratis'}.`)
    else if (asksPlace && cat.zones.length) {
      const list = cat.zones.slice(0, 10).map((z) => `• ${z.name}: ${cost(z)}`).join('\n')
      parts.push(`${place.replace(/\b\w/g, (c) => c.toUpperCase())} no está entre nuestras zonas de delivery, pero escríbenos y vemos si podemos llegar. Estas son nuestras zonas:\n${list}`)
    } else if (cat.zones.length) {
      const list = cat.zones.slice(0, 10).map((z) => `• ${z.name}: ${cost(z)}`).join('\n')
      const more = cat.zones.length > 10 ? `\n…y ${cat.zones.length - 10} zonas más.` : ''
      parts.push(`Sí hacemos delivery a estas zonas:\n${list}${more}`)
    } else parts.push('Sí hacemos delivery. El costo depende de tu zona; te lo confirmamos al recibir tu pedido.')
    if (asksTime) parts.push('El tiempo de entrega te lo confirmamos por WhatsApp al recibir tu pedido.')
    if (hasPickup && !zone) parts.push(`También puedes recoger tu pedido${cat.settings.address ? ` en ${cat.settings.address}` : ' en tienda'}.`)
  } else if (hasPickup) parts.push(`Por ahora no hacemos delivery, pero puedes recoger tu pedido${cat.settings.address ? ` en ${cat.settings.address}` : ' en tienda'}.`)
  return parts.join('\n\n')
}

function hoursText(cat, intent) {
  const hours = cat.settings.hours
  const st = openStatus(hours)
  if (!st) return 'No tenemos un horario publicado. Escríbenos por WhatsApp y te confirmamos.'
  const t = intent.text
  if (/\bferiado/.test(t)) return 'Para feriados escríbenos por WhatsApp y te confirmamos si atendemos.'
  const dayIdx = DAYS.findIndex((re) => re.test(t))
  const now = st.open ? `Ahora estamos abiertos (${st.label.split('·')[1]?.trim()}).` : `Ahora estamos cerrados (${st.label.split('·')[1]?.trim() || 'cerrado'}).`
  if (dayIdx >= 0) {
    const ranges = hours.filter((r) => r.days?.includes(dayIdx))
    const day = DAY_NAMES[dayIdx].toLowerCase()
    return ranges.length
      ? `Sí, el ${day} atendemos de ${ranges.map((r) => `${r.open} a ${r.close}`).join(' y de ')}.`
      : `El ${day} no atendemos. Nuestro horario:\n${hoursRows(hours).map((r) => `• ${r.label}: ${r.time}`).join('\n')}`
  }
  if (/\b(hoy|ahorita|ahora|abierto|abiertos|cerrado|atienden)\b/.test(t) && !/\bhorario/.test(t)) return now
  return `${now}\n\nNuestro horario:\n${hoursRows(hours).map((r) => `• ${r.label}: ${r.time}`).join('\n')}`
}

function paymentText(cat, intent) {
  const methods = cat.payment_methods.map((m) => m.name)
  if (!methods.length) return 'Coordinamos el pago por WhatsApp cuando confirmes tu pedido.'
  const asked = PAY_GROUPS.find(([, ask]) => ask.test(intent.text))
  const list = join(methods, 'o')
  if (asked) {
    const [label, , has] = asked
    const ok = cat.payment_methods.find((m) => has.test(norm(m.name)))
    if (ok) {
      const others = methods.filter((n) => n !== ok.name)
      return `Sí, aceptamos ${ok.name}.${others.length ? ` También puedes pagar con ${join(others, 'o')}.` : ''} Al enviar tu pedido verás los datos para pagar.`
    }
    return `Por ahora no aceptamos ${label}. Puedes pagar con ${list}.`
  }
  return `Puedes pagar con ${list}. Al enviar tu pedido verás los datos para pagar.`
}

function priceLine(p, query) {
  const v = matchVariant(p, query)
  if (v) return `• ${p.name} (${v.label}): ${v.price === null ? 'a consultar' : `${money(v.price)}${v.unit !== 'und' ? ` / ${v.unit}` : ''}`}${v.max !== null && v.max <= 0 ? ' · agotado' : ''}`
  const sellable = p.variants.filter((x) => x.max === null || x.max > 0)
  const priced = (sellable.length ? sellable : p.variants).filter((x) => x.price !== null)
  if (!priced.length) return `• ${p.name}: precio a consultar`
  const min = Math.min(...priced.map((x) => x.price))
  const unit = priced[0].unit !== 'und' ? ` / ${priced[0].unit}` : ''
  const from = priced.length > 1 && new Set(priced.map((x) => x.price)).size > 1
  const opts = from ? ` (${priced.length} opciones)` : ''
  return `• ${p.name}: ${from ? 'desde ' : ''}${money(min)}${unit}${opts}${p.soldOut ? ' · agotado' : ''}`
}

// La variante que nombra la pregunta ("100 ml", "3 meses", "grande")
function matchVariant(p, query) {
  if (p.variants.length < 2) return null
  const q = new Set(tokens(query))
  const hits = p.variants.filter((v) => {
    const t = tokens(v.label)
    return t.length && t.every((w) => q.has(w))
  })
  return hits.length === 1 ? hits[0] : null
}

const ASPECTS = ['garantia', 'medida', 'material', 'color', 'talla', 'peso', 'tamano', 'capacidad', 'duracion', 'origen', 'ingrediente']
function detailsHas(p, t) {
  const asp = ASPECTS.find((a) => t.includes(a))
  if (!asp) return true
  const blob = norm([p.description, ...(p.details || []).flatMap((d) => [d.title, ...d.items]), ...Object.entries(p.attributes || {}).flat()].join(' '))
  return blob.includes(asp)
}

function detailsText(p, t = '') {
  const asp = ASPECTS.find((a) => t.includes(a))
  if (asp && !detailsHas(p, t)) return `De ${p.name} no tengo información de ${asp === 'garantia' ? 'garantía' : asp === 'tamano' ? 'tamaño' : asp} cargada. Escríbenos por WhatsApp y te confirmamos.`
  const parts = []
  if (p.description) parts.push(p.description.length > 220 ? `${p.description.slice(0, 217)}…` : p.description)
  for (const d of p.details || []) {
    const title = d.title || { incluye: 'Incluye', atencion: 'Ten en cuenta', pasos: 'Cómo usar', nota: 'Nota' }[d.kind] || 'Detalle'
    parts.push(d.kind === 'nota' ? `${title}: ${d.items.join(' ')}` : `${title}:\n${d.items.slice(0, 6).map((x) => `• ${x}`).join('\n')}`)
  }
  const attrs = Object.entries(p.attributes || {}).slice(0, 6)
  if (attrs.length) parts.push(attrs.map(([k, v]) => `${k}: ${v}`).join(' · '))
  if (p.variants.length > 1) parts.push(`Opciones: ${p.variants.map((v) => v.label).join(', ')}.`)
  return parts.length ? `${p.name}\n\n${parts.join('\n\n')}` : `De ${p.name} no tengo más detalles cargados. Toca el producto para ver sus fotos o pregúntanos por WhatsApp.`
}

// Productos para mostrar cuando no preguntan algo puntual: lo más pedido, destacados y el resto
function showcase(cat, n = 4) {
  const seen = new Set()
  const out = []
  for (const p of [...(cat.popular || []), ...cat.products.filter((x) => x.featured), ...cat.products]) {
    if (out.length >= n) break
    if (seen.has(p.id) || p.soldOut) continue
    seen.add(p.id)
    out.push(p)
  }
  return out
}

function overview(cat) {
  const N = cat.products.length
  const name = cat.settings.business_name
  if (!N) return { text: `${name} todavía no tiene productos publicados. Escríbenos por WhatsApp y te ayudamos.`, products: [] }
  if (cat.categories.length) {
    const rows = cat.categories.map((c) => ({ c, n: cat.products.filter((p) => p.category_id === c.id).length })).filter((x) => x.n)
    const list = rows.slice(0, 8).map((x) => `• ${x.c.name} (${x.n})`).join('\n')
    const more = rows.length > 8 ? `\n…y ${rows.length - 8} categorías más.` : ''
    return {
      text: `Tenemos ${plural(N, 'producto', 'productos')} en ${plural(rows.length, 'categoría', 'categorías')}:\n${list}${more}\n\nDime qué buscas o el nombre de un producto y te lo muestro.`,
      products: showcase(cat).map((p) => p.id),
    }
  }
  if (N <= 6) {
    return { text: `Esto es todo lo que tenemos:\n${cat.products.map((p) => priceLine(p, '')).join('\n')}`, products: [] }
  }
  return { text: `Tenemos ${N} productos. Te muestro algunos; dime qué buscas y lo encuentro.`, products: showcase(cat).map((p) => p.id) }
}

// ¿La pregunta nombra una categoría? ("qué tienen en pinturas", "herramientas")
function categoryAsked(cat, intent) {
  const qs = new Set(tokens(intent.text))
  let best = null
  for (const c of cat.categories) {
    const ct = tokens(c.name)
    if (!ct.length) continue
    const hit = ct.filter((w) => [...qs].some((q) => q === w || (q.length >= 4 && (w.startsWith(q) || lev1(q, w))))).length
    if (hit && (hit === ct.length || hit >= 1 && ct.length > 1 && hit / ct.length >= 0.5) && (!best || hit > best.hit)) best = { c, hit }
  }
  return best?.c || null
}

// ¿Pregunta por los valores de una característica? ("qué marcas tienen", "qué aromas hay", "tallas")
function facetAsked(cat, intent) {
  const t = intent.text
  const f = (cat.facets || []).find((x) => {
    const k = singular(norm(x.label).split(' ')[0] || '')
    return k.length > 2 && new RegExp(`\\b${k}(s|es)?\\b`).test(t)
  })
  if (f) return f
  if (/\b(marca|marcas)\b/.test(t)) return { missing: true, label: 'marcas' }
  return null
}

export function answer(cat, index, text) {
  const intent = detect(cat, text)
  const has = (k) => intent.set.has(k)
  const name = cat.settings.business_name
  const out = { text: '', products: [], actions: [], unanswered: false }
  const say = (t) => { out.text = t; return out }

  if (!intent.text) return say('¿En qué te ayudo? Pregúntame por un producto, precios, delivery o formas de pago.')

  // 1) Las preguntas frecuentes del dueño mandan
  const faq = faqMatch(cat.faqs, text)
  const range = priceRange(intent.text)
  // Las palabras que ya respondimos como información (pago, delivery, horario…) no se buscan como productos
  let queryText = range ? intent.text.replace(range.raw, ' ') : intent.text
  for (const [k, re] of INTENTS) {
    if (!INFO_INTENTS.has(k) || !intent.set.has(k)) continue
    queryText = queryText.replace(new RegExp(re.source, 'g'), ' ')
  }
  for (const z of cat.zones) if (norm(z.name).length > 2) queryText = queryText.replace(new RegExp(`\\b${norm(z.name)}\\b`, 'g'), ' ')
  for (const m of cat.payment_methods) if (norm(m.name).length > 2) queryText = queryText.replace(new RegExp(`\\b${norm(m.name)}\\b`, 'g'), ' ')
  const search = searchProducts(index, queryText)
  const found = search.items

  if (has('greet') && intent.words <= 4 && !found.length) {
    const can = ['productos y precios']
    if (cat.modules.delivery !== false && cat.checkout?.allow_delivery !== false) can.push('delivery')
    if (cat.payment_methods.length) can.push('formas de pago')
    if (cat.settings.hours.length) can.push('horario')
    return say(`¡Hola! 👋 ¿Qué estás buscando? Puedo ayudarte con ${join(can)}.`)
  }
  if (has('thanks') && intent.words <= 3 && !found.length && !has('price')) return say('¡Con gusto! Si necesitas algo más, aquí estoy.')

  if (faq) {
    out.text = faq.answer
    out.products = found.slice(0, 3).map((p) => p.id)
    return out
  }

  // 2) Información del negocio (puede combinar varias en una sola respuesta)
  const blocks = []
  if (has('hours')) blocks.push(hoursText(cat, intent))
  if (has('delivery')) blocks.push(deliveryText(cat, intent))
  if (has('payment')) blocks.push(paymentText(cat, intent))
  if (has('location')) {
    if (cat.settings.address) {
      blocks.push(`Estamos en ${cat.settings.address}.`)
      if (cat.settings.maps_url) out.actions.push('maps')
    } else blocks.push('No tenemos una dirección publicada. Escríbenos por WhatsApp y te indicamos.')
  }
  if (has('howto')) {
    blocks.push('Es fácil:\n1. Agrega lo que quieras al carrito.\n2. Toca "Continuar" y completa tus datos.\n3. Envía el pedido: se abre WhatsApp con todo listo y ahí te confirmamos.')
    out.actions.push('cart')
  }
  if (has('human')) {
    blocks.push('Claro, te atendemos por WhatsApp.')
    out.actions.push('whatsapp')
  }
  const infoOnly = blocks.length > 0

  // 3) Productos
  const facet = facetAsked(cat, intent)
  const catAsked = categoryAsked(cat, intent)
  const onlyCategoryWords = catAsked && search.terms.every((q) => tokens(catAsked.name).some((w) => w === q || w.startsWith(q) || lev1(q, w)))
  const withRange = (list) => (range ? list.filter((p) => { const v = priceOf(p); return v !== null && (range.min === null || v >= range.min) && (range.max === null || v <= range.max) }) : list)
  const byPrice = (list, dir = 1) => [...list].sort((a, b) => (priceOf(a) === null) - (priceOf(b) === null) || dir * (priceOf(a) - priceOf(b)))
  const rangeLabel = range ? (range.around ? `de unos ${money(range.around)}` : range.min !== null && range.max !== null ? `entre ${money(range.min)} y ${money(range.max)}` : range.max !== null ? `de hasta ${money(range.max)}` : `de más de ${money(range.min)}`) : ''
  const moreAction = (n, q, label) => n > 4 && out.actions.push({ type: 'search', q, label })

  if (facet && !found.length) {
    if (facet.missing) blocks.push('No tengo las marcas cargadas en el catálogo. Pregúntame por el producto que buscas y te digo qué tenemos.')
    else {
      const vals = facet.values.slice(0, 12).map((v) => v.value)
      blocks.push(`${facet.label}: ${join(vals)}${facet.values.length > 12 ? ` y ${facet.values.length - 12} más` : ''}.\n\nDime cuál te interesa y te muestro los productos.`)
    }
  } else if (catAsked && onlyCategoryWords && !has('includes')) {
    let list = cat.products.filter((p) => p.category_id === catAsked.id)
    list = withRange(list)
    if (has('cheap')) list = byPrice(list)
    else if (has('pricey')) list = byPrice(list, -1)
    const prices = list.map(priceOf).filter((x) => x !== null)
    const from = prices.length ? ` desde ${money(Math.min(...prices))}` : ''
    if (!list.length) blocks.push(range ? `En ${catAsked.name} no tengo productos ${rangeLabel}.` : `Por ahora no tenemos productos en ${catAsked.name}.`)
    else {
      blocks.push(`En ${catAsked.name} tenemos ${plural(list.length, 'producto', 'productos')}${range ? ` ${rangeLabel}` : from}.${list.length > 4 ? (has('cheap') ? ' Los más económicos:' : has('pricey') ? ' Los de mayor precio:' : ' Te muestro algunos:') : ''}`)
      out.products = list.slice(0, 4).map((p) => p.id)
      if (list.length > 4 && !range) out.actions.push({ type: 'cat', id: catAsked.id, label: `Ver los ${list.length} de ${catAsked.name}` })
    }
  } else if (found.length) {
    let list = withRange(found)
    let rangeMiss = false
    if (range && !list.length) {
      blocks.push(`No tengo ${norm(queryText).split(' ').filter((w) => w.length > 1 && !STOP.has(w)).join(' ') || 'productos'} ${rangeLabel}. Lo más cercano:`)
      list = byPrice(found)
      rangeMiss = true
    }
    if (has('cheap')) list = byPrice(list)
    else if (has('pricey')) list = byPrice(list, -1)
    const shown = list.slice(0, 4)
    const q = search.terms.join(' ')
    const asked = norm(queryText).split(' ').filter((w) => (w.length > 1 || /\d/.test(w)) && !STOP.has(w)).join(' ')
    if (!search.exact) blocks.push(search.missing.length && search.missing.length < tokens(queryText).length
      ? `No encontré "${norm(queryText).split(' ').filter((w) => search.missing.includes(singular(w))).join(' ')}". Esto es lo que más se parece:`
      : `No encontré "${asked}" tal cual. Esto es lo más parecido:`)

    if (has('includes') && list.length > 1 && ASPECTS.some((x) => intent.text.includes(x)) && !list.some((p) => detailsHas(p, intent.text))) {
      blocks.push(detailsText(list[0], intent.text).replace(`De ${list[0].name}`, `De ${join(search.terms)}`))
      out.products = shown.map((p) => p.id)
      out.actions.push('whatsapp')
    } else if (has('includes') && list.length > 1 && !matchVariant(list[0], queryText)) {
      blocks.push(`¿De cuál quieres saber más? Tengo ${plural(list.length, 'opción', 'opciones')}${list.length > 4 ? '; te muestro algunas' : ''}. Toca uno para ver todos sus detalles.`)
      out.products = shown.map((p) => p.id)
    } else if (has('includes')) {
      blocks.push(detailsText(list[0], intent.text))
      out.products = [list[0].id]
      if (!detailsHas(list[0], intent.text)) out.actions.push('whatsapp')
    } else if (has('price') || has('cheap') || has('pricey') || range) {
      const rl = range && !rangeMiss ? ` ${rangeLabel}` : ''
      const head = list.length > 4 ? `Tenemos ${list.length} opciones${rl}. ${has('cheap') ? 'Las más económicas:' : has('pricey') ? 'Las de mayor precio:' : 'Algunas:'}\n` : rl ? `${plural(list.length, 'opción', 'opciones')}${rl}:\n` : ''
      blocks.push(head + shown.map((p) => priceLine(p, queryText)).join('\n'))
      out.products = shown.map((p) => p.id)
    } else if (has('stock') && list.length === 1) {
      const p = list[0]
      const v = matchVariant(p, queryText)
      if (v) blocks.push(v.max !== null && v.max <= 0 ? `${p.name} (${v.label}) está agotado por ahora.` : `Sí, tenemos ${p.name} (${v.label}) a ${v.price === null ? 'precio a consultar' : money(v.price)}.`)
      else blocks.push(p.soldOut ? `${p.name} está agotado por ahora. Escríbenos y te avisamos cuando llegue.` : `Sí, tenemos ${p.name}.`)
      out.products = [p.id]
    } else {
      const v = list.length === 1 ? matchVariant(list[0], queryText) : null
      if (v) blocks.push(`${list[0].name} (${v.label}): ${v.price === null ? 'precio a consultar' : money(v.price)}.`)
      else if (list.length > 4) blocks.push(`Tenemos ${list.length} opciones${search.exact ? '' : ' parecidas'}. Te muestro ${has('cheap') ? 'las más económicas' : 'algunas'}:`)
      else if (search.exact) blocks.push(list.length === 1 ? (list[0].soldOut ? `Tenemos ${list[0].name}, pero está agotado por ahora.` : 'Esto es lo que encontré:') : 'Encontré estas opciones:')
      out.products = shown.map((p) => p.id)
    }
    moreAction(list.length, q, `Ver las ${list.length} en el catálogo`)
  } else if (!infoOnly || has('offers') || has('popular') || has('cheap') || range) {
    if (search.missing.length && !has('catalog') && !has('cats') && !has('count') && !has('offers') && !has('popular') && !has('cheap') && !has('pricey') && !range) {
      // Preguntó por algo que no existe
      out.unanswered = true
      blocks.push(`No encontré "${search.missing.join(' ')}" en el catálogo de ${name}. Prueba con otra palabra o escríbenos y te ayudamos.`)
      out.actions.push('whatsapp')
    } else if (has('offers')) {
      const deals = cat.products.filter((p) => !p.soldOut && (p.variants.some((v) => v.compare && v.price && v.compare > v.price) || /oferta|promo|descuento|remate|liquida/i.test(p.badge || '')))
      if (deals.length) {
        blocks.push(deals.length > 4 ? `Tenemos ${deals.length} productos en oferta. Algunos:` : 'Estas son nuestras ofertas:')
        out.products = deals.slice(0, 4).map((p) => p.id)
      } else {
        blocks.push('Por ahora no tenemos ofertas publicadas. Te muestro algunos de nuestros productos:')
        out.products = showcase(cat).map((p) => p.id)
      }
    } else if (has('popular')) {
      const pop = cat.popular?.length ? cat.popular : cat.products.filter((p) => p.featured && !p.soldOut)
      blocks.push(pop.length ? (cat.popular?.length ? 'Esto es lo que más nos piden:' : 'Te recomendamos:') : 'Te muestro algunos de nuestros productos:')
      out.products = (pop.length ? pop : showcase(cat)).slice(0, 4).map((p) => p.id)
    } else if (has('cheap') || has('pricey') || range) {
      const list = byPrice(withRange(cat.products.filter((p) => !p.soldOut && priceOf(p) !== null)), has('pricey') ? -1 : 1)
      if (!list.length) blocks.push(range ? `No tengo productos ${rangeLabel}.` : 'Por ahora los precios se consultan por WhatsApp.')
      else {
        blocks.push(`${range ? `Tenemos ${plural(list.length, 'producto', 'productos')} ${rangeLabel}` : has('pricey') ? 'Los de mayor precio' : 'Lo más económico'}:\n${list.slice(0, 4).map((p) => priceLine(p, '')).join('\n')}`)
        out.products = list.slice(0, 4).map((p) => p.id)
      }
    } else if (has('count')) {
      blocks.push(`Tenemos ${plural(cat.products.length, 'producto', 'productos')}${cat.categories.length ? ` en ${plural(cat.categories.length, 'categoría', 'categorías')}` : ''}.`)
    } else if (has('cats') && !cat.categories.length) {
      const o = overview(cat)
      blocks.push(`No separamos por categorías. ${o.text}`)
      out.products = o.products
    } else if (has('catalog') || has('cats') || (has('stock') && intent.words <= 3 && !/\b(stock|disponible|agotado|queda|quedan)\b/.test(intent.text))) {
      const o = overview(cat)
      blocks.push(o.text)
      out.products = o.products
    } else if (has('price') || has('stock')) {
      blocks.push('¿De qué producto? Escríbeme su nombre (por ejemplo, ' + `"${(showcase(cat, 1)[0]?.name || 'el producto').split(' ').slice(0, 3).join(' ')}"` + ') y te digo el precio y si hay.')
    } else if (has('includes')) {
      blocks.push('¿De qué producto quieres saber los detalles? Escríbeme su nombre.')
    }
  }

  if (blocks.length) return say(blocks.filter(Boolean).join('\n\n'))

  out.unanswered = true
  out.actions.push('whatsapp')
  return say(`No entendí bien. Puedes preguntarme por un producto, precios${cat.payment_methods.length ? ', formas de pago' : ''}${cat.modules.delivery !== false && cat.checkout?.allow_delivery !== false ? ', delivery' : ''} o escribirnos por WhatsApp.`)
}

export function suggestions(cat) {
  const s = []
  if (cat.categories.length) s.push(...cat.categories.slice(0, 2).map((c) => `¿Qué tienen en ${c.name.toLowerCase()}?`))
  else if (cat.products.length) s.push('¿Qué productos tienen?')
  const top = showcase(cat, 1)[0]
  if (top && s.length < 2) s.push(`¿Cuánto cuesta ${top.name.split(' ').slice(0, 4).join(' ')}?`)
  if (cat.modules.delivery !== false && cat.checkout?.allow_delivery !== false) s.push('¿Hacen delivery?')
  if (cat.payment_methods.length) s.push('¿Cómo puedo pagar?')
  if (cat.settings.hours.length) s.push('¿Cuál es su horario?')
  if (cat.faqs[0]) s.push(cat.faqs[0].question)
  s.push('¿Cómo hago mi pedido?')
  return [...new Set(s)].slice(0, 4)
}
