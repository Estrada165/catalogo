import { useEffect, useRef, useState } from 'react'
import { Plus, Minus, MessageCircle, Check, AlertTriangle, ListOrdered, ListChecks, StickyNote, Share2, SlidersHorizontal } from 'lucide-react'
import Sheet from './Sheet'
import { money } from '../lib/format'
import { clampQty, fmtQty, waLink, consultMessage } from '../lib/cart'
import { copyText } from '../lib/clipboard'

function Gallery({ images, name }) {
  const ref = useRef(null)
  const [i, setI] = useState(0)
  if (!images?.length) return null
  const onScroll = () => {
    const el = ref.current
    if (el) setI(Math.round(el.scrollLeft / el.clientWidth))
  }
  const go = (k) => ref.current?.scrollTo({ left: k * ref.current.clientWidth, behavior: 'smooth' })
  return (
    <div className="gallery">
      <div className="gallery__frame">
        <div className="gallery__track" ref={ref} onScroll={onScroll}>
          {images.map((img, k) => (
            <img key={k} src={img.full} alt={k === 0 ? name : ''} loading={k === 0 ? 'eager' : 'lazy'} decoding="async" />
          ))}
        </div>
        {images.length > 1 && <span className="gallery__count tnum">{i + 1}/{images.length}</span>}
      </div>
      {images.length > 1 && (
        <div className="gallery__thumbs" role="group" aria-label="Fotos">
          {images.map((img, k) => (
            <button key={k} aria-current={k === i} aria-label={`Foto ${k + 1}`} onClick={() => go(k)}>
              <img src={img.thumb || img.full} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const KIND = {
  incluye: { Icon: ListChecks, title: 'Incluye' },
  atencion: { Icon: AlertTriangle, title: 'Ten en cuenta' },
  pasos: { Icon: ListOrdered, title: 'Cómo usar' },
  nota: { Icon: StickyNote, title: 'Nota' },
}

function DetailBlock({ d }) {
  const k = KIND[d.kind] || KIND.incluye
  return (
    <section className="pd-block" data-kind={d.kind}>
      <h4><span className="pd-block__ic"><k.Icon size={15} /></span>{d.title || k.title}</h4>
      {d.kind === 'pasos' ? (
        <ol className="nums">{d.items.map((t, j) => <li key={j}>{t}</li>)}</ol>
      ) : d.kind === 'nota' ? (
        <div className="pd-block__note">{d.items.map((t, j) => <p key={j}>{t}</p>)}</div>
      ) : (
        <ul className={`ticks${d.kind === 'atencion' ? ' is-warn' : ''}`}>
          {d.items.map((t, j) => (
            <li key={j}>{d.kind === 'atencion' ? <AlertTriangle size={15} /> : <Check size={16} strokeWidth={2.6} />}{t}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function ProductSheet({ p, cat, inCart, sym, slug, onClose, onAdd, toast }) {
  const [sel, setSel] = useState(null)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    if (!p) return
    const first = p.variants.find((v) => v.max === null || v.max > 0) || p.variants[0]
    setSel(first?.id)
    setQty(first ? clampQty(first.min_qty, first) : 1)
  }, [p?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <Sheet open={false} onClose={onClose} />
  const v = p.variants.find((x) => x.id === sel) || p.variants[0]
  const out = v.max !== null && v.max <= 0
  const already = inCart(v.id)
  const room = v.max === null ? Infinity : v.max - already
  const category = cat.catById[p.category_id]
  const attrs = Object.entries(p.attributes || {})
  const total = v.price === null ? null : Math.round(v.price * qty * 100) / 100
  const off = v.price !== null && v.compare && v.compare > v.price ? Math.round((1 - v.price / v.compare) * 100) : 0
  const cover = p.images?.[0]

  const pick = (x) => {
    setSel(x.id)
    setQty(clampQty(x.min_qty, x))
  }

  const share = async () => {
    const url = `${location.origin}/${slug}?p=${p.id}`
    const text = `${p.name} · ${cat.settings.business_name}`
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: text, url }); return }
    } catch { return }
    const ok = await copyText(url)
    toast?.(ok ? 'Enlace copiado' : 'No se pudo copiar')
  }

  const footer = (
    <div className="detail-foot">
      {!out && (
        <div className="qty" role="group" aria-label="Cantidad">
          <button onClick={() => setQty((q) => clampQty(q - v.step, v))} disabled={qty <= v.min_qty} aria-label="Menos"><Minus size={18} /></button>
          <output className="tnum">{fmtQty(qty, v.unit)}</output>
          <button onClick={() => setQty((q) => clampQty(q + v.step, v))} disabled={qty + v.step > room} aria-label="Más"><Plus size={18} /></button>
        </div>
      )}
      <button
        className="key key--accent key--lg detail-foot__add"
        disabled={out || qty > room}
        onClick={(e) => onAdd(v, qty, e.currentTarget)}
      >
        <Plus size={18} strokeWidth={2.6} />
        {out ? 'Agotado' : qty > room ? 'Sin más stock' : total === null ? 'Agregar' : `Agregar · ${money(total, sym)}`}
      </button>
    </div>
  )

  return (
    <Sheet open={!!p} onClose={onClose} title={p.name} footer={footer} wide hideTitle className="pd-sheet">
      {cover && <span className="pd__ambient" style={{ backgroundImage: `url("${cover.thumb || cover.full}")` }} aria-hidden="true" />}
      <div className={`pd${p.images?.length ? '' : ' pd--noimg'}`}>
        <div className="pd__media">
          <Gallery images={p.images} name={p.name} />
        </div>

        <div className="pd__info">
          {(category || p.badge || off >= 5) && (
            <div className="pd__eyebrow">
              {category && <span>{category.name}</span>}
              {p.badge && <span className="is-accent">{p.badge}</span>}
              {off >= 5 && <span className="is-off">-{off}%</span>}
            </div>
          )}
          <h3 className="pd__name">{p.name}</h3>

          <div className="detail__price tnum">
            {v.price === null ? (
              <b className="is-consult">Precio a consultar</b>
            ) : (
              <>
                <b>{money(v.price, sym)}</b>
                {v.unit !== 'und' && <small>/ {v.unit}</small>}
                {off > 0 && <s>{money(v.compare, sym)}</s>}
              </>
            )}
            {v.max !== null && v.max > 0 && v.max <= 5 && <em className="detail__few">Quedan {fmtQty(v.max, v.unit)}</em>}
          </div>

          {p.description && <p className="detail__desc">{p.description}</p>}

          {p.variants.length > 1 && (
            <div className="block">
              <h4>Elige una opción</h4>
              <div className="opt-list" role="radiogroup" aria-label="Opciones">
                {p.variants.map((x) => {
                  const xOut = x.max !== null && x.max <= 0
                  return (
                    <button key={x.id} className="opt" role="radio" aria-checked={sel === x.id} aria-pressed={sel === x.id} disabled={xOut} onClick={() => pick(x)}>
                      <span className="opt__radio" aria-hidden="true" />
                      <span className="opt__txt">
                        <b>{x.label}</b>
                        {xOut ? <small>Agotado</small> : x.unit !== 'und' ? <small>Precio por {x.unit}</small> : null}
                      </span>
                      <span className="opt__price tnum">{x.price === null ? 'Consultar' : money(x.price, sym)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {v.unit !== 'und' && (
            <p className="detail__hint">Pedido mínimo {fmtQty(v.min_qty, v.unit)}, en pasos de {fmtQty(v.step, v.unit)}.</p>
          )}

          {p.details.map((d, i) => <DetailBlock key={i} d={d} />)}

          {attrs.length > 0 && (
            <section className="pd-block">
              <h4><span className="pd-block__ic"><SlidersHorizontal size={15} /></span>Características</h4>
              <dl className="specs">
                {attrs.map(([k, val]) => (
                  <div key={k}><dt>{k}</dt><dd>{val}</dd></div>
                ))}
              </dl>
            </section>
          )}

          <div className="pd__actions">
            {cat.settings.whatsapp && (
              <a className="pd__act" href={waLink(cat.settings.whatsapp, consultMessage(p.name, cat.settings.business_name))} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} /> Consultar
              </a>
            )}
            <button className="pd__act" onClick={share}><Share2 size={16} /> Compartir</button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
