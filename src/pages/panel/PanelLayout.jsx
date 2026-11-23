import '../../styles/shell.js'
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Home, Package, ShoppingBag, Palette, Bot, QrCode, BarChart3, Settings, LogOut, ExternalLink, HelpCircle,
  MoreHorizontal, X, CalendarClock, ReceiptText,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cleanupReplaced } from '../../lib/images'
import { getContact, waUrl, fillTemplate, planVars } from '../../lib/platform'
import { catalogUrl, daysLeft, formatDate } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../../components/ThemeToggle'
import TourHost, { startTour, guideForPath, useAutoTour } from '../../components/tour/TourHost'

const GROUPS = [
  {
    label: 'Tu tienda',
    items: [
      { to: '/panel', label: 'Inicio', icon: Home, end: true },
      { to: '/panel/productos', label: 'Productos', icon: Package, tour: 'nav-productos' },
      { to: '/panel/pedidos', label: 'Pedidos', icon: ShoppingBag, module: 'pedidos' },
      { to: '/panel/boletas', label: 'Boletas', icon: ReceiptText },
    ],
  },
  {
    label: 'Diseño',
    items: [
      { to: '/panel/apariencia', label: 'Apariencia', icon: Palette },
      { to: '/panel/qr', label: 'Mi QR', icon: QrCode, module: 'qr' },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { to: '/panel/bot', label: 'Asistente', icon: Bot, module: 'bot' },
      { to: '/panel/analitica', label: 'Analítica', icon: BarChart3, module: 'analitica' },
    ],
  },
  {
    label: 'Ajustes',
    items: [{ to: '/panel/configuracion', label: 'Configuración', icon: Settings, tour: 'nav-config' }],
  },
]
const MOBILE_MAIN = ['/panel', '/panel/productos', '/panel/pedidos', '/panel/apariencia']

function PlanCard({ tenant, contact, compact = false }) {
  const left = daysLeft(tenant.expires_at)
  const total = tenant.cycle_days || 30
  const pct = left === null ? 100 : Math.max(4, Math.min(100, (left / total) * 100))
  const tone = left === null ? 'ok' : left <= 3 ? 'error' : left <= 7 ? 'warn' : 'ok'
  const renew = contact?.whatsapp
    ? waUrl(contact.whatsapp, fillTemplate(contact.mensaje_renovacion || 'Hola, quiero renovar mi catálogo {negocio} ({enlace}).', { ...planVars(tenant), enlace: catalogUrl(tenant.slug) }))
    : null
  if (compact) {
    return (
      <span className={`plan-chip plan-chip--${tone}`} title={tenant.expires_at ? `Vence el ${formatDate(tenant.expires_at)}` : 'Sin vencimiento'}>
        <CalendarClock size={14} /> {left === null ? 'Activo' : `${left} ${left === 1 ? 'día' : 'días'}`}
      </span>
    )
  }
  return (
    <div className={`plan-card plan-card--${tone}`} data-tour="plan">
      <div className="plan-card__row">
        <span className="plan-card__label">Tu plan</span>
        <strong>{left === null ? 'Activo' : `${left} ${left === 1 ? 'día' : 'días'}`}</strong>
      </div>
      <div className="plan-card__bar"><span style={{ width: `${pct}%` }} /></div>
      <small className="muted">{tenant.expires_at ? `Vence el ${formatDate(tenant.expires_at)}` : 'Sin fecha de vencimiento'}</small>
      {tenant.price != null && <small className="muted plan-card__price">S/ {Number(tenant.price).toFixed(2)} cada {tenant.cycle_days || 30} días</small>}
      {renew && left !== null && left <= 7 && <a className="btn btn--sm btn--block" href={renew} target="_blank" rel="noreferrer">Renovar</a>}
    </div>
  )
}

