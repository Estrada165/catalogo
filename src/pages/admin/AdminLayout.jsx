import '../../styles/shell.js'
import { NavLink, Outlet } from 'react-router-dom'
import { APP_NAME } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../../components/ThemeToggle'
import { IconUsers, IconLayers, IconLogout } from '../../components/icons'

export default function AdminLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="shell shell--admin">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="brand">{APP_NAME}</span>
          <small className="pill pill--accent">Superadmin</small>
        </div>

        <nav className="sidebar__nav">
          <NavLink to="/admin" end className="nav-item">
            <IconUsers />
            <span>Negocios</span>
          </NavLink>
          <NavLink to="/admin/rubros" className="nav-item">
            <IconLayers />
            <span>Plantillas de rubro</span>
          </NavLink>
        </nav>

        <div className="sidebar__foot">
          <small className="muted">{profile?.full_name}</small>
          <div className="row">
            <ThemeToggle />
            <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      <header className="mobile-bar">
        <span className="brand">{APP_NAME}</span>
        <div className="row">
          <ThemeToggle />
          <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
            <IconLogout />
          </button>
        </div>
      </header>

      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  )
}
