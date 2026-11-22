import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Search, X, Moon, Sun, ShoppingBag, MessageCircle, Plus, ChevronRight, Clock, MapPin, Truck, Store,
  FileText, Check, Instagram, Facebook, Music2, Star, Eye, Wallet, Bot,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getSessionId } from '../lib/utils'
import { fetchCatalog, normalizeCatalog } from './lib/data'
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
import { StateScreen, LoadingScreen } from './components/StateScreens'
import './styles/tokens.css'
import './styles/catalog.css'
import './styles/products.css'

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
    const hay = norm([p.name, ...(p.tags || []), cat.catById[p.category_id]?.name, ...Object.values(p.attributes || {}), ...p.variants.map((v) => v.label)].join(' '))
    return words.every((w) => hay.includes(w))
  }
  const showCats = cat.sections.on('categories') && cat.categories.length > 1
  const grouped = showCats && !words.length && catId === 'all'
  const navCats = cat.categories.map((c) => ({ ...c, count: cat.products.filter((p) => p.category_id === c.id).length }))
  const groups = useMemo(() => {
    const g = cat.categories.map((c) => ({ id: c.id, name: c.name, items: cat.products.filter((p) => p.category_id === c.id) })).filter((x) => x.items.length)
    const rest = cat.products.filter((p) => !p.category_id)
    if (rest.length) g.push({ id: 'otros', name: 'Más productos', items: rest })
    return g
  }, [cat])
  const visible = cat.products.filter((p) => (catId === 'all' || p.category_id === catId) && matches(p))
  const summary = useMemo(() => summarize(lines, cat), [lines, cat])
  const qtyOf = (p) => (p.variants.length === 1 ? lines.find((l) => l.variantId === p.variants[0].id)?.qty || 0 : lines.filter((l) => p.variants.some((v) => v.id === l.variantId)).length)
  const inCart = (variantId) => lines.find((l) => l.variantId === variantId)?.qty || 0

  // La barra de categorías sigue al scroll cuando están agrupadas
  useEffect(() => {
    if (!grouped) return
    const els = [...document.querySelectorAll('[data-cat-section]')]
    if (!els.length) return
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setSpy(vis[0].target.dataset.catSection)
    }, { rootMargin: '-35% 0px -55% 0px' })
    els.forEach((el) => io.observe(el))
    const top = () => { if (scrollY < (document.getElementById('catalogo')?.offsetTop || 400) - 120) setSpy('all') }
    addEventListener('scroll', top, { passive: true })
    return () => { io.disconnect(); removeEventListener('scroll', top) }
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
    if (!preview) track(slug, 'product_view', p.id)
  }

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
  const art = cat.products.filter((p) => p.images?.length).slice(0, 9)
  const showFaq = cat.sections.on('faq') && cat.faqs.length > 0
  const policy = cat.sections.on('policies') ? cat.sections.props('policies') : null
  const policyItems = policy ? String(policy.text || '').split('\n').map((x) => x.trim()).filter(Boolean) : []
  const botReady = cat.bot.enabled
  const askHelp = () => {
    if (botReady) window.dispatchEvent(new CustomEvent('cat:open-bot'))
    else if (s.whatsapp) window.open(waLink(s.whatsapp, `👋 Hola, tengo una consulta sobre el catálogo de ${s.business_name}.`), '_blank', 'noopener')
  }
  const social = Object.entries(s.social || {}).filter(([, v]) => v)
  const SOCIAL_ICON = { instagram: Instagram, facebook: Facebook, tiktok: Music2 }
  const year = new Date().getFullYear()
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
            <ul className="info-chips">
              {deliveryOn && <li><Truck size={15} />{minZone === null ? 'Delivery' : minZone > 0 ? <>Delivery desde <b>{money(minZone, sym)}</b></> : <b>Delivery gratis</b>}</li>}
              {pickupOn && <li><Store size={15} />Recojo en tienda</li>}
              {s.address && (s.maps_url
                ? <li><a href={s.maps_url} target="_blank" rel="noopener noreferrer"><MapPin size={15} />{s.address}</a></li>
                : <li><MapPin size={15} />{s.address}</li>)}
              {hours[0] && cat.sections.on('hours') && <li><Clock size={15} />{hours.map((h) => `${h.label} ${h.time}`).join(' · ')}</li>}
              {cat.payment_methods.length > 0 && (
                <li className="info-chips__pay"><Wallet size={15} />
                  {cat.payment_methods.map((m, i) => m.logo_url ? <img key={i} src={m.logo_url} alt={m.name} title={m.name} /> : <span key={i}>{m.name}</span>)}
                </li>
              )}
              {s.whatsapp && (
                <li><a className="is-wa" href={waLink(s.whatsapp, `👋 Hola, tengo una consulta sobre el catálogo de ${s.business_name}.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} />Escríbenos</a></li>
              )}
            </ul>
          </div>
          {art.length >= 3 && (
            <div className="hero__art" aria-hidden="true">
              {art.map((p, i) => <img key={p.id} src={p.images[0].thumb || p.images[0].full} alt="" width="84" height="84" style={{ '--i': i }} />)}
            </div>
          )}
        </section>

        {featured.length > 0 && !words.length && (
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
                  <h2 className="section__title">{catId !== 'all' ? cat.catById[catId]?.name : 'Productos'}</h2>
                  <span className="count-pill tnum"><b>{visible.length}</b></span>
                </div>
              )}
              <div className="grid grid--pc">{visible.map((p, i) => card(p, i))}</div>
            </>
          ) : (
            <div className="empty">
              <b>{words.length ? `Nada con “${q.trim()}”` : 'Aún no hay productos aquí'}</b>
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
            </div>
          </div>
          <div className="foot2__bottom">
            <span className="foot2__id">
              {s.logo_url && <img src={s.logo_url} alt="" className={s.logo_shape === 'round' ? 'is-round' : ''} />}
              © {year} {s.business_name}
            </span>
            <span className="foot2__links">
              {policyItems.length > 0 && <button onClick={() => setPolicyOpen(true)}>{policy.title || 'Políticas'}</button>}
              {social.map(([k, url]) => {
                const Ic = SOCIAL_ICON[k] || ChevronRight
                return <a key={k} className="key key--icon key--sm" href={url} target="_blank" rel="noopener noreferrer" aria-label={k}><Ic size={16} /></a>
              })}
            </span>
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

      <ProductSheet p={detail} cat={cat} sym={sym} inCart={inCart} onClose={() => setDetail(null)}
        onAdd={(v, qty, el) => { add({ ...v, product: detail }, el, qty); toast(`${detail.name} en tu carrito`); setTimeout(() => setDetail(null), 120) }} />
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} summary={summary} cat={cat} sym={sym} dispatch={dispatch} slug={slug} toast={toast} preview={preview} />
      <Sheet open={policyOpen} onClose={() => setPolicyOpen(false)} title={policy?.title || 'Políticas y condiciones'}>
        <ul className="ticks">{policyItems.map((t, i) => <li key={i}><Check size={16} strokeWidth={2.6} />{t}</li>)}</ul>
      </Sheet>
      <LuChat cat={cat} slug={slug} sym={sym} preview={preview} hidden={cartOpen || !!detail} forceClose={cartOpen}
        onAdd={(v, el) => add(v, el)} onOpen={openDetail} onOpenCart={() => setCartOpen(true)} />
      {toastMsg && <div className="toast" role="status"><Check size={16} /> {toastMsg}</div>}
    </>
  )
}