export default function PanelLayout() {
  const { tenant, user, signOut } = useAuth()
  const { pathname } = useLocation()
  const [config, setConfig] = useState(null)
  const [contact, setContact] = useState(null)
  const [more, setMore] = useState(false)

  const reloadConfig = useCallback(async () => {
    if (!tenant) return
    const { data } = await supabase.from('tenant_config').select('*').eq('tenant_id', tenant.id).maybeSingle()
    setConfig(data)
  }, [tenant])

  useEffect(() => { reloadConfig() }, [reloadConfig])
  useEffect(() => { getContact().then(setContact) }, [])
  useEffect(() => { setMore(false) }, [pathname])
  useAutoTour(user?.id, guideForPath(pathname), !!config)

  // Guarda una o varias columnas de tenant_config (business, theme, sections, modules, checkout, bot)
  const saveConfig = useCallback(
    async (patch) => {
      const before = config
      const { data, error } = await supabase.from('tenant_config').update(patch).eq('tenant_id', tenant.id).select().single()
      if (error) throw error
      setConfig(data)
      // Logo, foto de Lu o QR de pago reemplazados: se borra el archivo anterior
      if (before) {
        const keys = Object.keys(patch)
        const pick = (c) => Object.fromEntries(keys.map((k) => [k, c?.[k]]))
        cleanupReplaced(pick(before), pick(data)).catch(() => {})
      }
      return data
    },
    [tenant, config]
  )

  const modules = config?.modules || {}
  const visible = (i) => !i.module || modules[i.module] !== false
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length)
  const all = groups.flatMap((g) => g.items)
  const logo = config?.business?.logo
  const name = config?.business?.name || tenant?.name
  const guide = guideForPath(pathname)

  const navItem = ({ to, label, icon: Icon, end, tour }) => (
    <NavLink key={to} to={to} end={end} className="nav2" data-tour={tour}>
      <span className="nav2__pill"><Icon size={18} strokeWidth={1.9} /></span>
      <span>{label}</span>
    </NavLink>
  )

  return (
    <div className="shell2">
      <aside className="side2">
        <div className="side2__brand">
          {logo ? <img src={logo} alt="" /> : <span className="side2__initial">{name?.slice(0, 1)}</span>}
          <div>
            <strong>{name}</strong>
            <a href={`/${tenant?.slug}`} target="_blank" rel="noreferrer">/{tenant?.slug} <ExternalLink size={12} /></a>
          </div>
        </div>

        <nav className="side2__nav" data-tour="menu">
          {groups.map((g) => (
            <div key={g.label} className="side2__group">
              <p className="side2__label">{g.label}</p>
              {g.items.map(navItem)}
            </div>
          ))}
        </nav>

        <div className="side2__foot">
          {tenant && <PlanCard tenant={tenant} contact={contact} />}
          <div className="side2__tools">
            {guide && <button className="icon-btn" onClick={() => startTour(guide)} aria-label="Ver la guía de esta sección" title="Guía de esta sección"><HelpCircle size={18} /></button>}
            <ThemeToggle />
            <button className="icon-btn icon-btn--danger" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      <header className="top2">
        <div className="top2__brand">
          {logo ? <img src={logo} alt="" /> : <span className="side2__initial">{name?.slice(0, 1)}</span>}
          <strong>{name}</strong>
        </div>
        <div className="row">
          {tenant && <PlanCard tenant={tenant} contact={contact} compact />}
          {guide && <button className="icon-btn" onClick={() => startTour(guide)} aria-label="Ver la guía de esta sección"><HelpCircle size={18} /></button>}
          <ThemeToggle />
        </div>
      </header>

      <main className="main2">
        <Outlet context={{ config, setConfig, saveConfig, reloadConfig }} />
      </main>

      <nav className="bottom2" aria-label="Menú">
        {all.filter((i) => MOBILE_MAIN.includes(i.to)).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottom2__item"><Icon size={20} strokeWidth={1.9} /><span>{label}</span></NavLink>
        ))}
        <button className={`bottom2__item ${more ? 'active' : ''}`} onClick={() => setMore((m) => !m)} aria-expanded={more}>
          {more ? <X size={20} /> : <MoreHorizontal size={20} />}<span>Más</span>
        </button>
      </nav>

      {more && (
        <div className="more-sheet" role="dialog" aria-label="Más opciones">
          <div className="more-sheet__backdrop" onClick={() => setMore(false)} />
          <div className="more-sheet__panel">
            <span className="more-sheet__grab" />
            {tenant && <PlanCard tenant={tenant} contact={contact} />}
            <div className="more-sheet__grid">
              {all.filter((i) => !MOBILE_MAIN.includes(i.to)).map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className="more-sheet__item"><span><Icon size={20} /></span>{label}</NavLink>
              ))}
              <a className="more-sheet__item" href={`/${tenant?.slug}`} target="_blank" rel="noreferrer"><span><ExternalLink size={20} /></span>Ver catálogo</a>
              <button className="more-sheet__item more-sheet__item--danger" onClick={signOut}><span><LogOut size={20} /></span>Cerrar sesión</button>
            </div>
          </div>
        </div>
      )}

      <TourHost userId={user?.id} />
    </div>
  )
}
