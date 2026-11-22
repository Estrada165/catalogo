import '../../styles/shell.js'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, APP_NAME } from '../../lib/supabase'
import ThemeToggle from '../../components/ThemeToggle'

const ERRORS = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Aún no confirmas tu correo. Revisa tu bandeja de entrada.',
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (err) setError(ERRORS[err.message] || err.message)
  }

  return (
    <div className="auth">
      <div className="auth__top">
        <span className="brand">{APP_NAME}</span>
        <ThemeToggle />
      </div>

      <form className="card card--narrow auth__card" onSubmit={submit}>
        <h1 className="display">Inicia sesión</h1>
        <p className="muted">Administra tu catálogo desde tu panel.</p>

        <label className="field">
          <span>Correo</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {error && <p className="alert alert--error">{error}</p>}

        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>

        <p className="auth__alt">
          ¿Aún no tienes catálogo? <Link to="/registro">Crea tu cuenta</Link>
        </p>
      </form>
    </div>
  )
}
