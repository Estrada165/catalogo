import { Link, useLocation } from 'react-router-dom'
import { Store, MessageCircle, Palette, QrCode, Bot, BarChart3 } from 'lucide-react'
import ThemeToggle from '../../components/ThemeToggle'

const FEATURES = [
  { icon: Store, text: 'Tu catálogo con tu marca, para cualquier rubro' },
  { icon: MessageCircle, text: 'Pedidos directos a tu WhatsApp' },
  { icon: Bot, text: 'Un asistente que responde por ti' },
  { icon: QrCode, text: 'QR listo para imprimir' },
  { icon: Palette, text: 'Colores, letras y secciones a tu gusto' },
  { icon: BarChart3, text: 'Visitas y pedidos en un vistazo' },
]

export default function AuthLayout({ children, tabs = true }) {
  const { pathname } = useLocation()
  const isRegister = pathname.startsWith('/registro')

  return (
    <div className="auth2">
      <div className="auth2__top">
        <ThemeToggle />
      </div>
      <div className="auth2__frame">
        <aside className="auth2__brand">
          <span className="auth2__dots" aria-hidden="true" />
          <div className="auth2__brand-top">
            <span className="auth2__mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="22" height="22"><rect x="4" y="4" width="10" height="10" rx="3" fill="currentColor" /><rect x="18" y="4" width="10" height="10" rx="3" fill="currentColor" opacity=".55" /><rect x="4" y="18" width="10" height="10" rx="3" fill="currentColor" opacity=".55" /><rect x="18" y="18" width="10" height="10" rx="5" fill="currentColor" /></svg>
            </span>
            <span className="auth2__eyebrow">Catálogo multinegocio</span>
          </div>
          <div>
            <h1 className="auth2__title">Tu negocio, en un enlace.</h1>
            <p className="auth2__lead">Muestra tus productos, recibe pedidos por WhatsApp y deja que tu catálogo trabaje por ti.</p>
            <ul className="auth2__features">
              {FEATURES.map(({ icon: Icon, text }, i) => (
                <li key={text} style={{ '--i': i }}><span><Icon size={16} /></span>{text}</li>
              ))}
            </ul>
          </div>
          <small className="auth2__foot">Ferreterías, perfumerías, florerías, bodegas, streaming y más.</small>
        </aside>

        <main className="auth2__form">
          <div className="auth2__head">
            <span className="auth2__eyebrow auth2__eyebrow--solo">Catálogo multinegocio</span>
            {tabs && (
              <nav className="auth2__tabs" aria-label="Acceso">
                <Link to="/login" className={!isRegister ? 'is-on' : ''} aria-current={!isRegister ? 'page' : undefined}>Ingresar</Link>
                <Link to="/registro" className={isRegister ? 'is-on' : ''} aria-current={isRegister ? 'page' : undefined}>Crear cuenta</Link>
                <span className="auth2__tabs-ind" style={{ transform: `translateX(${isRegister ? 100 : 0}%)` }} aria-hidden="true" />
              </nav>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
