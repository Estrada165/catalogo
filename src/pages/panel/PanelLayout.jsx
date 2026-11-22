import '../../styles/shell.js'
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase, APP_NAME } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../../components/ThemeToggle'
import {
  IconHome, IconBox, IconBag, IconPalette, IconChat, IconQr, IconChart, IconSettings, IconLogout, IconExternal,
} from '../../components/icons'

const NAV = [
  { to: '/panel', label: 'Inicio', icon: IconHome, end: true },
  { to: '/panel/productos', label: 'Productos', icon: IconBox },
  { to: '/panel/pedidos', label: 'Pedidos', icon: IconBag, module: 'pedidos' },
  { to: '/panel/apariencia', label: 'Apariencia', icon: IconPalette },
  { to: '/panel/bot', label: 'Bot', icon: IconChat, module: 'bot' },
  { to: '/panel/qr', label: 'Mi QR', icon: IconQr, module: 'qr' },
  { to: '/panel/analitica', label: 'Analítica', icon: IconChart, module: 'analitica' },
  { to: '/panel/configuracion', label: 'Configuración', icon: IconSettings },
]

export default function PanelLayout() {
  const { tenant, signOut } = useAuth()
  const [config, setConfig] = useState(null)

  const reloadConfig = useCallback(async () => {
    if (!tenant) return
    const { data } = await supabase.from('tenant_config').select('*').eq('tenant_id', tenant.id).maybeSingle()
    setConfig(data)
  }, [tenant])

  useEffect(() => {
    reloadConfig()
  }, [reloadConfig])

  // Guarda una o varias columnas de tenant_config (business, theme, sections, modules, checkout, bot)
  const saveConfig = useCallback(
    async (patch) => {
      const { data, error } = await supabase.from('tenant_config').update(patch).eq('tenant_id', tenant.id).select().single()
      if (error) throw error
      setConfig(data)
      return data
    },
    [tenant]
  )

  const modules = config?.modules || {}
  const items = NAV.filter((i) => !i.module || modules[i.module] !== false)

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="brand">{APP_NAME}</span>
          <small className="muted">{tenant?.name}</small>
        </div>

        <nav className="sidebar__nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-item">
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <a className="nav-item" href={`/${tenant?.slug}`} target="_blank" rel="noreferrer">
            <IconExternal />
            <span>Ver catálogo</span>
          </a>
          <div className="row">
            <ThemeToggle />
            <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      <header className="mobile-bar">
        <span className="brand">{tenant?.name}</span>
        <div className="row">
          <ThemeToggle />
          <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
            <IconLogout />
          </button>
        </div>
      </header>

      <main className="shell__main">
        <Outlet context={{ config, setConfig, saveConfig, reloadConfig }} />
      </main>
    </div>
  )
}
