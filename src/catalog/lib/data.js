import { supabase } from '../../lib/supabase'

// Estilo de cada plantilla → tipografías y tipo de tarjeta por defecto
const STYLE_DEFAULTS = {
  editorial: { display: 'fraunces', body: 'plus-jakarta', cards: 'plus-jakarta', card_style: 'linea' },
  industrial: { display: 'space-grotesk', body: 'dm-sans', cards: 'space-grotesk', card_style: 'tecla' },
  fresco: { display: 'outfit', body: 'plus-jakarta', cards: 'outfit', card_style: 'suave' },
  glamour: { display: 'dm-serif', body: 'manrope', cards: 'manrope', card_style: 'linea' },
  suave: { display: 'fraunces', body: 'rubik', cards: 'rubik', card_style: 'suave' },
  neon: { display: 'unbounded', body: 'plus-jakarta', cards: 'plus-jakarta', card_style: 'tecla' },
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

export function normalizeCatalog({ tenant, config, categories, products, zones, faqs, popular }) {
  const business = config?.business || {}
  const theme = config?.theme || {}
  const checkout = config?.checkout || {}
  const modules = config?.modules || {}
  const sections = [...(config?.sections || [])].sort((a, b) => a.order - b.order)
  const sectionOn = (type) => {
    const s = sections.find((x) => x.type === type)
    return s ? s.enabled !== false : true
  }
  const sectionProps = (type) => sections.find((x) => x.type === type)?.props || {}
  const style = STYLE_DEFAULTS[theme.style] || STYLE_DEFAULTS.industrial

  const settings = {
    business_name: business.name || tenant.name,
    logo_url: business.logo || null,
    logo_shape: business.logo_shape || 'square',
    tagline: business.tagline || '',
    description: business.description || '',
    whatsapp: business.whatsapp || '',
    whatsapp_display: business.whatsapp_display || business.whatsapp || '',
    address: business.address || '',
    maps_url: business.maps_url || '',
    hours: Array.isArray(business.hours) ? business.hours : [],
    social: business.social || {},
    accent: theme.accent || '#FF6B35',
    theme_default: theme.mode === 'auto' || !theme.mode ? 'system' : theme.mode,
    radius: theme.radius || 18,
    // Portada opcional: imagen (con difuminado) o degradado con tus colores
    cover: (() => {
      const c = theme.cover || {}
      const mode = c.mode === 'image' && c.image ? 'image' : c.mode === 'gradient' ? 'gradient' : 'none'
      return {
        mode,
        image: c.image || null,
        strength: Math.min(100, Math.max(20, Number(c.strength) || 80)),
        blur: !!c.blur,
        focus: ['left', 'center', 'right'].includes(c.focus) ? c.focus : 'center',
        color1: c.color1 || theme.accent || '#18181B',
        color2: c.color2 || '#8B7DFF',
        shape: c.shape === 'diagonal' ? 'diagonal' : 'aurora',
        span: c.span === 'page' ? 'page' : 'hero', // solo la portada o fondo de toda la página
      }
    })(),
    card_style: theme.card_style || style.card_style,
    font_display: theme.font_display || style.display,
    font_body: theme.font_body || style.body,
    font_cards: theme.font_cards || style.cards,
    currency_symbol: 'S/',
  }

  const catById = Object.fromEntries((categories || []).map((c) => [c.id, c]))

  const list = (products || [])
    .filter((p) => p.visible !== false && (!p.category_id || catById[p.category_id]?.visible !== false))
    .sort((a, b) => a.sort - b.sort)
    .map((p) => {
      const variants = (p.product_variants || [])
        .filter((v) => v.visible !== false)
        .sort((a, b) => a.sort - b.sort)
        .map((v) => ({
          id: v.id,
          label: v.label || 'Único',
          price: num(v.price),
          compare: num(v.compare_price),
          unit: modules.peso ? v.unit || 'und' : 'und',
          min_qty: modules.peso ? Number(v.min_qty) || 1 : 1,
          step: modules.peso ? Number(v.step) || 1 : 1,
          max: modules.stock && v.stock !== null && v.stock !== undefined ? Number(v.stock) : null,
          sku: v.sku,
        }))
      const sellable = variants.filter((v) => v.max === null || v.max > 0)
      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        images: p.images || [],
        attributes: p.attributes || {},
        details: (Array.isArray(p.details) ? p.details : [])
          .filter((d) => d && Array.isArray(d.items) && d.items.some(Boolean))
          .map((d) => ({ kind: d.kind || 'incluye', title: d.title || '', items: d.items.filter(Boolean).map(String) })),
        tags: p.tags || [],
        badge: p.badge || null,
        featured: !!p.featured,
        created_at: p.created_at || null,
        category_id: p.category_id && catById[p.category_id] ? p.category_id : null,
        variants,
        soldOut: variants.length > 0 && sellable.length === 0,
      }
    })
    .filter((p) => p.variants.length > 0)

  const usedCats = (categories || [])
    .filter((c) => c.visible !== false && list.some((p) => p.category_id === c.id))
    .sort((a, b) => a.sort - b.sort)

  const byId = Object.fromEntries(list.map((p) => [p.id, p]))
  const facets = buildFacets(list)
  const variantById = {}
  list.forEach((p) => p.variants.forEach((v) => (variantById[v.id] = { ...v, product: p })))

  return {
    tenant,
    settings,
    modules,
    checkout,
    payment_methods: Array.isArray(checkout.payment_methods) ? checkout.payment_methods.filter((m) => m && m.name) : [],
    sections: { on: sectionOn, props: sectionProps },
    categories: usedCats,
    facets,
    catById,
    products: list,
    byId,
    variantById,
    // Lo más pedido (pedidos reales); si la función aún no existe llega vacío
    popular: (popular || []).map((r) => byId[r.product_id]).filter((p) => p && !p.soldOut),
    zones: (zones || []).filter((z) => z.active !== false).sort((a, b) => a.sort - b.sort),
    faqs: (faqs || []).filter((f) => f.active !== false).sort((a, b) => a.sort - b.sort),
    bot: {
      enabled: modules.bot !== false && config?.bot?.enabled !== false,
      name: config?.bot?.name || 'Lu',
      greeting: config?.bot?.greeting || '',
      avatar_url: config?.bot?.avatar || null,
    },
  }
}

