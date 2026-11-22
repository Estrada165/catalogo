import '../../styles/shell.js'
import { NavLink, Outlet } from 'react-router-dom'
import { Users, Layers, HardDrive, Settings, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../../components/ThemeToggle'

const ITEMS = [
  { to: '/admin', label: 'Negocios', icon: Users, end: true },
  { to: '/admin/rubros', label: 'Plantillas de rubro', icon: Layers },
  { to: '/admin/almacenamiento', label: 'Almacenamiento', icon: HardDrive },
  { to: '/admin/ajustes', label: 'Ajustes', icon: Settings },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()

  const item = ({ to, label, icon: Icon, end }) => (
    <NavLink key={to} to={to} end={end} className="nav2">
      <span className="nav2__pill"><Icon size={18} strokeWidth={1.9} /></span>
      <span>{label}</span>
    </NavLink>
  )

  return (
    <div className="shell2">
      <aside className="side2">
        <div className="side2__brand">
          <span className="side2__initial"><ShieldCheck size={20} /></span>
          <div>
            <strong>Superadmin</strong>
            <span className="muted">Catálogo multinegocio</span>
          </div>
        </div>
        <nav className="side2__nav">
          <div className="side2__group">
            <p className="side2__label">Plataforma</p>
            {ITEMS.map(item)}
          </div>
        </nav>
        <div className="side2__foot">
          <small className="muted side2__who">{profile?.full_name || 'Administrador'}</small>
          <div className="side2__tools">
            <ThemeToggle />
            <button className="icon-btn icon-btn--danger" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      <header className="top2">
        <div className="top2__brand"><span className="side2__initial"><ShieldCheck size={18} /></span><strong>Superadmin</strong></div>
        <div className="row">
          <ThemeToggle />
          <button className="icon-btn icon-btn--danger" onClick={signOut} aria-label="Cerrar sesión"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="main2">
        <Outlet />
      </main>

      <nav className="bottom2" aria-label="Menú">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottom2__item"><Icon size={20} /><span>{label.split(' ')[0]}</span></NavLink>
        ))}
      </nav>
    </div>
  )
}
