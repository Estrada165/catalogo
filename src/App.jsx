import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import QrRedirect from './pages/public/QrRedirect'
import AppStart from './pwa/AppStart'

const entry = (name) => lazy(() => import('./pages/entries').then((m) => ({ default: m[name] })))

const LoginPage = entry('LoginPage')
const RegisterPage = entry('RegisterPage')
const OnboardingPage = entry('OnboardingPage')
const PanelPage = entry('PanelPage')
const AdminPage = entry('AdminPage')
const PanelHome = entry('PanelHome')
const Products = entry('Products')
const AdminTenants = entry('AdminTenants')
const AdminRubros = entry('AdminRubros')
const AdminStorage = entry('AdminStorage')
const AdminSettings = entry('AdminSettings')
const Settings = entry('Settings')
const Appearance = entry('Appearance')
const Orders = entry('Orders')
const Bot = entry('Bot')
const QrPage = entry('QrPage')
const Analytics = entry('Analytics')
const Receipts = entry('Receipts')
const CatalogPage = lazy(() => import('./catalog/CatalogPage'))
const Recover = lazy(() => import('./pages/auth/Recover'))

function Blank() {
  return <div style={{ minHeight: '100vh' }} />
}

export default function App() {
  return (
    <Suspense fallback={<Blank />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/app" element={<AppStart />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/recuperar" element={<Recover />} />

        <Route path="/panel/bienvenida" element={<OnboardingPage />} />
        <Route path="/panel" element={<PanelPage />}>
          <Route index element={<PanelHome />} />
          <Route path="productos" element={<Products />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="boletas" element={<Receipts />} />
          <Route path="apariencia" element={<Appearance />} />
          <Route path="bot" element={<Bot />} />
          <Route path="qr" element={<QrPage />} />
          <Route path="analitica" element={<Analytics />} />
          <Route path="configuracion" element={<Settings />} />
        </Route>

        <Route path="/admin" element={<AdminPage />}>
          <Route index element={<AdminTenants />} />
          <Route path="rubros" element={<AdminRubros />} />
          <Route path="almacenamiento" element={<AdminStorage />} />
          <Route path="ajustes" element={<AdminSettings />} />
        </Route>

        <Route path="/q/:code" element={<QrRedirect />} />
        <Route path="/:slug" element={<CatalogPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
