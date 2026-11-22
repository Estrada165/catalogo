import '../styles/shell.js'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loader from './Loader'

function ProfileMissing() {
  const { signOut } = useAuth()
  return (
    <div className="center-screen">
      <div className="card card--narrow">
        <h2>No encontramos tu perfil</h2>
        <p className="muted">Tu usuario existe pero no tiene perfil asociado. Contacta al administrador.</p>
        <button className="btn" onClick={signOut}>Cerrar sesión</button>
      </div>
    </div>
  )
}

export function RequireOwner({ children, needTenant = true }) {
  const { user, profile, tenant, isSuperadmin, loading } = useAuth()
  if (loading) return <Loader full />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <ProfileMissing />
  if (isSuperadmin) return <Navigate to="/admin" replace />
  if (needTenant && !tenant) return <Navigate to="/panel/bienvenida" replace />
  if (!needTenant && tenant) return <Navigate to="/panel" replace />
  return children
}

export function RequireSuperadmin({ children }) {
  const { user, profile, isSuperadmin, loading } = useAuth()
  if (loading) return <Loader full />
  if (!user) return <Navigate to="/login" replace />
  if (!isSuperadmin) return <Navigate to="/panel" replace />
  return children
}

export function GuestOnly({ children }) {
  const { user, profile, isSuperadmin, loading } = useAuth()
  if (loading) return <Loader full />
  if (user) return <Navigate to={isSuperadmin ? '/admin' : '/panel'} replace />
  return children
}
