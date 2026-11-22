import { Navigate, Route, Routes } from 'react-router-dom'
import { GuestOnly, RequireOwner, RequireSuperadmin } from './components/RouteGuards'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Onboarding from './pages/panel/Onboarding'
import PanelLayout from './pages/panel/PanelLayout'
import PanelHome from './pages/panel/PanelHome'
import ComingSoon from './pages/panel/ComingSoon'
import Products from './pages/panel/Products'
import AdminLayout from './pages/admin/AdminLayout'
import AdminTenants from './pages/admin/AdminTenants'
import Catalog from './pages/public/Catalog'
import QrRedirect from './pages/public/QrRedirect'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/registro" element={<GuestOnly><Register /></GuestOnly>} />

      <Route path="/panel/bienvenida" element={<RequireOwner needTenant={false}><Onboarding /></RequireOwner>} />
      <Route path="/panel" element={<RequireOwner><PanelLayout /></RequireOwner>}>
        <Route index element={<PanelHome />} />
        <Route path="productos" element={<Products />} />
        <Route path="pedidos" element={<ComingSoon title="Pedidos" phase="fase 3" />} />
        <Route path="apariencia" element={<ComingSoon title="Apariencia" phase="fase 2" />} />
        <Route path="bot" element={<ComingSoon title="Bot" phase="fase 5" />} />
        <Route path="qr" element={<ComingSoon title="Mi QR" phase="fase 4" />} />
        <Route path="analitica" element={<ComingSoon title="Analítica" phase="fase 4" />} />
        <Route path="configuracion" element={<ComingSoon title="Configuración" phase="fase 2" />} />
      </Route>

      <Route path="/admin" element={<RequireSuperadmin><AdminLayout /></RequireSuperadmin>}>
        <Route index element={<AdminTenants />} />
        <Route path="rubros" element={<ComingSoon title="Plantillas de rubro" phase="fase 2" />} />
      </Route>

      <Route path="/q/:code" element={<QrRedirect />} />
      <Route path="/:slug" element={<Catalog />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
