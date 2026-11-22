import { Minus, Plus, ChevronRight, Trash2 } from 'lucide-react'
import { money } from '../lib/format'
import { fmtQty } from '../lib/cart'

export function priceInfo(p) {
  const sellable = p.variants.filter((v) => v.max === null || v.max > 0)
  const pool = sellable.length ? sellable : p.variants
  const priced = pool.filter((v) => v.price !== null)
  if (!priced.length) return { price: null, compare: null, from: false, unit: pool[0]?.unit || 'und' }
  const cheapest = priced.reduce((a, b) => (b.price < a.price ? b : a))
  return {
    price: cheapest.price,
    compare: cheapest.compare && cheapest.compare > cheapest.price ? cheapest.compare : null,
    from: new Set(priced.map((v) => v.price)).size > 1,
    unit: cheapest.unit,
  }
}

export default function ProductCard({ p, index, qty, sym, category, onOpen, onAdd, onDec, wide = false }) {
  const info = priceInfo(p)
  const single = p.variants.length === 1
  const v = p.variants[0]
  const img = p.images?.[0]
  const off = info.compare ? Math.round((1 - info.price / info.compare) * 100) : 0
  const few = single && v.max !== null && v.max > 0 && v.max <= 5

  return (
    <article className={`pc${wide ? ' pc--wide' : ''}${qty ? ' in-cart' : ''}${p.soldOut ? ' is-out' : ''}`} style={{ '--i': Math.min(index, 18) }}>
      <button className="pc__media" onClick={() => onOpen(p)} aria-label={`Ver ${p.name}`}>
        {img ? (
          <img src={wide ? img.full : img.thumb || img.full} alt="" loading="lazy" decoding="async" />
        ) : (
          <b className="pc__initial">{p.name.slice(0, 1)}</b>
        )}
        <span className="pc__badges">
          {p.soldOut ? <span className="pc__badge pc__badge--out">Agotado</span> : (
            <>
              {off >= 5 && <span className="pc__badge pc__badge--off">-{off}%</span>}
              {p.badge && <span className="pc__badge">{p.badge}</span>}
            </>
          )}
        </span>
        {few && !p.soldOut && <span className="pc__few">Quedan {fmtQty(v.max, v.unit)}</span>}
      </button>
      <div className="pc__body">
        {category && <span className="pc__cat">{category}</span>}
        <button className="pc__name" onClick={() => onOpen(p)}>{p.name}</button>
        <div className="pc__row">
          <div className="pc__price tnum">
            {info.price === null ? (
              <b className="is-consult">A consultar</b>
            ) : (
              <>
                {info.from && <small>Desde</small>}
                <b>{money(info.price, sym)}</b>
                {info.unit !== 'und' && <small>/ {info.unit}</small>}
                {info.compare && !info.from && <s>{money(info.compare, sym)}</s>}
              </>
            )}
          </div>
          {!single ? (
            <button className="pc__btn" disabled={p.soldOut} onClick={() => onOpen(p)} aria-label={`Ver opciones de ${p.name}`}>
              <ChevronRight size={18} />
            </button>
          ) : qty > 0 ? null : (
            <button className="pc__btn pc__btn--add" disabled={p.soldOut} onClick={(e) => onAdd(v, e.currentTarget)} aria-label={`Agregar ${p.name}`}>
              <Plus size={18} strokeWidth={2.6} />
            </button>
          )}
        </div>
        {single && qty > 0 && (
          <div className="stepper pc__stepper" role="group" aria-label={`Cantidad de ${p.name}`}>
            <button onClick={() => onDec(v)} aria-label="Quitar">{qty <= v.min_qty ? <Trash2 size={16} /> : <Minus size={18} />}</button>
            <output className="tnum" aria-live="polite">{fmtQty(qty, v.unit)}</output>
            <button onClick={(e) => onAdd(v, e.currentTarget)} disabled={v.max !== null && qty >= v.max} aria-label="Agregar uno más"><Plus size={18} /></button>
          </div>
        )}
        {!single && !p.soldOut && <small className="pc__opts">{p.variants.length} opciones</small>}
      </div>
    </article>
  )
}