// Filtros automáticos a partir de las características (Marca, Aroma, Talla, Color…):
// solo aparecen las que se repiten en varios productos, así sirven para cualquier rubro
const fold = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
const PRIORITY = /^(marca|brand|fabricante|laboratorio)$/
function buildFacets(list) {
  const keys = new Map()
  list.forEach((p) => {
    Object.entries(p.attributes || {}).forEach(([k, v]) => {
      const key = fold(k)
      const val = String(v ?? '').trim()
      if (!key || !val || val.length > 40) return
      if (!keys.has(key)) keys.set(key, { key, labels: new Map(), values: new Map(), products: new Set() })
      const f = keys.get(key)
      f.labels.set(k.trim(), (f.labels.get(k.trim()) || 0) + 1)
      const vk = fold(val)
      const cur = f.values.get(vk) || { value: val, count: 0 }
      cur.count++
      f.values.set(vk, cur)
      f.products.add(p.id)
    })
  })
  return [...keys.values()]
    .filter((f) => f.values.size >= 2 && f.values.size <= 40 && f.products.size >= 2)
    .map((f) => ({
      key: f.key,
      label: [...f.labels.entries()].sort((a, b) => b[1] - a[1])[0][0],
      values: [...f.values.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es')),
      coverage: f.products.size,
    }))
    .sort((a, b) => (PRIORITY.test(b.key) ? 1 : 0) - (PRIORITY.test(a.key) ? 1 : 0) || b.coverage - a.coverage)
    .slice(0, 4)
}

export const facetValue = (p, key) => {
  const hit = Object.entries(p.attributes || {}).find(([k]) => fold(k) === key)
  return hit ? fold(hit[1]) : null
}
export { fold }

export async function fetchCatalog(slug) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, slug, name, status, expires_at')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error

  if (!tenant) {
    const { data: current } = await supabase.rpc('resolve_slug', { p_slug: slug })
    if (current && current !== slug) return { state: 'moved', slug: current }
    return null
  }

  const [cfg, cats, prods, zones, faqs, pop] = await Promise.all([
    supabase.from('tenant_config').select('*').eq('tenant_id', tenant.id).maybeSingle(),
    supabase.from('categories').select('*').eq('tenant_id', tenant.id),
    supabase.from('products').select('*, product_variants(*)').eq('tenant_id', tenant.id),
    supabase.from('delivery_zones').select('*').eq('tenant_id', tenant.id),
    supabase.from('bot_faqs').select('*').eq('tenant_id', tenant.id),
    supabase.rpc('popular_products', { p_slug: tenant.slug, p_limit: 8 }).then((r) => r, () => ({ data: [] })),
  ])
  const failed = [cfg, cats, prods].find((r) => r.error)
  if (failed) throw failed.error

  const live = tenant.status === 'activo' && (!tenant.expires_at || new Date(tenant.expires_at) > new Date())
  const raw = { tenant, config: cfg.data, categories: cats.data, products: prods.data, zones: zones.data, faqs: faqs.data, popular: Array.isArray(pop?.data) ? pop.data : [] }
  // Si el negocio no está activo y aun así lo vemos, es su dueño (o el superadmin) en vista previa
  return { state: 'ok', preview: !live, raw, ...normalizeCatalog(raw) }
}
