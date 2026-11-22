import '../styles/shell.js'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loader from './Loader'
import AccountGate, { gateState } from './AccountGate'

function ProfileMissing() {
  const { signOut, authError, refresh, user } = useAuth()
  return (
    <div className="center-screen">
      <div className="card card--narrow">
        <h2>No encontramos tu perfil</h2>
        {authError ? (
          <>
            <p className="muted">Supabase respondió con un error al leer tu perfil:</p>
            <code className="err-code">{authError}</code>
            {/42501|permission denied/i.test(authError) && (
              <p className="muted">Faltan permisos de la API sobre las tablas. Ejecuta el bloque de permisos (GRANT) en el SQL Editor de Supabase.</p>
            )}
          </>
        ) : (
          <p className="muted">Tu usuario existe pero no tiene perfil en la tabla profiles. Crea la fila para este usuario o contacta al administrador.</p>
        )}
        <small className="muted">ID de usuario: {user?.id}</small>
        <div className="row">
          <button className="btn" onClick={refresh}>Reintentar</button>
          <button className="btn btn--ghost" onClick={signOut}>Cerrar sesión</button>
        </div>
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
  const gate = needTenant && gateState(tenant)
  if (gate) return <AccountGate state={gate} />
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
