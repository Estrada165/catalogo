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

export function normalizeCatalog({ tenant, config, categories, products, zones, faqs }) {
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
        tags: p.tags || [],
        badge: p.badge || null,
        featured: !!p.featured,
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
    catById,
    products: list,
    byId,
    variantById,
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

  const [cfg, cats, prods, zones, faqs] = await Promise.all([
    supabase.from('tenant_config').select('*').eq('tenant_id', tenant.id).maybeSingle(),
    supabase.from('categories').select('*').eq('tenant_id', tenant.id),
    supabase.from('products').select('*, product_variants(*)').eq('tenant_id', tenant.id),
    supabase.from('delivery_zones').select('*').eq('tenant_id', tenant.id),
    supabase.from('bot_faqs').select('*').eq('tenant_id', tenant.id),
  ])
  const failed = [cfg, cats, prods].find((r) => r.error)
  if (failed) throw failed.error

  const live = tenant.status === 'activo' && (!tenant.expires_at || new Date(tenant.expires_at) > new Date())
  const raw = { tenant, config: cfg.data, categories: cats.data, products: prods.data, zones: zones.data, faqs: faqs.data }
  // Si el negocio no está activo y aun así lo vemos, es su dueño (o el superadmin) en vista previa
  return { state: 'ok', preview: !live, raw, ...normalizeCatalog(raw) }
}
