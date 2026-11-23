import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Search, X, Moon, Sun, ShoppingBag, MessageCircle, Plus, ChevronRight, Clock, MapPin, Truck, Store,
  FileText, Check, Instagram, Facebook, Music2, Star, Eye, Wallet, Bot, Flame, Info, MousePointerClick, SlidersHorizontal, ArrowUpDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getSessionId } from '../lib/utils'
import { fetchCatalog, normalizeCatalog, facetValue, fold } from './lib/data'
import { cartReducer, summarize, waLink } from './lib/cart'
import { money, store } from './lib/format'
import { applyPalette } from './lib/color'
import { applyFonts } from './lib/fonts'
import { switchTheme, flyPlane, bump, haptic } from './lib/motion'
import { openStatus, hoursRows } from './lib/hours'
import { norm } from './lib/bot'
import CategoryNav from './components/CategoryNav'
import ProductCard, { priceInfo } from './components/ProductCard'
import ProductSheet from './components/ProductSheet'
import CartSheet from './components/CartSheet'
import LuChat from './components/LuChat'
import Sheet from './components/Sheet'
import InfoSheet from './components/InfoSheet'
import { StateScreen, LoadingScreen } from './components/StateScreens'
import './styles/tokens.css'
import './styles/catalog.css'
import './styles/products.css'

const SORTS = [
  { key: 'default', label: 'Recomendados' },
  { key: 'price_asc', label: 'Menor precio' },
  { key: 'price_desc', label: 'Mayor precio' },
  { key: 'new', label: 'Más nuevos' },
  { key: 'name', label: 'Nombre (A–Z)' },
]

function track(slug, type, product = null, meta = {}) {
  supabase.rpc('track_event', { p_slug: slug, p_type: type, p_session: getSessionId(), p_product: product, p_meta: meta })
}

export default function CatalogPage() {
  const { slug: rawSlug } = useParams()
  const slug = String(rawSlug || '').toLowerCase()
  const navigate = useNavigate()
  const [cat, setCat] = useState(undefined)

  useEffect(() => {
    let alive = true
    setCat(undefined)
    fetchCatalog(slug)
      .then((d) => {
        if (!alive) return
        if (d?.state === 'moved') navigate(`/${d.slug}${location.search}`, { replace: true })
        else setCat(d)
      })
      .catch(() => alive && setCat({ state: 'error' }))
    return () => { alive = false }
  }, [slug, navigate])

  // Vista previa del panel: recibe los cambios sin guardar por postMessage
  const embedded = useMemo(() => new URLSearchParams(location.search).has('preview') && window.parent !== window, [])
  const [draft, setDraft] = useState(null)
  useEffect(() => {
    if (!embedded) return
    const on = (e) => { if (e.origin === location.origin && e.data?.type === 'cat:preview') setDraft(e.data) }
    addEventListener('message', on)
    window.parent.postMessage({ type: 'cat:preview-ready' }, location.origin)
    return () => removeEventListener('message', on)
  }, [embedded, cat?.state])
  const shown = useMemo(() => {
    if (!draft || cat?.state !== 'ok') return cat
    const config = { ...(cat.raw.config || {}), theme: draft.theme, sections: draft.sections, modules: draft.modules }
    return { ...cat, ...normalizeCatalog({ ...cat.raw, config }) }
  }, [cat, draft])

  if (cat === undefined) return <LoadingScreen />
  if (cat === null) return <StateScreen title="No encontramos este catálogo" text="Revisa el enlace o pide uno nuevo a quien te lo compartió." />
  if (cat.state === 'error') return <StateScreen title="No pudimos cargar el catálogo" text="Revisa tu conexión e inténtalo de nuevo." retry />
  return <Catalog cat={shown} slug={slug} embedded={embedded} forcedMode={draft?.mode} />
}

