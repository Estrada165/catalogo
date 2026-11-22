// Asistente local: responde solo con la información que cargó el dueño
// (productos, variantes, preguntas frecuentes, horario, delivery, pagos, dirección).
// No usa IA ni APIs externas: todo corre en el navegador.
import { money } from './format'
import { openStatus, hoursRows } from './hours'

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
    'hay tienen tiene tienes tendran venden vende vendes quiero quisiera queria busco buscando necesito algo algun alguna alguno del al como ' +
    'cuanto cuanta cuantos cuesta cuestan precio precios vale valen sale salen hola buenas buenos dias tardes noches favor gracias porfa pls ' +
    'ustedes usted tu yo mas muy bien ver disponible disponibles stock venta ventas info informacion consulta pregunta otro otra eso esto este ese')
    .split(' ')
)

const singular = (w) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)

function tokens(text) {
  return norm(text)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w))
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
    if (q.length >= 3 && w.startsWith(q)) best = Math.max(best, weight * 0.85)
    else if (q.length >= 4 && w.length >= 4 && lev1(q, w)) best = Math.max(best, weight * 0.75)
    else if (q.length >= 5 && w.includes(q)) best = Math.max(best, weight * 0.6)
  }
  return best
}

export function buildIndex(cat) {
  return cat.products.map((p) => ({
    p,
    name: tokens(p.name),
    tags: (p.tags || []).flatMap(tokens),
    cat: tokens(cat.catById[p.category_id]?.name || ''),
    attrs: Object.entries(p.attributes || {}).flatMap(([k, v]) => tokens(`${k} ${v}`)),
    variants: p.variants.flatMap((v) => tokens(v.label)),
    desc: tokens(p.description).slice(0, 60),
  }))
}

