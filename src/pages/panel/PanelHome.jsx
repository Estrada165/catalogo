import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { catalogUrl, daysLeft, formatDate } from '../../lib/utils'
import { IconCopy, IconCheck } from '../../components/icons'

const STATUS = {
  pendiente: { label: 'Pendiente de activación', tone: 'warn' },
  activo: { label: 'Activo', tone: 'ok' },
  suspendido: { label: 'Suspendido', tone: 'error' },
}

export default function PanelHome() {
  const { tenant } = useAuth()
  const { config } = useOutletContext()
  const [counts, setCounts] = useState({ products: null, pending: null, visits: null })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!tenant) return
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'pendiente'),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('type', 'visit').gte('created_at', since),
    ]).then(([p, o, v]) => setCounts({ products: p.count ?? 0, pending: o.count ?? 0, visits: v.count ?? 0 }))
  }, [tenant])

  if (!tenant) return null

  const status = STATUS[tenant.status] || STATUS.pendiente
  const left = daysLeft(tenant.expires_at)
  const url = catalogUrl(tenant.slug)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="display">{tenant.name}</h1>
        <span className={`pill pill--${status.tone}`}>{status.label}</span>
      </header>

      {tenant.status === 'pendiente' && (
        <div className="alert alert--warn">
          Tu catálogo ya está creado. Puedes ir cargando productos; será visible al público cuando el administrador active tu cuenta.
        </div>
      )}
      {tenant.status === 'suspendido' && (
        <div className="alert alert--error">Tu catálogo está suspendido y no es visible al público. Comunícate con el administrador.</div>
      )}

      {config && counts.products !== null && <Checklist config={config} products={counts.products} />}

      <section className="card link-card">
        <div>
          <small className="muted">Enlace de tu catálogo</small>
          <p className="link-card__url">{url}</p>
        </div>
        <button className="btn" onClick={copy}>
          {copied ? <IconCheck /> : <IconCopy />} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </section>

      <section className="stats">
        <div className="stat">
          <small>Productos</small>
          <strong>{counts.products ?? '—'}</strong>
        </div>
        <div className="stat">
          <small>Pedidos pendientes</small>
          <strong>{counts.pending ?? '—'}</strong>
        </div>
        <div className="stat">
          <small>Visitas (7 días)</small>
          <strong>{counts.visits ?? '—'}</strong>
        </div>
        <div className="stat">
          <small>Vence</small>
          <strong>{tenant.expires_at ? formatDate(tenant.expires_at) : '—'}</strong>
          {left !== null && <small className={left <= 5 ? 'text-warn' : 'muted'}>{left > 0 ? `${left} días restantes` : 'Vencido'}</small>}
        </div>
      </section>
    </div>
  )
}

function Checklist({ config, products }) {
  const b = config.business || {}
  const ck = config.checkout || {}
  const steps = [
    { done: !!b.whatsapp, label: 'Agrega tu WhatsApp para recibir pedidos', to: '/panel/configuracion', must: true },
    { done: products > 0, label: 'Carga tus primeros productos', to: '/panel/productos', must: true },
    { done: !!b.logo, label: 'Sube tu logo', to: '/panel/configuracion' },
    { done: (ck.payment_methods || []).length > 0, label: 'Agrega tus métodos de pago', to: '/panel/configuracion' },
    { done: Array.isArray(b.hours) && b.hours.length > 0, label: 'Publica tu horario de atención', to: '/panel/configuracion' },
  ]
  const left = steps.filter((x) => !x.done)
  if (!left.length) return null
  return (
    <section className="card checklist">
      <div className="checklist__head">
        <h2 className="display">Deja tu catálogo listo</h2>
        <span className="muted">{steps.length - left.length} de {steps.length}</span>
      </div>
      <div className="checklist__bar"><span style={{ width: `${((steps.length - left.length) / steps.length) * 100}%` }} /></div>
      <ul>
        {steps.map((x) => (
          <li key={x.label} className={x.done ? 'is-done' : ''}>
            <span className="checklist__dot">{x.done && <IconCheck width={13} height={13} />}</span>
            {x.done ? <span>{x.label}</span> : <Link to={x.to}>{x.label}{x.must && <em> · necesario</em>}</Link>}
          </li>
        ))}
      </ul>
    </section>
  )
}