function Catalog({ cat, slug, embedded = false, forcedMode = null }) {
  const s = cat.settings
  const sym = s.currency_symbol
  const preview = cat.preview || embedded
  const [catId, setCatId] = useState('all')
  const [spy, setSpy] = useState('all')
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [howOpen, setHowOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sort, setSort] = useState('default')
  const [picked, setPicked] = useState({}) // { marca: ['stanley', ...] }
  const [range, setRange] = useState({ min: '', max: '' })
  const [toastMsg, setToastMsg] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [theme, setTheme] = useState(() => {
    const saved = store.get(`cat-theme:${slug}`)
    if (saved === 'light' || saved === 'dark') return saved
    if (s.theme_default === 'system') return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    return s.theme_default
  })
  const [lines, dispatch] = useReducer(cartReducer, [], () => store.get(`cat-cart:${slug}`, []))
  const cartBtn = useRef(null)
  const cartBarBtn = useRef(null)
  const themeBtn = useRef(null)

  // Marca, color, tipografía
  useEffect(() => {
    const root = document.documentElement
    applyPalette(root, s.accent)
    root.style.setProperty('--r', `${s.radius}px`)
    root.dataset.cards = s.card_style
    applyFonts({ display: s.font_display, body: s.font_body, cards: s.font_cards })
    document.title = s.tagline ? `${s.business_name} · ${s.tagline}` : s.business_name
    if (s.logo_url) {
      let ic = document.querySelector('link[rel="icon"]')
      if (!ic) { ic = document.createElement('link'); ic.rel = 'icon'; document.head.appendChild(ic) }
      ic.href = s.logo_url
    }
  }, [s])
  useEffect(() => { if (forcedMode === 'light' || forcedMode === 'dark') setTheme(forcedMode) }, [forcedMode])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d0e11' : '#f4f5f7')
  }, [theme])
  useEffect(() => { if (!embedded) store.set(`cat-cart:${slug}`, lines) }, [lines, slug, embedded])
  useEffect(() => { dispatch({ type: 'sync', variantById: cat.variantById }) }, [cat])
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 120)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => {
    if (preview) return
    track(slug, new URLSearchParams(location.search).get('src') === 'qr' ? 'qr_scan' : 'visit')
  }, [slug, preview])

  const toast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toast.t)
    toast.t = setTimeout(() => setToastMsg(null), 1900)
  }, [])

  // Búsqueda
  const words = norm(q).split(' ').filter(Boolean)
  const matches = (p) => {
    if (!words.length) return true
    const hay = norm([p.name, ...(p.tags || []), cat.catById[p.category_id]?.name, ...Object.values(p.attributes || {}), ...p.variants.map((v) => v.label), ...p.details.flatMap((d) => d.items)].join(' '))
    return words.every((w) => hay.includes(w))
  }
  const groups = useMemo(() => {
    const g = cat.categories.map((c) => ({ id: c.id, name: c.name, items: cat.products.filter((p) => p.category_id === c.id) })).filter((x) => x.items.length)
    const rest = cat.products.filter((p) => !p.category_id)
    if (rest.length && g.length) g.push({ id: 'otros', name: 'Otros', items: rest })
    return g
  }, [cat])
  // La barra aparece apenas haya una categoría con productos; lo que no tiene categoría va a "Otros"
  const showCats = cat.sections.on('categories') && groups.length > 0
  const navCats = groups.map((g) => ({ id: g.id, name: g.name, count: g.items.length }))
  const inCat = (p, id) => id === 'all' || (id === 'otros' ? !p.category_id : p.category_id === id)
  // Filtros y orden (sirven para cualquier rubro: salen de precios y características)
  const priceOf = (p) => priceInfo(p).price
  const facetOk = (p) => Object.entries(picked).every(([k, vals]) => !vals.length || vals.includes(facetValue(p, k)))
  const pMin = range.min === '' ? null : Number(range.min)
  const pMax = range.max === '' ? null : Number(range.max)
  const priceOk = (p) => (pMin === null && pMax === null) || (priceOf(p) !== null && (pMin === null || priceOf(p) >= pMin) && (pMax === null || priceOf(p) <= pMax))
  const activeFilters = Object.values(picked).reduce((n, v) => n + v.length, 0) + (pMin !== null || pMax !== null ? 1 : 0)
  const filtering = activeFilters > 0 || sort !== 'default'
  const sortList = (arr) => {
    if (sort === 'default') return arr
    const nul = (a, b, f) => (f(a) === null) - (f(b) === null)
    const by = {
      price_asc: (a, b) => nul(a, b, priceOf) || priceOf(a) - priceOf(b),
      price_desc: (a, b) => nul(a, b, priceOf) || priceOf(b) - priceOf(a),
      new: (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')),
      name: (a, b) => a.name.localeCompare(b.name, 'es'),
    }[sort]
    return [...arr].sort((a, b) => (a.soldOut - b.soldOut) || by(a, b))
  }
  const visible = sortList(cat.products.filter((p) => inCat(p, catId) && matches(p) && facetOk(p) && priceOk(p)))
  const prices = cat.products.map(priceOf).filter((x) => x !== null)
  const showTools = cat.products.length >= 2
  const clearFilters = () => { setPicked({}); setRange({ min: '', max: '' }); setSort('default') }
  const togglePick = (key, val) => setPicked((cur) => {
    const list = cur[key] || []
    return { ...cur, [key]: list.includes(val) ? list.filter((x) => x !== val) : [...list, val] }
  })
  const grouped = showCats && !words.length && catId === 'all' && activeFilters === 0 && sort === 'default'
  const groupName = (id) => groups.find((g) => g.id === id)?.name || 'Productos'
  const summary = useMemo(() => summarize(lines, cat), [lines, cat])
  const qtyOf = (p) => (p.variants.length === 1 ? lines.find((l) => l.variantId === p.variants[0].id)?.qty || 0 : lines.filter((l) => p.variants.some((v) => v.id === l.variantId)).length)
  const inCart = (variantId) => lines.find((l) => l.variantId === variantId)?.qty || 0

  // La barra de categorías sigue al scroll cuando están agrupadas
  useEffect(() => {
    if (!grouped) return
    const els = [...document.querySelectorAll('[data-cat-section]')]
    if (!els.length) return
    // Marca la última sección cuyo inicio ya pasó el 40% de la pantalla; si ninguna, "Todo"
    let raf = 0
    const calc = () => {
      raf = 0
      const line = innerHeight * 0.4
      let cur = 'all'
      for (const el of els) if (el.getBoundingClientRect().top <= line) cur = el.dataset.catSection
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 60) {
        const last = els[els.length - 1]
        if (last.getBoundingClientRect().top < innerHeight) cur = last.dataset.catSection
      }
      setSpy(cur)
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(calc) }
    addEventListener('scroll', on, { passive: true })
    calc()
    return () => { removeEventListener('scroll', on); cancelAnimationFrame(raf) }
  }, [grouped, groups.length])

  const cartTarget = () => (cartBarBtn.current?.offsetParent ? cartBarBtn.current : cartBtn.current)
  const land = () => { bump(cartTarget()); haptic() }
  const add = (v, fromEl, qty) => {
    if (v.max !== null && inCart(v.id) >= v.max) { toast('No hay más stock'); return }
    dispatch({ type: 'add', variant: v, qty })
    flyPlane(fromEl, cartTarget(), land)
    if (!preview) track(slug, 'add_cart', v.product?.id || null)
  }
  const openDetail = (p) => {
    setDetail(p)
    if (!embedded) history.replaceState(history.state, '', `${location.pathname}?p=${p.id}${cat.preview ? '&preview=1' : ''}`)
    if (!preview) track(slug, 'product_view', p.id)
  }
  const closeDetail = () => {
    setDetail(null)
    if (!embedded && new URLSearchParams(location.search).has('p')) {
      const qs = new URLSearchParams(location.search)
      qs.delete('p')
      history.replaceState(history.state, '', `${location.pathname}${qs.toString() ? `?${qs}` : ''}`)
    }
  }
  // Enlace directo a un producto: /negocio?p=ID
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('p')
    if (id && cat.byId[id]) setDetail(cat.byId[id])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    switchTheme(next, themeBtn.current, (t) => { document.documentElement.dataset.theme = t; setTheme(t) })
    store.set(`cat-theme:${slug}`, next)
  }

  const goTo = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return
    const off = (document.querySelector('.top')?.offsetHeight || 60) + (document.querySelector('.ctrl')?.offsetHeight || 0) + 6
    scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - off), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  const pickCat = (id) => {
    haptic(8)
    if (words.length) setQ('')
    if (grouped || (id !== 'all' && catId === 'all' && showCats)) {
      setCatId('all')
      setSpy(id)
      setTimeout(() => goTo(id === 'all' ? '#catalogo-grid' : `[data-cat-section="${id}"]`), 30)
    } else setCatId(id)
  }

  const status = openStatus(s.hours)
  const hours = hoursRows(s.hours)
  const deliveryOn = cat.modules.delivery !== false && cat.checkout?.allow_delivery !== false
  const pickupOn = cat.checkout?.allow_pickup !== false
  const featured = cat.sections.on('featured') ? cat.products.filter((p) => p.featured && !p.soldOut).slice(0, 10) : []
  // Lo más pedido: pedidos reales; si aún no hay y los destacados están apagados, se muestran los destacados
  const popular = cat.sections.on('popular') ? cat.popular.slice(0, 6) : []
  const picks = popular.length >= 2
    ? { label: 'Lo más pedido', items: popular }
    : !featured.length && cat.sections.on('popular')
      ? { label: 'Recomendados', items: cat.products.filter((p) => p.featured && !p.soldOut).slice(0, 6) }
      : null
  const art = cat.products.filter((p) => p.images?.length).slice(0, 9)
  const showFaq = cat.sections.on('faq') && cat.faqs.length > 0
  const policy = cat.sections.on('policies') ? cat.sections.props('policies') : null
  const policyItems = policy ? String(policy.text || '').split('\n').map((x) => x.trim()).filter(Boolean) : []
  const botReady = cat.bot.enabled
  const askHelp = () => {
    if (botReady) window.dispatchEvent(new CustomEvent('cat:open-bot'))
    else if (s.whatsapp) window.open(waLink(s.whatsapp, `👋 Hola, tengo una consulta sobre el catálogo de ${s.business_name}.`), '_blank', 'noopener')
  }
  const social = cat.sections.on('social') ? Object.entries(s.social || {}).filter(([, v]) => v) : []
  const SOCIAL_ICON = { instagram: Instagram, facebook: Facebook, tiktok: Music2 }
  const showAddress = cat.sections.on('location') && !!s.address
  const showHours = cat.sections.on('hours') && hours.length > 0
  const hasInfo = showAddress || showHours || deliveryOn || pickupOn || cat.payment_methods.length > 0
  const payNames = cat.payment_methods.map((m) => m.name)
  const howSteps = [
    'Busca lo que necesitas y toca el producto para ver fotos, opciones y detalles.',
    'Agrégalo al carrito y elige la cantidad.',
    deliveryOn && pickupOn ? 'Elige delivery o recojo en tienda y completa tus datos.'
      : deliveryOn ? 'Elige tu zona de delivery y completa tus datos.'
        : pickupOn ? 'Indica que recogerás en tienda y completa tus datos.' : 'Completa tus datos.',
    'Envía tu pedido: se abre WhatsApp con todo el detalle listo para enviar.',
    payNames.length ? `Coordinamos el pago (${payNames.join(', ')}) y te confirmamos.` : 'Te respondemos para confirmar tu pedido.',
  ]
  const minZone = cat.zones.length ? Math.min(...cat.zones.map((z) => Number(z.cost) || 0)) : null
  const catName = (p) => cat.catById[p.category_id]?.name

  const card = (p, i, wide = false) => (
    <ProductCard key={p.id} p={p} index={i} qty={qtyOf(p)} sym={sym} wide={wide} category={wide || !grouped ? catName(p) : null}
      onOpen={openDetail} onAdd={(v, el) => add({ ...v, product: p }, el)} onDec={(v) => dispatch({ type: 'dec', variant: v })} />
  )

  return (
    <>
      {cat.preview && !embedded && (
        <div className="preview-bar"><Eye size={15} /> Vista previa: este catálogo aún no es visible al público.</div>
      )}
      <header className={`top${scrolled ? ' is-scrolled' : ''}`}>
        <div className="wrap top__in">
          <a className="top__brand" href="#top" aria-label={`${s.business_name}, ir al inicio`}>
            {s.logo_url && <img className={`top__logo${s.logo_shape === 'round' ? ' is-round' : ''}`} src={s.logo_url} alt="" width="36" height="36" />}
            <span className="top__name">{s.business_name}</span>
          </a>
          <div className="top__actions">
            <button ref={themeBtn} className="key key--icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button ref={cartBtn} className="key key--icon has-badge" onClick={() => setCartOpen(true)} aria-label={`Carrito, ${summary.count} productos`}>
              <ShoppingBag size={19} />{summary.count > 0 && <span className="badge-dot tnum">{summary.count}</span>}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <div className={`hero-wrap${s.cover.mode !== 'none' ? ` has-cover cover-${s.cover.mode}` : ''}`}>
        {s.cover.mode === 'image' && (
          <div className={`cover cover--img is-${s.cover.focus}${s.cover.blur ? ' is-blur' : ''}`} style={{ '--cover-op': s.cover.strength / 100 }} aria-hidden="true">
            <img src={s.cover.image} alt="" fetchpriority="high" decoding="async" />
          </div>
        )}
        {s.cover.mode === 'gradient' && (
          <div className={`cover cover--grad is-${s.cover.shape}`} style={{ '--c1': s.cover.color1, '--c2': s.cover.color2, '--cover-op': s.cover.strength / 100 }} aria-hidden="true" />
        )}
        <section className="hero hero2 wrap">
          <div className="hero__main">
            <div className="hero2__id">
              {s.logo_url ? (
                <img className={`hero2__logo${s.logo_shape === 'round' ? ' is-round' : ''}`} src={s.logo_url} alt={s.business_name} />
              ) : (
                <span className="hero2__logo hero2__logo--initial">{s.business_name.slice(0, 1)}</span>
              )}
              {status && (
                <p className={`hero__place${status.open ? '' : ' is-closed'}`}>
                  <span className={`hero__live${status.open ? '' : ' is-closed'}`} aria-hidden="true" />
                  {status.label}
                </p>
              )}
            </div>
            <h1 className="hero__title"><span>{s.business_name}</span></h1>
            {(s.tagline || s.description) && <p className="hero__tag">{s.tagline || s.description}</p>}
            <div className="hero__row">
              <div className="search" role="search">
                <Search size={19} />
                <label className="sr-only" htmlFor="q">Buscar producto</label>
                <input id="q" type="search" value={q} onChange={(e) => { setQ(e.target.value); setCatId('all') }} placeholder={`Buscar en ${s.business_name}`} autoComplete="off" enterKeyHint="search"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); goTo('#catalogo-grid') } }} />
                {q && <button className="search__clear" onClick={() => setQ('')} aria-label="Borrar búsqueda"><X size={18} /></button>}
              </div>
            </div>
            <ul className="meta meta2">
              {deliveryOn && <li><Truck size={15} /><span>{minZone === null ? 'Delivery' : minZone > 0 ? <>Delivery desde <b>{money(minZone, sym)}</b></> : <b>Delivery gratis</b>}</span></li>}
              {pickupOn && <li><Store size={15} /><span>Recojo en tienda</span></li>}
              {cat.payment_methods.length > 0 && (
                <li className="meta2__pay"><Wallet size={15} />
                  <span>{cat.payment_methods.slice(0, 4).map((m, i) => m.logo_url ? <img key={i} src={m.logo_url} alt={m.name} title={m.name} /> : <em key={i}>{m.name}</em>)}</span>
                </li>
              )}
              {cat.sections.on('howto') && <li><button className="meta__link" onClick={() => setHowOpen(true)}><MousePointerClick size={15} /> ¿Cómo comprar?</button></li>}
              {hasInfo && <li><button className="meta__link" onClick={() => setInfoOpen(true)}><Info size={15} /> {showAddress ? 'Dirección y horario' : 'Información'}</button></li>}
              {s.whatsapp && (
                <li><a className="meta__link is-wa" href={waLink(s.whatsapp, `👋 Hola, tengo una consulta sobre el catálogo de ${s.business_name}.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Escríbenos</a></li>
              )}
            </ul>
            {picks && picks.items.length >= 2 && !words.length && (
              <div className="picks">
                <span className="picks__lbl"><Flame size={14} /> {picks.label}</span>
                <div className="picks__row">
                  {picks.items.map((p) => {
                    const pi = priceInfo(p)
                    const im = p.images?.[0]
                    return (
                      <button key={p.id} className="pick" onClick={() => openDetail(p)} aria-label={`Ver ${p.name}`}>
                        {im ? <img src={im.thumb || im.full} alt="" width="30" height="30" /> : <span className="pick__ph">{p.name.slice(0, 1)}</span>}
                        <span className="pick__name">{p.name}</span>
                        {pi.price !== null && <b className="tnum">{money(pi.price, sym)}</b>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          {art.length >= 3 && s.cover.mode !== 'image' && (
            <div className="hero__art" aria-hidden="true">
              {art.map((p, i) => <img key={p.id} src={p.images[0].thumb || p.images[0].full} alt="" width="84" height="84" style={{ '--i': i }} />)}
            </div>
          )}
        </section>
        </div>

        {featured.length > 0 && !words.length && !filtering && (
          <section className="section wrap feat" aria-labelledby="feat-title">
            <div className="section__head">
              <h2 className="section__title" id="feat-title"><Star size={20} className="section__icon" /> Destacados</h2>
            </div>
            <div className="feat__row">{featured.map((p, i) => card(p, i, true))}</div>
          </section>
        )}

        {showCats && (
          <div className="ctrl" id="catalogo">
            <div className="wrap ctrl__in">
              <CategoryNav cats={navCats} total={cat.products.length} active={grouped ? spy : catId} onPick={pickCat} />
            </div>
          </div>
        )}

        {showTools && (
          <div className="wrap tools">
            <label className="tools__sort">
              <ArrowUpDown size={15} />
              <span className="sr-only">Ordenar</span>
              <select value={sort} onChange={(e) => { setSort(e.target.value); haptic(8) }}>
                {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
            <button className={`tools__btn${activeFilters ? ' is-on' : ''}`} onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal size={15} /> Filtros{activeFilters > 0 && <em className="tnum">{activeFilters}</em>}
            </button>
            <div className="tools__chips">
              {Object.entries(picked).flatMap(([k, vals]) => vals.map((v) => {
                const f = cat.facets.find((x) => x.key === k)
                const label = f?.values.find((x) => fold(x.value) === v)?.value || v
                return <button key={k + v} className="tools__chip" onClick={() => togglePick(k, v)}>{label} <X size={13} /></button>
              }))}
              {(pMin !== null || pMax !== null) && (
                <button className="tools__chip" onClick={() => setRange({ min: '', max: '' })}>
                  {pMin !== null && pMax !== null ? `${money(pMin, sym)} – ${money(pMax, sym)}` : pMin !== null ? `Desde ${money(pMin, sym)}` : `Hasta ${money(pMax, sym)}`} <X size={13} />
                </button>
              )}
              {filtering && <button className="link-btn tools__clear" onClick={clearFilters}>Limpiar</button>}
            </div>
          </div>
        )}

        <section className="section wrap" id="catalogo-grid" aria-label="Productos">
          {words.length > 0 && (
            <div className="section__head">
              <h2 className="section__title">Resultados</h2>
              <span className="count-pill tnum"><b>{visible.length}</b> {visible.length === 1 ? 'producto' : 'productos'}</span>
            </div>
          )}
          {grouped ? (
            groups.map((g, gi) => (
              <div key={g.id} className="cat-block" data-cat-section={g.id}>
                <div className="section__head">
                  <h2 className="section__title">{g.name}</h2>
                  <span className="count-pill tnum"><b>{g.items.length}</b></span>
                </div>
                <div className="grid grid--pc">{g.items.map((p, i) => card(p, gi * 4 + i))}</div>
              </div>
            ))
          ) : visible.length ? (
            <>
              {!words.length && (
                <div className="section__head">
                  <h2 className="section__title">{catId !== 'all' ? groupName(catId) : 'Productos'}</h2>
                  <span className="count-pill tnum"><b>{visible.length}</b></span>
                </div>
              )}
              <div className="grid grid--pc">{visible.map((p, i) => card(p, i))}</div>
            </>
          ) : (
            <div className="empty">
              <b>{words.length ? `Nada con “${q.trim()}”` : activeFilters ? 'Ningún producto con esos filtros' : 'Aún no hay productos aquí'}</b>
              {activeFilters > 0 && !words.length && <button className="link-btn" onClick={clearFilters}>Quitar filtros</button>}
              {words.length > 0 && botReady ? (
                <>Pregúntale a <button className="link-btn" onClick={askHelp}>{cat.bot.name}</button> o escríbenos.</>
              ) : words.length > 0 && s.whatsapp ? (
                <>¿No lo ves? <a className="link-btn" href={waLink(s.whatsapp, `👋 Hola, ¿tienen ${q.trim()}?`)} target="_blank" rel="noopener noreferrer">Pregúntanos por WhatsApp</a>.</>
              ) : null}
            </div>
          )}
        </section>

        {(showFaq || policyItems.length > 0) && (
          <section className="section wrap" id="preguntas" aria-labelledby="faq-title">
            <div className="section__head"><h2 className="section__title" id="faq-title">Preguntas frecuentes</h2></div>
            <div className="faq">
              {showFaq && cat.faqs.map((f) => (
                <details key={f.id}><summary>{f.question}<Plus size={18} /></summary><p>{f.answer}</p></details>
              ))}
              {policyItems.length > 0 && (
                <button className="key" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => setPolicyOpen(true)}>
                  <FileText size={17} /> {policy.title || 'Políticas y condiciones'} <ChevronRight size={16} />
                </button>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="foot foot2">
        <div className="wrap">
          <div className="foot__cta">
            <div>
              <h2>¿Tienes alguna duda?</h2>
              <p>{botReady ? `${cat.bot.name} te responde al instante, o escríbenos directo.` : 'Escríbenos y te ayudamos con tu pedido.'}</p>
            </div>
            <div className="foot__cta-btns">
              {botReady && <button className="key key--lg" onClick={askHelp}><Bot size={18} /> Preguntarle a {cat.bot.name}</button>}
              {s.whatsapp && <a className="key key--wa key--lg" href={waLink(s.whatsapp, `👋 Hola, tengo una consulta sobre el catálogo de ${s.business_name}.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> WhatsApp</a>}
              {social.map(([k, url]) => {
                const Ic = SOCIAL_ICON[k] || ChevronRight
                return <a key={k} className="key key--icon" href={url} target="_blank" rel="noopener noreferrer" aria-label={k}><Ic size={18} /></a>
              })}
            </div>
          </div>
        </div>
        <div className="bar-space" />
      </footer>

      {summary.count > 0 && !cartOpen && (
        <button className="cart-bar" ref={cartBarBtn} onClick={() => setCartOpen(true)} aria-label="Ver carrito">
          <span className="cart-bar__count tnum">{summary.count}</span>
          <span className="cart-bar__txt">
            <small>Tu pedido</small>
            <b className="tnum">{summary.subtotal > 0 ? money(summary.subtotal, sym) : 'A consultar'}</b>
          </span>
          <span className="key key--accent key--sm">Ver carrito <ChevronRight size={16} /></span>
        </button>
      )}

      <ProductSheet p={detail} cat={cat} sym={sym} slug={slug} inCart={inCart} onClose={closeDetail} toast={toast}
        onAdd={(v, qty, el) => { add({ ...v, product: detail }, el, qty); toast(`${detail.name} en tu carrito`); setTimeout(closeDetail, 120) }} />
      <InfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} cat={cat} sym={sym} status={status} hours={hours}
        deliveryOn={deliveryOn} pickupOn={pickupOn} showAddress={showAddress} showHours={showHours} showSocial={social.length > 0} />
      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Ordenar y filtrar"
        footer={(
          <div className="filters-foot">
            <button className="key key--lg" onClick={clearFilters} disabled={!filtering}>Limpiar</button>
            <button className="key key--accent key--lg" onClick={() => { setFiltersOpen(false); setTimeout(() => goTo('.tools'), 200) }}>
              Ver {visible.length} {visible.length === 1 ? 'producto' : 'productos'}
            </button>
          </div>
        )}>
        <div className="flt">
          <section>
            <h4>Ordenar por</h4>
            <div className="flt__chips">
              {SORTS.map((o) => <button key={o.key} aria-pressed={sort === o.key} onClick={() => setSort(o.key)}>{o.label}</button>)}
            </div>
          </section>
          {prices.length >= 2 && (
            <section>
              <h4>Precio</h4>
              <div className="flt__range">
                <label><span>Desde</span><input inputMode="decimal" placeholder={money(Math.floor(Math.min(...prices)), sym)} value={range.min} onChange={(e) => setRange((r) => ({ ...r, min: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
                <span aria-hidden="true">—</span>
                <label><span>Hasta</span><input inputMode="decimal" placeholder={money(Math.ceil(Math.max(...prices)), sym)} value={range.max} onChange={(e) => setRange((r) => ({ ...r, max: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
              </div>
            </section>
          )}
          {cat.facets.map((f) => (
            <section key={f.key}>
              <h4>{f.label}</h4>
              <div className="flt__chips">
                {f.values.map((v) => {
                  const vk = fold(v.value)
                  const on = (picked[f.key] || []).includes(vk)
                  return <button key={vk} aria-pressed={on} onClick={() => togglePick(f.key, vk)}>{v.value} <em className="tnum">{v.count}</em></button>
                })}
              </div>
            </section>
          ))}
        </div>
      </Sheet>
      <Sheet open={howOpen} onClose={() => setHowOpen(false)} title="¿Cómo comprar?"
        footer={<button className="key key--accent key--block key--lg" onClick={() => { setHowOpen(false); setTimeout(() => goTo('#catalogo-grid'), 250) }}>Ver productos <ChevronRight size={17} /></button>}>
        <ol className="how">{howSteps.map((t, i) => <li key={i}><span className="tnum">{i + 1}</span><p>{t}</p></li>)}</ol>
      </Sheet>
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} summary={summary} cat={cat} sym={sym} dispatch={dispatch} slug={slug} toast={toast} preview={preview} />
      <Sheet open={policyOpen} onClose={() => setPolicyOpen(false)} title={policy?.title || 'Políticas y condiciones'}>
        <ul className="ticks">{policyItems.map((t, i) => <li key={i}><Check size={16} strokeWidth={2.6} />{t}</li>)}</ul>
      </Sheet>
      <LuChat cat={cat} slug={slug} sym={sym} preview={preview} hidden={cartOpen || !!detail} forceClose={cartOpen}
        onAdd={(v, el) => add(v, el)} onOpen={openDetail} onOpenCart={() => setCartOpen(true)}
        onSearch={(text) => { clearFilters(); setCatId('all'); setQ(text); setTimeout(() => goTo('#catalogo-grid'), 280) }}
        onCategory={(id) => { clearFilters(); setTimeout(() => pickCat(id), 280) }} />
      {toastMsg && <div className="toast" role="status"><Check size={16} /> {toastMsg}</div>}
    </>
  )
}
