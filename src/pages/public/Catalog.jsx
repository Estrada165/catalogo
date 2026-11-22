import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, APP_NAME } from '../../lib/supabase'
import { formatPrice, getSessionId } from '../../lib/utils'
import ThemeToggle from '../../components/ThemeToggle'
import Loader from '../../components/Loader'

function track(slug, type, extra = {}) {
  supabase.rpc('track_event', {
    p_slug: slug,
    p_type: type,
    p_session: getSessionId(),
    p_product: extra.product || null,
    p_meta: extra.meta || {},
  })
}

export default function Catalog() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading' })
  const [activeCat, setActiveCat] = useState('all')

  useEffect(() => {
    let alive = true

    async function load() {
      setState({ status: 'loading' })
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, slug, name, status')
        .eq('slug', slug.toLowerCase())
        .eq('status', 'activo')
        .maybeSingle()

      if (!tenant) {
        const { data: current } = await supabase.rpc('resolve_slug', { p_slug: slug })
        if (current && current !== slug.toLowerCase()) {
          navigate(`/${current}${window.location.search}`, { replace: true })
          return
        }
        if (alive) setState({ status: 'unavailable' })
        return
      }

      const [{ data: config }, { data: categories }, { data: products }] = await Promise.all([
        supabase.from('tenant_config').select('*').eq('tenant_id', tenant.id).maybeSingle(),
        supabase.from('categories').select('*').eq('tenant_id', tenant.id).order('sort'),
        supabase
          .from('products')
          .select('*, product_variants(*)')
          .eq('tenant_id', tenant.id)
          .order('sort')
          .order('sort', { referencedTable: 'product_variants' }),
      ])

      if (!alive) return
      setState({ status: 'ready', tenant, config: config || {}, categories: categories || [], products: products || [] })
      track(tenant.slug, params.get('src') === 'qr' ? 'qr_scan' : 'visit')
    }

    load()
    return () => {
      alive = false
    }
  }, [slug])

  const sections = useMemo(() => {
    const list = state.config?.sections || []
    return [...list].filter((s) => s.enabled).sort((a, b) => a.order - b.order)
  }, [state.config])

  if (state.status === 'loading') return <Loader full />

  if (state.status === 'unavailable') {
    return (
      <div className="center-screen">
        <div className="card card--narrow">
          <h1 className="display">Catálogo no disponible</h1>
          <p className="muted">Este enlace no existe o el catálogo no está activo en este momento.</p>
        </div>
      </div>
    )
  }

  const { tenant, config, categories, products } = state
  const business = config.business || {}
  const accent = config.theme?.accent
  const shown = activeCat === 'all' ? products : products.filter((p) => p.category_id === activeCat)
  const usedCats = categories.filter((c) => products.some((p) => p.category_id === c.id))

  const renderSection = (s) => {
    switch (s.type) {
      case 'hero':
        return (
          <section key={s.id} className="cat-hero">
            {business.logo && <img className="cat-hero__logo" src={business.logo} alt={tenant.name} />}
            <h1 className="display">{business.name || tenant.name}</h1>
            {business.description && <p className="muted">{business.description}</p>}
          </section>
        )
      case 'categories':
        return usedCats.length > 0 ? (
          <nav key={s.id} className="cat-chips">
            <button className={activeCat === 'all' ? 'is-active' : ''} onClick={() => setActiveCat('all')}>Todo</button>
            {usedCats.map((c) => (
              <button key={c.id} className={activeCat === c.id ? 'is-active' : ''} onClick={() => setActiveCat(c.id)}>
                {c.name}
              </button>
            ))}
          </nav>
        ) : null
      case 'featured': {
        const featured = products.filter((p) => p.featured)
        if (!featured.length) return null
        return (
          <section key={s.id} className="cat-section">
            <h2 className="display">{s.props?.title || 'Destacados'}</h2>
            <div className="product-grid">{featured.map((p) => <ProductCard key={p.id} product={p} slug={tenant.slug} />)}</div>
          </section>
        )
      }
      case 'products':
        return (
          <section key={s.id} className="cat-section">
            {shown.length === 0 ? (
              <div className="card empty"><p>Pronto verás aquí nuestros productos.</p></div>
            ) : (
              <div className="product-grid">{shown.map((p) => <ProductCard key={p.id} product={p} slug={tenant.slug} />)}</div>
            )}
          </section>
        )
      default:
        return null
    }
  }

  return (
    <div className="catalog" style={accent ? { '--accent': accent } : undefined}>
      <header className="catalog__bar">
        <span className="brand">{business.name || tenant.name}</span>
        <ThemeToggle />
      </header>
      <main className="catalog__main">{sections.map(renderSection)}</main>
      <footer className="catalog__foot">
        <small className="muted">Catálogo creado con {APP_NAME}</small>
      </footer>
    </div>
  )
}

function ProductCard({ product, slug }) {
  const variants = (product.product_variants || []).filter((v) => v.visible)
  const prices = variants.map((v) => v.price).filter((v) => v !== null)
  const from = prices.length ? Math.min(...prices) : null
  const img = product.images?.[0]

  return (
    <article className="product-card" onClick={() => track(slug, 'product_view', { product: product.id })}>
      <div className="product-card__media">
        {img ? <img src={img.thumb || img.full} alt={product.name} loading="lazy" /> : <div className="product-card__placeholder" />}
        {product.badge && <span className="product-card__badge">{product.badge}</span>}
      </div>
      <div className="product-card__body">
        <h3>{product.name}</h3>
        <p className="product-card__price">
          {variants.length > 1 && from !== null ? 'Desde ' : ''}
          {formatPrice(from)}
        </p>
      </div>
    </article>
  )
}
