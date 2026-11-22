import { useEffect, useState } from 'react'
import { Hourglass, PauseCircle, CalendarX2, MessageCircle, RefreshCw, LogOut, ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getContact, waUrl, fillTemplate } from '../lib/platform'
import { catalogUrl, daysLeft } from '../lib/utils'
import ThemeToggle from './ThemeToggle'

// Pantalla para cuentas pendientes, suspendidas o vencidas: no se entra al panel hasta activarla
export function gateState(tenant) {
  if (!tenant) return null
  if (tenant.status === 'pendiente') return 'pendiente'
  if (tenant.status === 'suspendido') return 'suspendido'
  const left = daysLeft(tenant.expires_at)
  if (left !== null && left <= 0) return 'vencido'
  return null
}

const COPY = {
  pendiente: {
    icon: Hourglass,
    title: 'Tu cuenta está pendiente de activación',
    text: 'Ya registramos tu negocio. Escríbenos por WhatsApp para activar tu catálogo y empezar a usar tu panel.',
    cta: 'Escribir para activar',
    tpl: 'mensaje_activacion',
  },
  suspendido: {
    icon: PauseCircle,
    title: 'Tu cuenta está suspendida',
    text: 'Tu catálogo no es visible al público por ahora. Escríbenos para revisar tu cuenta.',
    cta: 'Escribir al administrador',
    tpl: 'mensaje_renovacion',
  },
  vencido: {
    icon: CalendarX2,
    title: 'Tu plan venció',
    text: 'Tu catálogo dejó de mostrarse. Renueva tu plan y todo vuelve a estar como lo dejaste: productos, pedidos y diseño.',
    cta: 'Renovar por WhatsApp',
    tpl: 'mensaje_renovacion',
  },
}

export default function AccountGate({ state }) {
  const { tenant, profile, refresh, signOut } = useAuth()
  const [contact, setContact] = useState(null)
  const [checking, setChecking] = useState(false)
  const c = COPY[state]
  const Icon = c.icon

  useEffect(() => { getContact().then(setContact) }, [])

  const message = fillTemplate(contact?.[c.tpl] || 'Hola, quiero activar mi catálogo {negocio} ({enlace}).', {
    negocio: tenant.name,
    enlace: catalogUrl(tenant.slug),
    nombre: profile?.full_name || '',
  })
  const href = contact?.whatsapp ? waUrl(contact.whatsapp, message) : null

  const check = async () => {
    setChecking(true)
    await refresh()
    setTimeout(() => setChecking(false), 600)
  }

  return (
    <div className="gate">
      <div className="gate__top">
        <ThemeToggle />
        <button className="btn btn--ghost btn--sm" onClick={signOut}><LogOut size={15} /> Salir</button>
      </div>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <div className="modal-card__body modal-card__body--center">
          <span className={`gate__icon gate__icon--${state}`}><Icon size={26} /></span>
          <h1 id="gate-title" className="modal-card__title">{c.title}</h1>
          <p className="muted">{c.text}</p>
          <div className="gate__biz">
            <strong>{tenant.name}</strong>
            <span>{catalogUrl(tenant.slug).replace(/^https?:\/\//, '')}</span>
          </div>
          {href ? (
            <a className="btn btn--wa btn--block btn--lg" href={href} target="_blank" rel="noreferrer"><MessageCircle size={18} /> {c.cta}</a>
          ) : (
            <p className="alert alert--warn">Pronto te contactaremos al número que registraste.</p>
          )}
          <div className="gate__actions">
            <button className="btn btn--sm" onClick={check} disabled={checking}><RefreshCw size={15} className={checking ? 'spin' : ''} /> Ya me activaron</button>
            <a className="btn btn--sm btn--ghost" href={`/${tenant.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Ver mi catálogo</a>
          </div>
        </div>
      </div>
    </div>
  )
}
