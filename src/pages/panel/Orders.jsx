import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatPrice } from '../../lib/utils'
import Loader from '../../components/Loader'
import { IconClose, IconSearch, IconChat, IconTrash } from '../../components/icons'

export const STATUS = {
  pendiente: { label: 'Pendiente', tone: 'warn' },
  confirmado: { label: 'Confirmado', tone: 'accent' },
  enviado: { label: 'Enviado', tone: 'accent' },
  entregado: { label: 'Entregado', tone: 'ok' },
  no_concretado: { label: 'No concretado', tone: 'muted' },
  cancelado: { label: 'Cancelado', tone: 'error' },
}
const FLOW = ['pendiente', 'confirmado', 'enviado', 'entregado']
const FILTERS = [
  { key: 'activos', label: 'Activos' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'entregado', label: 'Entregados' },
  { key: 'cerrados', label: 'No concretados' },
  { key: 'todos', label: 'Todos' },
]

const qty = (q, unit) => {
  const n = Number(q)
  const s = Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return !unit || unit === 'und' ? `${s} x` : `${s} ${unit}`
}
const when = (d) =>
  new Date(d).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Lima' })

export default function Orders() {
  const { tenant } = useAuth()
  const { config } = useOutletContext()
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('activos')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 90 * 86400000).toISOString()
    const { data, error: err } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)
    if (err) setError(err.message)
    setRows(data || [])
  }, [tenant.id])

  useEffect(() => { load() }, [load])

  // Pedidos nuevos en tiempo real
  useEffect(() => {
    const ch = supabase
      .channel(`orders-${tenant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenant.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tenant.id, load])

  const counts = useMemo(() => {
    const c = { activos: 0, pendiente: 0, entregado: 0, cerrados: 0, todos: rows?.length || 0 }
    ;(rows || []).forEach((o) => {
      if (['pendiente', 'confirmado', 'enviado'].includes(o.status)) c.activos++
      if (o.status === 'pendiente') c.pendiente++
      if (o.status === 'entregado') c.entregado++
      if (['no_concretado', 'cancelado'].includes(o.status)) c.cerrados++
    })
    return c
  }, [rows])

  const visible = useMemo(() => {
    if (!rows) return []
    const q = query.trim().toLowerCase()
    return rows.filter((o) => {
      if (filter === 'activos' && !['pendiente', 'confirmado', 'enviado'].includes(o.status)) return false
      if (filter === 'pendiente' && o.status !== 'pendiente') return false
      if (filter === 'entregado' && o.status !== 'entregado') return false
      if (filter === 'cerrados' && !['no_concretado', 'cancelado'].includes(o.status)) return false
      if (!q) return true
      return [o.code, o.customer?.name, o.customer?.phone, ...(o.items || []).map((i) => i.product)].some((v) => v?.toLowerCase().includes(q))
    })
  }, [rows, filter, query])

  const update = async (o, patch) => {
    setRows((list) => list.map((x) => (x.id === o.id ? { ...x, ...patch } : x)))
    setOpen((cur) => (cur?.id === o.id ? { ...cur, ...patch } : cur))
    const { error: err } = await supabase.from('orders').update(patch).eq('id', o.id)
    if (err) { setError(err.message); load() }
  }
  const remove = async (o) => {
    const { error: err } = await supabase.from('orders').delete().eq('id', o.id)
    if (err) return setError(err.message)
    setOpen(null)
    setRows((list) => list.filter((x) => x.id !== o.id))
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="display">Pedidos</h1>
        {counts.pendiente > 0 && <span className="pill pill--warn">{counts.pendiente} pendientes</span>}
      </header>
      <p className="muted page__lead">Cada pedido enviado por WhatsApp desde tu catálogo queda aquí con su código. Los pendientes que no se muevan en 48 horas pasan solos a “No concretado”.</p>

      <div className="toolbar">
        <div className="segmented segmented--scroll">
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? 'is-active' : ''} onClick={() => setFilter(f.key)}>
              {f.label} <em className="seg-count">{counts[f.key]}</em>
            </button>
          ))}
        </div>
        <label className="search">
          <IconSearch />
          <input placeholder="Código, cliente o producto" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {error && <p className="alert alert--error">{error}</p>}

      {!rows ? <Loader /> : visible.length === 0 ? (
        <div className="card empty"><p>{rows.length === 0 ? 'Aún no recibes pedidos. Comparte tu catálogo para empezar.' : 'No hay pedidos en esta vista.'}</p></div>
      ) : (
        <ul className="order-list">
          {visible.map((o) => {
            const st = STATUS[o.status]
            return (
              <li key={o.id}>
                <button className="order-row" onClick={() => setOpen(o)}>
                  <div className="order-row__main">
                    <strong className="order-row__code">{o.code}</strong>
                    <span>{o.customer?.name || 'Sin nombre'}</span>
                    <small className="muted">{when(o.created_at)} · {(o.items || []).length} {o.items?.length === 1 ? 'producto' : 'productos'} · {o.customer?.delivery === 'delivery' ? 'Delivery' : o.customer?.delivery === 'recojo' ? 'Recojo' : '—'}</small>
                  </div>
                  <div className="order-row__side">
                    <strong>{Number(o.total) > 0 ? formatPrice(o.total) : 'A consultar'}</strong>
                    <span className={`pill pill--${st.tone}`}>{st.label}</span>
                    {o.payment && <small className="text-ok">Pagado</small>}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {open && <OrderDrawer order={open} methods={config?.checkout?.payment_methods || []} businessName={config?.business?.name || tenant.name} onClose={() => setOpen(null)} onUpdate={update} onDelete={remove} />}
    </div>
  )
}

function OrderDrawer({ order: o, methods, businessName, onClose, onUpdate, onDelete }) {
  const [payMethod, setPayMethod] = useState(o.payment?.method || methods[0]?.name || 'Efectivo')
  const [payAmount, setPayAmount] = useState(o.payment?.amount ?? (Number(o.total) || ''))
  const [sure, setSure] = useState(false)
  const c = o.customer || {}
  const idx = FLOW.indexOf(o.status)
  const phone = String(c.phone || '').replace(/\D/g, '')
  const wa = phone ? `https://wa.me/${phone.length === 9 ? '51' + phone : phone}?text=${encodeURIComponent(`Hola ${c.name || ''}, te escribimos de ${businessName} por tu pedido ${o.code}.`)}` : null

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])

  return (
    <div className="drawer" role="dialog" aria-modal="true">
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel drawer__panel--sm">
        <header className="drawer__head">
          <div>
            <h2 className="display">{o.code}</h2>
            <small className="muted">{when(o.created_at)}</small>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
        </header>
        <div className="drawer__body">
          <section className="form-block">
            <h3 className="form-block__title">Estado</h3>
            <div className="status-steps">
              {FLOW.map((s, i) => (
                <button key={s} className={`status-step ${i <= idx ? 'is-done' : ''} ${o.status === s ? 'is-current' : ''}`} onClick={() => onUpdate(o, { status: s })}>
                  <span>{i + 1}</span>{STATUS[s].label}
                </button>
              ))}
            </div>
            <div className="row">
              {o.status !== 'no_concretado' && <button className="btn btn--sm btn--ghost" onClick={() => onUpdate(o, { status: 'no_concretado' })}>Marcar no concretado</button>}
              {o.status !== 'cancelado' && <button className="btn btn--sm btn--ghost" onClick={() => onUpdate(o, { status: 'cancelado' })}>Cancelar pedido</button>}
            </div>
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Productos</h3>
            <ul className="order-items">
              {(o.items || []).map((it, i) => (
                <li key={i}>
                  <span>{qty(it.qty, it.unit)} {it.product}{it.variant && it.variant !== 'Único' ? ` (${it.variant})` : ''}</span>
                  <strong>{it.line_total === null || it.line_total === undefined ? 'Consultar' : formatPrice(it.line_total)}</strong>
                </li>
              ))}
            </ul>
            <div className="order-totals">
              {Number(o.delivery_cost) > 0 && <div><span>Subtotal</span><span>{formatPrice(o.subtotal)}</span></div>}
              {Number(o.delivery_cost) > 0 && <div><span>Delivery{c.zone_name ? ` · ${c.zone_name}` : ''}</span><span>{formatPrice(o.delivery_cost)}</span></div>}
              <div className="is-total"><span>Total</span><span>{Number(o.total) > 0 ? formatPrice(o.total) : 'A consultar'}{o.has_quote_items && Number(o.total) > 0 ? ' +' : ''}</span></div>
            </div>
            {o.has_quote_items && <small className="muted">Incluye productos con precio a consultar.</small>}
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Cliente</h3>
            <dl className="kv">
              <div><dt>Nombre</dt><dd>{c.name || '—'}</dd></div>
              {c.phone && <div><dt>Celular</dt><dd>{c.phone}</dd></div>}
              <div><dt>Entrega</dt><dd>{c.delivery === 'delivery' ? `Delivery${c.zone_name ? ` · ${c.zone_name}` : ''}` : c.delivery === 'recojo' ? 'Recojo en tienda' : '—'}</dd></div>
              {c.address && <div><dt>Dirección</dt><dd>{c.address}</dd></div>}
              {c.note && <div><dt>Nota</dt><dd>{c.note}</dd></div>}
            </dl>
            {wa && <a className="btn btn--sm" href={wa} target="_blank" rel="noreferrer"><IconChat width={16} height={16} /> Escribir al cliente</a>}
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Pago</h3>
            {o.payment ? (
              <div className="row row--between">
                <span>Pagado con <strong>{o.payment.method}</strong>{o.payment.amount ? ` · ${formatPrice(o.payment.amount)}` : ''}</span>
                <button className="btn btn--sm btn--ghost" onClick={() => onUpdate(o, { payment: null })}>Quitar registro</button>
              </div>
            ) : (
              <div className="pay-register">
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {[...new Set([...methods.map((m) => m.name), 'Efectivo'])].map((n) => <option key={n}>{n}</option>)}
                </select>
                <input inputMode="decimal" placeholder="Monto" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <button className="btn btn--primary btn--sm" onClick={() => onUpdate(o, { payment: { method: payMethod, amount: Number(String(payAmount).replace(',', '.')) || null, at: new Date().toISOString() } })}>Registrar pago</button>
              </div>
            )}
          </section>

          <div className="row">
            {sure ? (
              <>
                <span className="muted">¿Eliminar este pedido?</span>
                <button className="btn btn--sm btn--danger" onClick={() => onDelete(o)}>Eliminar</button>
                <button className="btn btn--sm btn--ghost" onClick={() => setSure(false)}>No</button>
              </>
            ) : (
              <button className="btn btn--sm btn--ghost" onClick={() => setSure(true)}><IconTrash width={15} height={15} /> Eliminar pedido</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
