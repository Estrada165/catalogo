// Puertas de entrada del panel, login y superadmin.
// Se cargan en un bloque aparte para que el catálogo público no descargue nada de esto.
import { GuestOnly, RequireOwner, RequireSuperadmin } from '../components/RouteGuards'
import Login from './auth/Login'
import Register from './auth/Register'
import Onboarding from './panel/Onboarding'
import PanelLayout from './panel/PanelLayout'
import AdminLayout from './admin/AdminLayout'

export { default as PanelHome } from './panel/PanelHome'
export { default as Products } from './panel/Products'
export { default as AdminTenants } from './admin/AdminTenants'
export { default as AdminRubros } from './admin/AdminRubros'
export { default as AdminStorage } from './admin/AdminStorage'
export { default as AdminSettings } from './admin/AdminSettings'
export { default as Settings } from './panel/Settings'
export { default as Appearance } from './panel/Appearance'
export { default as Orders } from './panel/Orders'
export { default as Bot } from './panel/Bot'
export { default as QrPage } from './panel/QrPage'
export { default as Analytics } from './panel/Analytics'

export const LoginPage = () => <GuestOnly><Login /></GuestOnly>
export const RegisterPage = () => <GuestOnly><Register /></GuestOnly>
export const OnboardingPage = () => <RequireOwner needTenant={false}><Onboarding /></RequireOwner>
export const PanelPage = () => <RequireOwner><PanelLayout /></RequireOwner>
export const AdminPage = () => <RequireSuperadmin><AdminLayout /></RequireSuperadmin>
