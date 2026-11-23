import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// La app instalada abre aquí: va al admin, al panel o al ingreso según la sesión
export default function AppStart() {
  const { session, isSuperadmin, loading } = useAuth()
  if (loading) return <div className="app-start" aria-busy="true" />
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={isSuperadmin ? '/admin' : '/panel'} replace />
}
