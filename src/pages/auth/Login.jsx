import '../../styles/shell.js'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'

const ERRORS = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Aún no confirmas tu correo. Revisa tu bandeja de entrada.',
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
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
    <AuthLayout>
      <form className="auth2__body" onSubmit={submit}>
        <div>
          <h2 className="auth2__h">Bienvenido de nuevo</h2>
          <p className="muted">Ingresa para administrar tu catálogo.</p>
        </div>

        <label className="field">
          <span>Correo</span>
          <div className="input-icon">
            <Mail size={17} />
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@gmail.com" />
          </div>
        </label>

        <div className="field">
          <span className="field__row">
            <label htmlFor="login-pw">Contraseña</label>
            <Link to="/recuperar" className="link-sm">¿La olvidaste?</Link>
          </span>
          <div className="input-icon">
            <Lock size={17} />
            <input id="login-pw" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="input-icon__btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {error && <p className="alert alert--error">{error}</p>}

        <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Ingresando…' : <>Ingresar <ArrowRight size={18} /></>}
        </button>

        <p className="auth2__alt">¿Aún no tienes catálogo? <Link to="/registro">Crea tu cuenta</Link></p>
      </form>
    </AuthLayout>
  )
}
