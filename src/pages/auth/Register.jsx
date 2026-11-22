import '../../styles/shell.js'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, ArrowRight, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const rules = [
    { ok: password.length >= 8, text: 'Mínimo 8 caracteres' },
    { ok: /\d/.test(password), text: 'Al menos un número' },
  ]

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (rules.some((r) => !r.ok)) return setError('La contraseña aún no cumple los requisitos.')
    setBusy(true)
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/panel` },
    })
    setBusy(false)
    if (err) {
      setError(/already registered|already exists/i.test(err.message) ? 'Ese correo ya tiene una cuenta. Ingresa con él.' : err.message)
      return
    }
    // Con la confirmación de correo apagada entra directo: el panel abre el registro del negocio
    if (!data.session) setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout tabs={false}>
        <div className="auth2__body">
          <span className="auth2__badge"><Mail size={22} /></span>
          <h2 className="auth2__h">Revisa tu correo</h2>
          <p className="muted">Te enviamos un enlace a <strong>{email}</strong> para confirmar tu cuenta. Después podrás registrar tu negocio.</p>
          <Link className="btn btn--block" to="/login">Volver a ingresar</Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <form className="auth2__body" onSubmit={submit}>
        <div>
          <h2 className="auth2__h">Crea tu cuenta</h2>
          <p className="muted">Solo tu correo y una contraseña. Los datos de tu negocio los completas en el siguiente paso.</p>
        </div>

        <label className="field">
          <span>Correo</span>
          <div className="input-icon">
            <Mail size={17} />
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@gmail.com" />
          </div>
        </label>

        <label className="field">
          <span>Contraseña</span>
          <div className="input-icon">
            <Lock size={17} />
            <input type={show ? 'text' : 'password'} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="input-icon__btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <ul className="pw-rules">
            {rules.map((r) => <li key={r.text} className={r.ok ? 'is-ok' : ''}><Check size={13} /> {r.text}</li>)}
          </ul>
        </label>

        {error && <p className="alert alert--error">{error}</p>}

        <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Creando cuenta…' : <>Continuar <ArrowRight size={18} /></>}
        </button>

        <p className="auth2__alt">¿Ya tienes cuenta? <Link to="/login">Ingresa</Link></p>
      </form>
    </AuthLayout>
  )
}
