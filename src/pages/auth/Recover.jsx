import '../../styles/shell.js'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'

// Dos momentos: pedir el enlace por correo, y (al volver desde ese enlace) poner la nueva contraseña
export default function Recover() {
  const navigate = useNavigate()
  const [mode, setMode] = useState(() => (window.location.hash.includes('type=recovery') ? 'reset' : 'ask'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('reset')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const ask = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/recuperar` })
    setBusy(false)
    if (err) return setError(err.message)
    setMsg('Si el correo tiene una cuenta, te llegará un enlace para crear una nueva contraseña.')
  }

  const reset = async (e) => {
    e.preventDefault()
    if (password.length < 8 || !/\d/.test(password)) return setError('Usa mínimo 8 caracteres y al menos un número.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) return setError(err.message)
    setMsg('Listo, tu contraseña se actualizó.')
    setTimeout(() => navigate('/panel', { replace: true }), 1200)
  }

  return (
    <AuthLayout tabs={false}>
      {mode === 'ask' ? (
        <form className="auth2__body" onSubmit={ask}>
          <div>
            <h2 className="auth2__h">Recupera tu acceso</h2>
            <p className="muted">Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.</p>
          </div>
          <label className="field">
            <span>Correo</span>
            <div className="input-icon"><Mail size={17} /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </label>
          {error && <p className="alert alert--error">{error}</p>}
          {msg && <p className="alert alert--ok"><Check size={16} /> {msg}</p>}
          <button className="btn btn--primary btn--block btn--lg" disabled={busy || !!msg}>{busy ? 'Enviando…' : <>Enviar enlace <ArrowRight size={18} /></>}</button>
          <p className="auth2__alt"><Link to="/login">Volver a ingresar</Link></p>
        </form>
      ) : (
        <form className="auth2__body" onSubmit={reset}>
          <div>
            <h2 className="auth2__h">Nueva contraseña</h2>
            <p className="muted">Elige una contraseña que no uses en otros sitios.</p>
          </div>
          <label className="field">
            <span>Contraseña nueva</span>
            <div className="input-icon"><Lock size={17} /><input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          </label>
          {error && <p className="alert alert--error">{error}</p>}
          {msg && <p className="alert alert--ok"><Check size={16} /> {msg}</p>}
          <button className="btn btn--primary btn--block btn--lg" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      )}
    </AuthLayout>
  )
}