export function searchProducts(index, text, limit = 4) {
  const qs = tokens(text)
  if (!qs.length) return []
  const scored = index
    .map((e) => {
      let score = 0
      let hits = 0
      for (const q of qs) {
        const s = Math.max(
          wordScore(q, e.name, 5),
          wordScore(q, e.tags, 4),
          wordScore(q, e.cat, 3),
          wordScore(q, e.attrs, 2.5),
          wordScore(q, e.variants, 2),
          wordScore(q, e.desc, 1.2)
        )
        if (s > 0) hits++
        score += s
      }
      // Premia que coincidan varias palabras de la pregunta
      return { p: e.p, score: score * (hits / qs.length) }
    })
    .filter((x) => x.score >= 2.4)
    .sort((a, b) => b.score - a.score)
  if (!scored.length) return []
  const top = scored[0].score
  return scored.filter((x) => x.score >= top * 0.45).slice(0, limit).map((x) => x.p)
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

const INTENTS = [
  ['greet', /^(hola|holi|buenas|buenos|buen dia|hey|que tal|alo|saludos)\b/],
  ['thanks', /\b(gracias|genial|perfecto|excelente|chevere|ok|listo|vale)\b/],
  ['human', /\b(asesor|asesora|humano|persona|encargad|vendedor|whatsapp|wsp|llamar|hablar con|numero)\b/],
  ['hours', /\b(horario|horarios|hora|abren|abierto|abiertos|cierran|cerrado|atienden|atencion|domingo|sabado|feriado)\b/],
  ['delivery', /\b(delivery|deliveri|envio|envios|envian|enviar|despacho|despachan|llevan|reparto|domicilio|zona|zonas|recojo|recoger)\b/],
  ['payment', /\b(pago|pagos|pagar|yape|yapear|plin|transferencia|transferir|tarjeta|efectivo|metodo|metodos|cuenta|bcp|interbank|bbva|deposito)\b/],
  ['location', /\b(donde|direccion|ubicacion|ubicados|ubicado|local|tienda fisica|mapa|quedan|llegar)\b/],
  ['offers', /\b(oferta|ofertas|descuento|descuentos|promo|promocion|promociones|rebaja|barato|baratos|economico)\b/],
  ['howto', /\b(como compro|como pido|como hago|como comprar|como pedir|hacer pedido|hacer un pedido|carrito)\b/],
  ['catalog', /\b(que venden|que tienen|que productos|catalogo|categorias|que ofrecen|que hay)\b/],
  ['price', /\b(precio|precios|cuanto|cuesta|cuestan|vale|valen|sale|costo)\b/],
  ['stock', /\b(hay|tienen|tienes|queda|quedan|stock|disponible|agotado)\b/],
]

function detect(text) {
  const t = norm(text)
  const found = new Set()
  for (const [k, re] of INTENTS) if (re.test(t)) found.add(k)
  return { set: found, short: t.split(' ').length <= 4, text: t }
}

function deliveryText(cat) {
  const s = cat.checkout || {}
  const hasDelivery = cat.modules.delivery !== false && s.allow_delivery !== false
  const hasPickup = s.allow_pickup !== false
  const parts = []
  if (hasDelivery) {
    if (cat.zones.length) {
      const z = cat.zones.slice(0, 8).map((x) => `${x.name}: ${Number(x.cost) > 0 ? money(x.cost) : 'gratis'}`).join('\n')
      parts.push(`Sí hacemos delivery. Estas son nuestras zonas:\n${z}`)
    } else parts.push('Sí hacemos delivery. El costo depende de tu zona; te lo confirmamos al recibir tu pedido.')
  }
  if (hasPickup) parts.push(`También puedes recoger tu pedido${cat.settings.address ? ` en ${cat.settings.address}` : ' en tienda'}.`)
  if (!parts.length) return 'Coordinamos la entrega por WhatsApp al recibir tu pedido.'
  return parts.join('\n\n')
}

function hoursText(cat) {
  const st = openStatus(cat.settings.hours)
  if (!st) return 'No tenemos un horario publicado. Escríbenos por WhatsApp y te confirmamos.'
  const rows = hoursRows(cat.settings.hours).map((r) => `${r.label}: ${r.time}`).join('\n')
  return `${st.open ? 'Ahora estamos abiertos.' : 'Ahora estamos cerrados.'} ${st.label.split('·')[1]?.trim() ? `(${st.label.split('·')[1].trim()})` : ''}\n\nNuestro horario:\n${rows}`.replace(' ()', '')
}

function paymentText(cat) {
  const m = cat.payment_methods
  if (!m.length) return 'Coordinamos el pago por WhatsApp cuando confirmes tu pedido.'
  return `Puedes pagar con ${m.map((x) => x.name).join(', ').replace(/, ([^,]*)$/, ' o $1')}. Al enviar tu pedido verás los datos para pagar.`
}

function priceLine(p) {
  const sellable = p.variants.filter((v) => v.max === null || v.max > 0)
  const priced = (sellable.length ? sellable : p.variants).filter((v) => v.price !== null)
  if (!priced.length) return `${p.name}: precio a consultar`
  const min = Math.min(...priced.map((v) => v.price))
  const unit = priced[0].unit !== 'und' ? ` / ${priced[0].unit}` : ''
  return `${p.name}: ${priced.length > 1 && new Set(priced.map((v) => v.price)).size > 1 ? 'desde ' : ''}${money(min)}${unit}${p.soldOut ? ' (agotado)' : ''}`
}

export function answer(cat, index, text) {
  const intent = detect(text)
  const has = (k) => intent.set.has(k)
  const name = cat.settings.business_name
  const out = { text: '', products: [], actions: [], unanswered: false }

  const faq = faqMatch(cat.faqs, text)
  const found = searchProducts(index, text)

  if (has('greet') && intent.short && !found.length) {
    out.text = `¡Hola! ¿Qué estás buscando? Puedo mostrarte productos, precios, cómo hacer tu pedido${cat.settings.hours.length ? ', nuestro horario' : ''} y formas de pago.`
    return out
  }
  if (has('thanks') && intent.short && !found.length) {
    out.text = '¡Con gusto! Si necesitas algo más, aquí estoy.'
    return out
  }

  if (faq) {
    out.text = faq.answer
    out.products = found.slice(0, 3).map((p) => p.id)
    return out
  }

  const blocks = []
  if (has('hours')) blocks.push(hoursText(cat))
  if (has('delivery')) blocks.push(deliveryText(cat))
  if (has('payment')) blocks.push(paymentText(cat))
  if (has('location')) {
    if (cat.settings.address) {
      blocks.push(`Estamos en ${cat.settings.address}.`)
      if (cat.settings.maps_url) out.actions.push('maps')
    } else blocks.push('No tenemos una dirección publicada. Escríbenos por WhatsApp y te indicamos.')
  }
  if (has('howto')) {
    blocks.push('Es fácil: agrega lo que quieras al carrito, toca "Continuar", completa tus datos y envía el pedido por WhatsApp. Ahí te confirmamos todo.')
    out.actions.push('cart')
  }
  if (has('human')) {
    blocks.push(`Claro, te atendemos por WhatsApp.`)
    out.actions.push('whatsapp')
  }

  if (found.length) {
    const asksPrice = has('price')
    const asksStock = has('stock')
    let head = found.length === 1 ? 'Esto es lo que encontré:' : 'Encontré estas opciones:'
    if (asksPrice) head = found.map(priceLine).join('\n')
    else if (asksStock && found.length === 1) {
      head = found[0].soldOut ? `${found[0].name} está agotado por ahora.` : `Sí, tenemos ${found[0].name}.`
    }
    blocks.push(head)
    out.products = found.map((p) => p.id)
  } else if (has('offers')) {
    const deals = cat.products.filter((p) => p.variants.some((v) => v.compare && v.price && v.compare > v.price) || /oferta|promo|descuento/i.test(p.badge || ''))
    if (deals.length) {
      blocks.push('Estas son nuestras ofertas:')
      out.products = deals.slice(0, 4).map((p) => p.id)
    } else blocks.push('Por ahora no tenemos ofertas publicadas.')
  } else if (has('catalog') || (has('stock') && !tokens(text).length)) {
    const cats = cat.categories.map((c) => c.name)
    blocks.push(cats.length ? `En ${name} tenemos: ${cats.join(', ')}.` : `Tenemos ${cat.products.length} productos en el catálogo.`)
    out.products = (cat.products.filter((p) => p.featured).length ? cat.products.filter((p) => p.featured) : cat.products).slice(0, 4).map((p) => p.id)
  }

  if (blocks.length) {
    out.text = blocks.join('\n\n')
    return out
  }

  out.unanswered = true
  out.text = `No encontré eso en el catálogo de ${name}. Puedes intentar con otra palabra o preguntarnos directamente.`
  out.actions.push('whatsapp')
  return out
}

export function suggestions(cat) {
  const s = []
  const cats = cat.categories.slice(0, 2).map((c) => `¿Qué tienen en ${c.name.toLowerCase()}?`)
  s.push(...cats)
  if (cat.modules.delivery !== false && cat.checkout?.allow_delivery !== false) s.push('¿Hacen delivery?')
  if (cat.payment_methods.length) s.push('¿Cómo puedo pagar?')
  if (cat.settings.hours.length) s.push('¿Cuál es su horario?')
  if (cat.faqs[0]) s.push(cat.faqs[0].question)
  return s.slice(0, 4)
}
