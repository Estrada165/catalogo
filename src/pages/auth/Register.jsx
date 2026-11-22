import '../../styles/shell.js'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, APP_NAME } from '../../lib/supabase'
import ThemeToggle from '../../components/ThemeToggle'

export default function Register() {
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (!/^9\d{8}$/.test(form.phone.replace(/\s/g, ''))) return setError('Ingresa un celular peruano válido (9 dígitos).')

    setBusy(true)
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.full_name.trim(), phone: form.phone.replace(/\s/g, '') },
        emailRedirectTo: `${window.location.origin}/panel/bienvenida`,
      },
    })
    setBusy(false)

    if (err) {
      setError(err.message.includes('already registered') ? 'Ese correo ya tiene una cuenta.' : err.message)
      return
    }
    if (!data.session) setSent(true)
  }

  if (sent) {
    return (
      <div className="auth">
        <div className="auth__top">
          <span className="brand">{APP_NAME}</span>
          <ThemeToggle />
        </div>
        <div className="card card--narrow auth__card">
          <h1 className="display">Revisa tu correo</h1>
          <p className="muted">
            Te enviamos un enlace a <strong>{form.email}</strong> para confirmar tu cuenta. Después podrás crear tu catálogo.
          </p>
          <Link className="btn btn--block" to="/login">Ir a iniciar sesión</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth">
      <div className="auth__top">
        <span className="brand">{APP_NAME}</span>
        <ThemeToggle />
      </div>

      <form className="card card--narrow auth__card" onSubmit={submit}>
        <h1 className="display">Crea tu cuenta</h1>
        <p className="muted">En el siguiente paso eliges tu rubro y el enlace de tu catálogo.</p>

        <label className="field">
          <span>Nombre completo</span>
          <input required autoComplete="name" value={form.full_name} onChange={set('full_name')} />
        </label>

        <label className="field">
          <span>Celular (WhatsApp)</span>
          <input required inputMode="numeric" autoComplete="tel" placeholder="9XXXXXXXX" value={form.phone} onChange={set('phone')} />
        </label>

        <label className="field">
          <span>Correo</span>
          <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input type="password" required autoComplete="new-password" minLength={8} value={form.password} onChange={set('password')} />
        </label>

        {error && <p className="alert alert--error">{error}</p>}

        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Creando cuenta…' : 'Continuar'}
        </button>

        <p className="auth__alt">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </form>
    </div>
  )
}
