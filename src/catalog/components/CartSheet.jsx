import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Trash2, ArrowLeft, Copy, Download, Send, ShoppingBag, Store, Truck } from 'lucide-react'
import Sheet from './Sheet'
import { supabase } from '../../lib/supabase'
import { getSessionId } from '../../lib/utils'
import { buildOrderMessage, fmtQty, waLink } from '../lib/cart'
import { money, store } from '../lib/format'
import { copyText } from '../lib/clipboard'

const isTouch = () => window.matchMedia?.('(pointer: coarse)').matches

export default function CartSheet({ open, onClose, summary, cat, sym, dispatch, slug, toast, preview }) {
  const ck = cat.checkout || {}
  const deliveryOn = cat.modules.delivery !== false && ck.allow_delivery !== false
  const pickupOn = ck.allow_pickup !== false
  const methods = cat.payment_methods

  const [step, setStep] = useState('cart')
  const [form, setForm] = useState(() => ({
    name: '', phone: '', address: '', note: '', date: '', dedication: '',
    ...store.get(`cat-buyer:${slug}`, {}),
    delivery: deliveryOn ? 'delivery' : pickupOn ? 'recojo' : null,
    zone_id: '',
  }))
  const [methodIdx, setMethodIdx] = useState(0)
  const [zoom, setZoom] = useState(null)
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(null)
  const method = methods[methodIdx]
  const zone = cat.zones.find((z) => z.id === form.zone_id)

  useEffect(() => { if (open) { setStep(sent ? 'sent' : 'cart'); setSure(false); setError('') } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 4000); return () => clearTimeout(t) }, [sure])
  useEffect(() => { if (!summary.count && step === 'data') setStep('cart') }, [summary.count]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const { name, phone, address } = form
    store.set(`cat-buyer:${slug}`, { name, phone, address })
  }, [form.name, form.phone, form.address, slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const deliveryCost = form.delivery === 'delivery' && zone ? Number(zone.cost) || 0 : 0
  const total = Math.round((summary.subtotal + deliveryCost) * 100) / 100
  const copy = async (text, label) => { if (await copyText(text)) toast(`${label} copiado`) }

  const missing = useMemo(() => {
    if (ck.ask_name !== false && !form.name.trim()) return 'Escribe tu nombre.'
    if (ck.ask_phone && !/^9\d{8}$/.test(form.phone.replace(/\s/g, ''))) return 'Escribe un celular válido (9 dígitos).'
    if (form.delivery === 'delivery' && cat.zones.length && !form.zone_id) return 'Elige tu zona de delivery.'
    if (form.delivery === 'delivery' && ck.ask_address !== false && !form.address.trim()) return 'Escribe la dirección de entrega.'
    if (ck.ask_date && !form.date) return 'Elige la fecha de entrega.'
    return ''
  }, [form, ck, cat.zones.length])

  const send = async () => {
    if (missing) { setError(missing); return }
    if (!cat.settings.whatsapp) { setError('Este negocio aún no configuró su WhatsApp.'); return }
    setError('')
    setBusy(true)
    // En escritorio se abre la pestaña al instante (antes de esperar) para que el navegador no la bloquee
    const tab = !isTouch() ? window.open('', '_blank') : null
    try {
      const customer = {
        name: form.name.trim(),
        phone: form.phone.replace(/\s/g, ''),
        delivery: form.delivery,
        zone_id: form.delivery === 'delivery' ? form.zone_id || null : null,
        address: form.delivery === 'delivery' ? form.address.trim() : '',
        note: [form.note.trim(), ck.ask_date && form.date ? `Fecha: ${form.date}` : '', ck.ask_dedication && form.dedication.trim() ? `Dedicatoria: ${form.dedication.trim()}` : '']
          .filter(Boolean)
          .join(' · '),
      }
      const { data: order, error: err } = await supabase.rpc('create_order', {
        p_slug: slug,
        p_items: summary.rows.map((r) => ({ variant_id: r.variant.id, qty: r.qty })),
        p_customer: customer,
        p_session: getSessionId(),
      })
      if (err) throw err
      const text = buildOrderMessage({
        order,
        customer: { ...form, zone_name: zone?.name, name: customer.name, phone: customer.phone },
        checkout: ck,
        method,
        businessName: cat.settings.business_name,
      })
      const url = waLink(cat.settings.whatsapp, text)
      setSent({ code: order.code, url, total: order.total, quote: order.has_quote_items })
      setStep('sent')
      dispatch({ type: 'clear' })
      if (tab) tab.location.href = url
      else window.location.href = url
    } catch (e) {
      tab?.close()
      const msg = String(e?.message || '')
      setError(
        preview || msg.includes('no disponible')
          ? 'Vista previa: los pedidos se activan cuando el catálogo esté activo.'
          : msg.includes('Stock') || msg.includes('Cantidad') || msg.includes('no disponible') || msg.includes('Demasiados')
            ? msg
            : 'No pudimos registrar tu pedido. Revisa tu conexión e inténtalo de nuevo.'
      )
    } finally {
      setBusy(false)
    }
  }

  const cartView = summary.rows.length === 0 ? (
    <div className="empty">
      <ShoppingBag size={34} style={{ margin: '0 auto 10px', color: 'var(--faint)' }} />
      <b>Tu carrito está vacío</b>
      Agrega un producto para empezar.
    </div>
  ) : (
    <div>
      <div className="cart-top">
        <span className="tnum">{summary.count} {summary.count === 1 ? 'producto' : 'productos'}</span>
        {sure ? (
          <span className="cart-top__ask" role="group" aria-label="Confirmar vaciar carrito">
            ¿Vaciar todo?
            <button className="key key--ghost key--sm" onClick={() => setSure(false)}>No</button>
            <button className="key key--sm cart-top__yes" onClick={() => { dispatch({ type: 'clear' }); setSure(false); toast('Carrito vacío') }}>Sí, vaciar</button>
          </span>
        ) : (
          <button className="cart-top__clear" onClick={() => setSure(true)}><Trash2 size={14} /> Vaciar carrito</button>
        )}
      </div>
      {summary.rows.map((r) => {
        const v = r.variant
        return (
          <div className="cart-line" key={r.key}>
            {r.image ? <img className="cart-line__logo" src={r.image} alt="" width="44" height="44" /> : <span className="cart-line__logo cart-line__ph">{r.name.slice(0, 1)}</span>}
            <div className="cart-line__txt"><b>{r.name}</b><small>{r.detail}</small></div>
            <div className="mini-step" role="group" aria-label={`Cantidad de ${r.name}`}>
              <button onClick={() => dispatch({ type: 'dec', variant: v })} aria-label="Quitar">
                {r.qty <= v.min_qty ? <Trash2 size={15} /> : <Minus size={15} />}
              </button>
              <output className="tnum">{fmtQty(r.qty, v.unit)}</output>
              <button onClick={() => dispatch({ type: 'add', variant: v })} disabled={v.max !== null && r.qty >= v.max} aria-label="Agregar"><Plus size={15} /></button>
            </div>
            <span className="cart-line__price tnum">{r.total === null ? 'Consultar' : money(r.total, sym)}</span>
          </div>
        )
      })}
      {summary.hasQuote && <div className="hint"><span>Los productos “a consultar” se confirman por WhatsApp.</span></div>}
    </div>
  )

  const dataView = (
    <div className="checkout">
      {ck.ask_name !== false && (
        <div className="field">
          <label htmlFor="ck-name">Tu nombre</label>
          <input id="ck-name" value={form.name} onChange={set('name')} maxLength={60} autoComplete="name" placeholder="Para saludarte en WhatsApp" />
        </div>
      )}
      {ck.ask_phone && (
        <div className="field">
          <label htmlFor="ck-phone">Celular</label>
          <input id="ck-phone" value={form.phone} onChange={set('phone')} inputMode="numeric" maxLength={11} autoComplete="tel" placeholder="9XXXXXXXX" />
        </div>
      )}

      {deliveryOn && pickupOn && (
        <div className="field">
          <label>¿Cómo lo recibes?</label>
          <div className="choice">
            <button type="button" aria-pressed={form.delivery === 'delivery'} onClick={() => setForm((f) => ({ ...f, delivery: 'delivery' }))}><Truck size={18} /> Delivery</button>
            <button type="button" aria-pressed={form.delivery === 'recojo'} onClick={() => setForm((f) => ({ ...f, delivery: 'recojo' }))}><Store size={18} /> Recojo en tienda</button>
          </div>
        </div>
      )}
      {form.delivery === 'recojo' && cat.settings.address && <p className="checkout__note">Recoges en: <b>{cat.settings.address}</b></p>}
      {form.delivery === 'delivery' && cat.zones.length > 0 && (
        <div className="field">
          <label htmlFor="ck-zone">Zona</label>
          <select id="ck-zone" value={form.zone_id} onChange={set('zone_id')}>
            <option value="">Elige tu zona</option>
            {cat.zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name} · {Number(z.cost) > 0 ? money(z.cost, sym) : 'Gratis'}</option>
            ))}
          </select>
        </div>
      )}
      {form.delivery === 'delivery' && ck.ask_address !== false && (
        <div className="field">
          <label htmlFor="ck-addr">Dirección de entrega</label>
          <input id="ck-addr" value={form.address} onChange={set('address')} maxLength={200} autoComplete="street-address" placeholder="Calle, número, referencia" />
        </div>
      )}
      {ck.ask_date && (
        <div className="field">
          <label htmlFor="ck-date">Fecha de entrega</label>
          <input id="ck-date" type="date" value={form.date} min={new Date().toISOString().slice(0, 10)} onChange={set('date')} />
        </div>
      )}
      {ck.ask_dedication && (
        <div className="field">
          <label htmlFor="ck-ded">Dedicatoria (opcional)</label>
          <textarea id="ck-ded" rows={2} value={form.dedication} onChange={set('dedication')} maxLength={200} />
        </div>
      )}
      <div className="field">
        <label htmlFor="ck-note">Nota (opcional)</label>
        <textarea id="ck-note" rows={2} value={form.note} onChange={set('note')} maxLength={250} placeholder="Algo que debamos saber" />
      </div>

      {methods.length > 0 && (
        <>
          <p className="pay-q">¿Cómo vas a pagar?</p>
          <div className="methods" role="group" aria-label="Método de pago">
            {methods.map((m, i) => (
              <button key={i} className="method" aria-pressed={i === methodIdx} onClick={() => setMethodIdx(i)}>
                {m.logo_url && <img src={m.logo_url} alt="" width="38" height="38" />}{m.name}
              </button>
            ))}
          </div>
          {method && (method.qr_url || method.account || method.note) && (
            <div className={`paybox${method.qr_url ? ' has-qr' : ''}`}>
              {method.qr_url && (
                <button className="paybox__qr" onClick={() => setZoom(method)} aria-label={`Ampliar QR de ${method.name}`}>
                  <img src={method.qr_url} alt={`QR de ${method.name}`} />
                </button>
              )}
              <div>
                {method.account && (
                  <div className="copy-row">
                    <div><small>{method.account_label || 'Número'}</small><b className="tnum">{method.account}</b></div>
                    <button className="key key--sm" onClick={() => copy(method.account, method.account_label || 'Número')}><Copy size={15} /> Copiar</button>
                  </div>
                )}
                {method.holder && <p className="paybox__holder">Titular: <b>{method.holder}</b></p>}
                {method.note && <p className="paybox__holder">{method.note}</p>}
              </div>
            </div>
          )}
        </>
      )}
      {error && <p className="checkout__error" role="alert">{error}</p>}
    </div>
  )

  const totals = (
    <div className="totals tnum" aria-live="polite">
      {(deliveryCost > 0 || (step === 'data' && form.delivery === 'delivery')) && (
        <>
          <div><span>Subtotal</span><span>{money(summary.subtotal, sym)}</span></div>
          <div><span>Delivery{zone ? ` · ${zone.name}` : ''}</span><span>{zone ? (deliveryCost > 0 ? money(deliveryCost, sym) : 'Gratis') : 'Por confirmar'}</span></div>
        </>
      )}
      <div className="is-total"><span>Total</span><span>{total > 0 ? money(total, sym) : 'A consultar'}{summary.hasQuote && total > 0 ? ' +' : ''}</span></div>
    </div>
  )

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        variant="drawer"
        title={step === 'cart' ? 'Tu carrito' : step === 'data' ? 'Tus datos' : 'Pedido enviado'}
        head={step === 'data' && <button className="key key--icon key--sm" onClick={() => setStep('cart')} aria-label="Volver al carrito"><ArrowLeft size={18} /></button>}
        footer={step === 'sent' && sent ? (
          <div className="row-2">
            <a className="key key--lg" href={sent.url} target="_blank" rel="noopener noreferrer"><Send size={17} /> Abrir otra vez</a>
            <button className="key key--accent key--lg" onClick={() => { setSent(null); setStep('cart'); onClose() }}>Seguir viendo</button>
          </div>
        ) : summary.count > 0 && (
          <>
            {totals}
            {step === 'cart' ? (
              <button className="key key--accent key--block key--lg" onClick={() => setStep('data')}>Continuar</button>
            ) : (
              <button className="key key--wa key--block key--lg" disabled={busy} onClick={send}>
                <Send size={18} /> {busy ? 'Registrando pedido…' : 'Enviar pedido por WhatsApp'}
              </button>
            )}
          </>
        )}
      >
        {step === 'cart' ? cartView : step === 'data' ? dataView : sent && (
          <div className="done">
            <svg className="done__check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg>
            <h3>¡Pedido {sent.code} listo!</h3>
            <p>Se abrió WhatsApp con tu pedido. Solo presiona enviar{method ? ` y, si ya pagaste con ${method.name}, adjunta tu comprobante` : ''}.</p>
            {sent.total > 0 && <p className="done__total tnum">Total: <b>{money(sent.total, sym)}</b>{sent.quote ? ' + productos a consultar' : ''}</p>}
          </div>
        )}
      </Sheet>
      <Sheet open={!!zoom} onClose={() => setZoom(null)} title={zoom ? `QR de ${zoom.name}` : ''}
        footer={zoom && <a className="key key--block key--lg" href={zoom.qr_url} download={`QR-${zoom.name}`}><Download size={18} /> Descargar QR</a>}>
        {zoom && <div style={{ background: '#fff', borderRadius: 16, padding: 12 }}><img src={zoom.qr_url} alt={`QR de ${zoom.name}`} style={{ width: '100%', maxWidth: 420, margin: '0 auto' }} /></div>}
        {zoom?.holder && <p className="paybox__holder" style={{ textAlign: 'center' }}>Titular: <b>{zoom.holder}</b></p>}
      </Sheet>
    </>
  )
}
