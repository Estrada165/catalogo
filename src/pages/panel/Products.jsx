import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatPrice } from '../../lib/utils'
import { removeImages } from '../../lib/images'
import Loader from '../../components/Loader'
import Switch from '../../components/Switch'
import ProductEditor from './ProductEditor'
import Categories from './Categories'
import { IconEdit, IconPlus, IconSearch, IconTrash, IconStar } from '../../components/icons'
import Dropdown from '../../components/Dropdown'

function priceRange(variants) {
  const prices = variants.map((v) => v.price).filter((p) => p !== null)
  if (!prices.length) return 'A consultar'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`
}

function stockLabel(variants) {
  const tracked = variants.filter((v) => v.stock !== null)
  if (!tracked.length) return null
  const total = tracked.reduce((s, v) => s + Number(v.stock), 0)
  if (total <= 0) return { text: 'Agotado', tone: 'error' }
  if (tracked.some((v) => Number(v.stock) <= 0)) return { text: `${total} en stock · variantes agotadas`, tone: 'warn' }
  return { text: `${total} en stock`, tone: 'muted' }
}

export default function Products() {
  const { tenant } = useAuth()
  const { config } = useOutletContext()
  const modules = config?.modules || {}

  const [tab, setTab] = useState('productos')
  const [products, setProducts] = useState(null)
  const [categories, setCategories] = useState([])
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: cats }, { data: prods, error: err }] = await Promise.all([
      supabase.from('categories').select('*').eq('tenant_id', tenant.id).order('sort'),
      supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('tenant_id', tenant.id)
        .order('sort')
        .order('created_at'),
    ])
    if (err) setError(err.message)
    setCategories(cats || [])
    setProducts(prods || [])
  }, [tenant.id])

  useEffect(() => {
    load()
  }, [load])

  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories])

  const visible = useMemo(() => {
    if (!products) return []
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (catFilter === 'none' && p.category_id) return false
      if (catFilter !== 'all' && catFilter !== 'none' && p.category_id !== catFilter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.includes(q)) ||
        (p.product_variants || []).some((v) => v.sku?.toLowerCase().includes(q))
      )
    })
  }, [products, query, catFilter])

  const patchProduct = async (p, patch) => {
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, ...patch } : x)))
    const { error: err } = await supabase.from('products').update(patch).eq('id', p.id)
    if (err) {
      setError(err.message)
      load()
    }
  }

  const deleteProduct = async (p) => {
    setConfirmId(null)
    const { error: err } = await supabase.from('products').delete().eq('id', p.id)
    if (err) return setError(err.message)
    await removeImages(p.images || [])
    setProducts((list) => list.filter((x) => x.id !== p.id))
  }

  const nextSort = products ? products.reduce((m, p) => Math.max(m, p.sort), -1) + 1 : 0

  return (
    <div className="page">
      <header className="page__head page__head--split">
        <div className="row">
          <h1 className="display">Productos</h1>
          {products && <span className="muted">{products.length}</span>}
        </div>
        {tab === 'productos' && (
          <button className="btn btn--primary" data-tour="nuevo-producto" onClick={() => setEditing('new')}>
            <IconPlus /> Nuevo producto
          </button>
        )}
      </header>

      <div className="segmented" data-tour="tabs-productos">
        <button className={tab === 'productos' ? 'is-active' : ''} onClick={() => setTab('productos')}>Productos</button>
        <button className={tab === 'categorias' ? 'is-active' : ''} onClick={() => setTab('categorias')}>Categorías</button>
      </div>

      {error && <p className="alert alert--error">{error}</p>}

      {tab === 'categorias' ? (
        <Categories tenantId={tenant.id} categories={categories} products={products || []} onChange={load} />
      ) : (
        <>
          <div className="toolbar">
            <label className="search">
              <IconSearch />
              <input placeholder="Buscar por nombre, palabra clave o código" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <Dropdown className="dd--filter" ariaLabel="Filtrar por categoría" value={catFilter} onChange={setCatFilter}
              options={[{ value: 'all', label: 'Todas las categorías' }, ...categories.map((c) => ({ value: c.id, label: c.name })), { value: 'none', label: 'Sin categoría' }]} />
          </div>

          {!products ? (
            <Loader />
          ) : products.length === 0 ? (
            <div className="card empty">
              <p>Aún no tienes productos.</p>
              <button className="btn btn--primary" onClick={() => setEditing('new')}><IconPlus /> Agregar el primero</button>
            </div>
          ) : visible.length === 0 ? (
            <div className="card empty"><p>No hay productos que coincidan con la búsqueda.</p></div>
          ) : (
            <ul className="product-list" data-tour="lista-productos">
              {visible.map((p) => {
                const variants = p.product_variants || []
                const stock = modules.stock ? stockLabel(variants) : null
                const img = p.images?.[0]
                return (
                  <li key={p.id} className={`product-row ${p.visible ? '' : 'is-hidden'}`}>
                    <button className="product-row__main" onClick={() => setEditing(p)}>
                      <div className="product-row__thumb">{img ? <img src={img.thumb || img.full} alt="" loading="lazy" /> : null}</div>
                      <div className="product-row__info">
                        <strong>
                          {p.featured && <IconStar width={14} height={14} className="text-accent" />} {p.name}
                        </strong>
                        <small className="muted">
                          {catName[p.category_id] || 'Sin categoría'} · {variants.length} {variants.length === 1 ? 'variante' : 'variantes'}
                        </small>
                        {stock && <small className={`text-${stock.tone}`}>{stock.text}</small>}
                      </div>
                      <span className="product-row__price">{priceRange(variants)}</span>
                    </button>
                    <div className="product-row__actions">
                      <Switch checked={p.visible} onChange={(v) => patchProduct(p, { visible: v })} label="Visible" />
                      <Switch checked={p.featured} onChange={(v) => patchProduct(p, { featured: v })} label="Destacado" />
                      <button className="icon-btn" onClick={() => setEditing(p)} aria-label="Editar"><IconEdit width={17} height={17} /></button>
                      {confirmId === p.id ? (
                        <div className="row">
                          <button className="btn btn--sm btn--danger" onClick={() => deleteProduct(p)}>Eliminar</button>
                          <button className="btn btn--sm btn--ghost" onClick={() => setConfirmId(null)}>No</button>
                        </div>
                      ) : (
                        <button className="icon-btn" onClick={() => setConfirmId(p.id)} aria-label="Eliminar"><IconTrash width={17} height={17} /></button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {editing && (
        <ProductEditor
          tenantId={tenant.id}
          product={editing === 'new' ? null : editing}
          categories={categories}
          modules={modules}
          nextSort={nextSort}
          onClose={() => setEditing(null)}
          onCategoryCreated={(c) => setCategories((list) => [...list, c])}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
