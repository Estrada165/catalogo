import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, APP_NAME } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { isValidSlug, slugify } from '../../lib/utils'
import ThemeToggle from '../../components/ThemeToggle'
import Loader from '../../components/Loader'
import { IconCheck } from '../../components/icons'

export default function Onboarding() {
  const { profile, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  const [rubros, setRubros] = useState(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [rubro, setRubro] = useState('')
  const [slugState, setSlugState] = useState('idle')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    supabase
      .from('rubro_templates')
      .select('key, name, description')
      .eq('active', true)
      .order('sort')
      .then(({ data }) => setRubros(data || []))
  }, [])

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  useEffect(() => {
    clearTimeout(timer.current)
    if (!slug) return setSlugState('idle')
    if (!isValidSlug(slug)) return setSlugState('invalid')
    setSlugState('checking')
    timer.current = setTimeout(async () => {
      const { data } = await supabase.rpc('slug_available', { p_slug: slug })
      setSlugState(data ? 'ok' : 'taken')
    }, 400)
    return () => clearTimeout(timer.current)
  }, [slug])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!rubro) return setError('Elige el rubro de tu negocio.')
    if (slugState !== 'ok') return setError('Elige un enlace disponible.')
    setBusy(true)
    const { error: err } = await supabase.rpc('create_my_tenant', { p_name: name.trim(), p_slug: slug, p_rubro: rubro })
    if (err) {
      setBusy(false)
      setError(err.message)
      return
    }
    await refresh()
    navigate('/panel', { replace: true })
  }

  const hint = {
    idle: 'Solo minúsculas, números y guiones.',
    invalid: 'Mínimo 3 caracteres: minúsculas, números y guiones. Algunas palabras están reservadas.',
    checking: 'Verificando…',
    ok: 'Disponible',
    taken: 'Ese enlace ya está en uso.',
  }[slugState]

  return (
    <div className="auth">
      <div className="auth__top">
        <span className="brand">{APP_NAME}</span>
        <div className="row">
          <ThemeToggle />
          <button className="btn btn--ghost" onClick={signOut}>Salir</button>
        </div>
      </div>

      <form className="card auth__card onboarding" onSubmit={submit}>
        <h1 className="display">Hola{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
        <p className="muted">Configura tu negocio. Todo lo podrás cambiar después desde tu panel.</p>

        <label className="field">
          <span>Nombre del negocio</span>
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ferretería Don Pepe" />
        </label>

        <label className="field">
          <span>Enlace de tu catálogo</span>
          <div className="slug-input">
            <span className="slug-input__prefix">{window.location.host}/</span>
            <input
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }}
            />
          </div>
          <small className={`hint hint--${slugState}`}>
            {slugState === 'ok' && <IconCheck width={14} height={14} />} {hint}
          </small>
        </label>

        <div className="field">
          <span>Rubro</span>
          {!rubros ? (
            <Loader />
          ) : (
            <div className="rubro-grid">
              {rubros.map((r) => (
                <button
                  type="button"
                  key={r.key}
                  className={`rubro-card ${rubro === r.key ? 'is-active' : ''}`}
                  onClick={() => setRubro(r.key)}
                >
                  <strong>{r.name}</strong>
                  {r.description && <small>{r.description}</small>}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="alert alert--error">{error}</p>}

        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Creando tu catálogo…' : 'Crear mi catálogo'}
        </button>
      </form>
    </div>
  )
}
