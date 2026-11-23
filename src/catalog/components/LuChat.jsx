import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Plus, ShoppingBag, MessageCircle, Sparkles, RotateCcw, ChevronRight, MapPin, LayoutGrid } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getSessionId } from '../../lib/utils'
import { money, session } from '../lib/format'
import { waLink, clip } from '../lib/cart'
import { answer, buildIndex, suggestions } from '../lib/bot'
import { priceInfo } from './ProductCard'

// Lu: asistente local. Abre un panel lateral; en escritorio el catálogo se corre para dejarle espacio.
export default function LuChat({ cat, slug, sym, onAdd, onOpen, onOpenCart, onSearch, onCategory, hidden, forceClose, preview }) {
  const bot = cat.bot
  const name = bot.name || 'Lu'
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState(() => {
    try { return JSON.parse(session.get(`cat-lu:${slug}`) || '[]') } catch { return [] }
  })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useRef(null)
  const input = useRef(null)
  const index = useMemo(() => buildIndex(cat), [cat])
  const ideas = useMemo(() => suggestions(cat), [cat])
  const greeting = bot.greeting || `¡Hola! Soy ${name}, asistente de ${cat.settings.business_name}. Pregúntame por productos, precios, delivery o cómo hacer tu pedido.`

  useEffect(() => { session.set(`cat-lu:${slug}`, JSON.stringify(msgs.slice(-24))) }, [msgs, slug])
  useEffect(() => { if (open) requestAnimationFrame(() => list.current?.scrollTo({ top: 1e6, behavior: 'smooth' })) }, [msgs, open, busy])
  useEffect(() => { if (forceClose) setOpen(false) }, [forceClose])
  useEffect(() => {
    const on = () => setOpen(true)
    addEventListener('cat:open-bot', on)
    return () => removeEventListener('cat:open-bot', on)
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('lu-open', open)
    if (open) setTimeout(() => input.current?.focus({ preventScroll: true }), 250)
    const esc = (e) => { if (e.key === 'Escape' && !document.querySelector('.sheet-root')) setOpen(false) }
    if (open) addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [open])
  useEffect(() => () => document.documentElement.classList.remove('lu-open'), [])

  if (!bot.enabled) return null

  const send = (t) => {
    const q = clip((t ?? text).trim(), 300).replace(/…$/, '')
    if (!q || busy) return
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setText('')
    setBusy(true)
    const res = answer(cat, index, q)
    if (!preview) {
      supabase.rpc('track_event', { p_slug: slug, p_type: 'bot_message', p_session: getSessionId(), p_product: null, p_meta: { found: res.products.length } })
      if (res.unanswered) supabase.rpc('log_unanswered', { p_slug: slug, p_question: q })
    }
    // Pausa breve para que se sienta natural
    setTimeout(() => {
      setMsgs((m) => [...m, { role: 'bot', text: res.text, products: res.products, actions: res.actions, q }])
      setBusy(false)
    }, 380 + Math.min(500, res.text.length * 4))
  }

  const waFor = (q) =>
    cat.settings.whatsapp
      ? waLink(cat.settings.whatsapp, q ? `👋 Hola, vengo del catálogo de *${cat.settings.business_name}*. Quería consultar: “${clip(q, 200)}”` : `👋 Hola, tengo una consulta sobre el catálogo de *${cat.settings.business_name}*.`)
      : null

  const productCard = (id) => {
    const p = cat.byId[id]
    if (!p) return null
    const info = priceInfo(p)
    const single = p.variants.length === 1 && !p.soldOut
    const img = p.images?.[0]
    return (
      <div className="lu-card lu-card--p" key={id}>
        <button className="lu-card__head" onClick={() => onOpen(p)} aria-label={`Ver ${p.name}`}>
          {img ? <img src={img.thumb || img.full} alt="" width="44" height="44" /> : <span className="lu-card__ph">{p.name.slice(0, 1)}</span>}
          <span>
            <b>{p.name}</b>
            <small>
              {p.soldOut ? 'Agotado por ahora' : info.price === null ? 'Precio a consultar' : `${info.from ? 'Desde ' : ''}${money(info.price, sym)}${info.unit !== 'und' ? ` / ${info.unit}` : ''}`}
              <ChevronRight size={12} />
            </small>
          </span>
        </button>
        {single ? (
          <button className="key key--accent key--sm key--icon" onClick={(e) => onAdd(p.variants[0], e.currentTarget)} aria-label={`Agregar ${p.name}`}><Plus size={16} /></button>
        ) : !p.soldOut && (
          <button className="key key--sm" onClick={() => onOpen(p)}>Opciones</button>
        )}
      </div>
    )
  }

  const avatar = bot.avatar_url ? <img src={bot.avatar_url} alt="" /> : <span>{name.slice(0, 1)}</span>

  return createPortal(
    <>
      {!hidden && !open && (
        <button className="lu-fab" onClick={() => setOpen(true)} aria-label={`Preguntarle a ${name}`}>
          <span className="lu-fab__av">{avatar}</span>
          <span className="lu-fab__txt">Pregúntale a {name}</span>
        </button>
      )}
      <section className={`lu${open ? ' is-open' : ''}`} role="dialog" aria-modal="false" aria-label={`Chat con ${name}`} aria-hidden={!open}>
        <header className="lu__head">
          <span className="lu__av">{avatar}<i aria-hidden="true" /></span>
          <div><b>{name}</b><small>Asistente de {cat.settings.business_name} · responde al instante</small></div>
          {msgs.length > 0 && (
            <button className="key key--icon key--sm key--ghost" onClick={() => setMsgs([])} aria-label="Nueva conversación" title="Nueva conversación"><RotateCcw size={16} /></button>
          )}
          <button className="key key--icon key--sm" onClick={() => setOpen(false)} aria-label="Cerrar chat"><X size={18} /></button>
        </header>
        <div className="lu__body" ref={list} aria-live="polite">
          <div className="lu-msg is-bot"><p>{greeting}</p></div>
          {msgs.length === 0 && ideas.length > 0 && (
            <div className="lu-ideas">{ideas.map((i) => <button key={i} onClick={() => send(i)}><Sparkles size={13} /> {i}</button>)}</div>
          )}
          {msgs.map((m, i) => {
            if (m.role === 'user') return <div key={i} className="lu-msg is-me"><p>{m.text}</p></div>
            return (
              <div key={i} className="lu-msg is-bot">
                {m.text && <p>{m.text}</p>}
                {(m.products?.length > 0 || m.actions?.length > 0) && (
                  <div className="lu-att">
                    {(m.products || []).map(productCard)}
                    {(m.actions || []).filter((a) => typeof a === 'object').map((a, k) => (
                      <button key={k} className="key key--sm lu-act" onClick={() => {
                        setOpen(false)
                        if (a.type === 'cat') onCategory?.(a.id)
                        else onSearch?.(a.q)
                      }}><LayoutGrid size={15} /> {a.label}</button>
                    ))}
                    {m.actions?.includes('cart') && (
                      <button className="key key--sm lu-act" onClick={() => { setOpen(false); onOpenCart() }}><ShoppingBag size={15} /> Ver mi carrito</button>
                    )}
                    {m.actions?.includes('maps') && cat.settings.maps_url && (
                      <a className="key key--sm lu-act" href={cat.settings.maps_url} target="_blank" rel="noopener noreferrer"><MapPin size={15} /> Ver en el mapa</a>
                    )}
                    {m.actions?.includes('whatsapp') && waFor(m.q) && (
                      <a className="key key--sm key--wa lu-act" href={waFor(m.q)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Escribir por WhatsApp</a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {busy && <div className="lu-msg is-bot is-typing" aria-label={`${name} está escribiendo`}><span /><span /><span /></div>}
        </div>
        <form className="lu__input" onSubmit={(e) => { e.preventDefault(); send() }}>
          <textarea
            ref={input}
            rows={1}
            value={text}
            maxLength={300}
            placeholder={`Escríbele a ${name}…`}
            aria-label="Tu mensaje"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            enterKeyHint="send"
          />
          <button className="key key--accent key--icon" disabled={!text.trim() || busy} aria-label="Enviar"><Send size={17} /></button>
        </form>
      </section>
    </>,
    document.body
  )
}
