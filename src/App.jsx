import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import QrRedirect from './pages/public/QrRedirect'

const entry = (name) => lazy(() => import('./pages/entries').then((m) => ({ default: m[name] })))

const LoginPage = entry('LoginPage')
const RegisterPage = entry('RegisterPage')
const OnboardingPage = entry('OnboardingPage')
const PanelPage = entry('PanelPage')
const AdminPage = entry('AdminPage')
const PanelHome = entry('PanelHome')
const Products = entry('Products')
const ComingSoon = entry('ComingSoon')
const AdminTenants = entry('AdminTenants')
const CatalogPage = lazy(() => import('./catalog/CatalogPage'))

function Blank() {
  return <div style={{ minHeight: '100vh' }} />
}

export default function App() {
  return (
    <Suspense fallback={<Blank />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />

        <Route path="/panel/bienvenida" element={<OnboardingPage />} />
        <Route path="/panel" element={<PanelPage />}>
          <Route index element={<PanelHome />} />
          <Route path="productos" element={<Products />} />
          <Route path="pedidos" element={<ComingSoon title="Pedidos" phase="fase 3" />} />
          <Route path="apariencia" element={<ComingSoon title="Apariencia" phase="fase 2" />} />
          <Route path="bot" element={<ComingSoon title="Bot" phase="fase 5" />} />
          <Route path="qr" element={<ComingSoon title="Mi QR" phase="fase 4" />} />
          <Route path="analitica" element={<ComingSoon title="Analítica" phase="fase 4" />} />
          <Route path="configuracion" element={<ComingSoon title="Configuración" phase="fase 2" />} />
        </Route>

        <Route path="/admin" element={<AdminPage />}>
          <Route index element={<AdminTenants />} />
          <Route path="rubros" element={<ComingSoon title="Plantillas de rubro" phase="fase 2" />} />
        </Route>

        <Route path="/q/:code" element={<QrRedirect />} />
        <Route path="/:slug" element={<CatalogPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
