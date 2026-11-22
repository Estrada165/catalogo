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

export default function ProductCard({ p, index, qty, sym, onOpen, onAdd, onDec }) {
  const info = priceInfo(p)
  const single = p.variants.length === 1
  const v = p.variants[0]
  const img = p.images?.[0]
  const off = info.compare ? Math.round((1 - info.price / info.compare) * 100) : 0
  const badge = p.badge || (off >= 5 ? `-${off}%` : null)
  const per = info.unit !== 'und' ? `por ${info.unit}` : !single ? `${p.variants.length} opciones` : info.compare ? '' : ''

  return (
    <article className={`p-card p-card--img${qty ? ' in-cart' : ''}${p.soldOut ? ' is-out' : ''}`} style={{ '--i': Math.min(index, 18) }}>
      {badge && !p.soldOut && <span className="p-card__badge" data-b={off >= 5 && !p.badge ? 'oferta' : undefined}>{badge}</span>}
      {p.soldOut && <span className="p-card__stock">Agotado</span>}
      <button className="p-card__face" onClick={() => onOpen(p)} aria-label={`Ver ${p.name}`}>
        <span className="p-card__media">
          {img ? (
            <img src={img.thumb || img.full} alt="" loading="lazy" decoding="async" width="420" height="420" />
          ) : (
            <b className="p-card__initial">{p.name.slice(0, 1)}</b>
          )}
        </span>
        <span className="p-card__name">{p.name}</span>
        <span className="p-card__pricebox">
          {info.price === null ? (
            <span className="p-card__price is-consult">A consultar</span>
          ) : (
            <span className="p-card__price tnum">
              {info.from && <small className="p-card__from">Desde</small>}
              {money(info.price, sym)}
              {info.compare && !info.from && <s className="p-card__was">{money(info.compare, sym)}</s>}
            </span>
          )}
          {per && <small className="p-card__per">{per}</small>}
        </span>
      </button>
      <div className="p-card__foot">
        {!single ? (
          <button className="key key--block key--sm-md" disabled={p.soldOut} onClick={() => onOpen(p)}>
            {p.soldOut ? 'Agotado' : 'Elegir opción'} {!p.soldOut && <ChevronRight size={16} />}
          </button>
        ) : qty > 0 ? (
          <div className="stepper" role="group" aria-label={`Cantidad de ${p.name}`}>
            <button onClick={() => onDec(v)} aria-label="Quitar">
              {qty <= v.min_qty ? <Trash2 size={16} /> : <Minus size={18} />}
            </button>
            <output className="tnum" aria-live="polite">{fmtQty(qty, v.unit)}</output>
            <button onClick={(e) => onAdd(v, e.currentTarget)} disabled={v.max !== null && qty >= v.max} aria-label="Agregar">
              <Plus size={18} />
            </button>
          </div>
        ) : (
          <button className="key key--accent key--block key--sm-md" disabled={p.soldOut} onClick={(e) => onAdd(v, e.currentTarget)}>
            <Plus size={17} strokeWidth={2.6} /> {p.soldOut ? 'Agotado' : 'Agregar'}
          </button>
        )}
      </div>
    </article>
  )
}
