import '../../styles/shell.js'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, Store, Hammer, ShoppingBasket, Sparkles, Flower2, Tv, User, Phone, Link2, LogOut, LayoutGrid,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { isValidSlug, slugify } from '../../lib/utils'
import ThemeToggle from '../../components/ThemeToggle'
import Loader from '../../components/Loader'

const RUBRO_ICON = { general: LayoutGrid, ferreteria: Hammer, abarrotes: ShoppingBasket, perfumeria: Sparkles, floreria: Flower2, streaming: Tv }
const STEPS = ['Tus datos', 'Tu negocio', 'Rubro']

export default function Onboarding() {
  const { profile, refresh, signOut, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [rubros, setRubros] = useState(null)
  const [form, setForm] = useState({ full_name: profile?.full_name || '', phone: profile?.phone || '', name: '', slug: '', rubro: '' })
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugState, setSlugState] = useState('idle')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('rubro_templates').select('key, name, description').eq('active', true).order('sort').then(({ data }) => setRubros(data || []))
  }, [])
  useEffect(() => { if (!slugTouched) set('slug', slugify(form.name)) }, [form.name, slugTouched])
  useEffect(() => {
    clearTimeout(timer.current)
    if (!form.slug) return setSlugState('idle')
    if (!isValidSlug(form.slug)) return setSlugState('invalid')
    setSlugState('checking')
    timer.current = setTimeout(async () => {
      const { data } = await supabase.rpc('slug_available', { p_slug: form.slug })
      setSlugState(data ? 'ok' : 'taken')
    }, 400)
    return () => clearTimeout(timer.current)
  }, [form.slug])

  const phone = form.phone.replace(/\s/g, '')
  const canNext = [
    form.full_name.trim().length >= 3 && /^9\d{8}$/.test(phone),
    form.name.trim().length >= 2 && slugState === 'ok',
    !!form.rubro,
  ][step]

  const next = async () => {
    setError('')
    if (!canNext) {
      setError(step === 0 ? 'Escribe tu nombre y un celular de 9 dígitos.' : step === 1 ? 'Ponle nombre a tu negocio y elige un enlace disponible.' : 'Elige el rubro de tu negocio.')
      return
    }
    if (step < 2) return setStep(step + 1)
    setBusy(true)
    const p = await supabase.from('profiles').update({ full_name: form.full_name.trim(), phone }).eq('id', user.id)
    if (p.error) { setBusy(false); return setError(p.error.message) }
    const { error: err } = await supabase.rpc('create_my_tenant', { p_name: form.name.trim(), p_slug: form.slug, p_rubro: form.rubro })
    if (err) { setBusy(false); return setError(err.message) }
    await refresh()
    navigate('/panel', { replace: true })
  }

  const hint = {
    idle: 'Solo minúsculas, números y guiones.',
    invalid: 'Mínimo 3 caracteres. Algunas palabras están reservadas.',
    checking: 'Verificando…',
    ok: 'Disponible',
    taken: 'Ese enlace ya está en uso.',
  }[slugState]

  return (
    <div className="gate">
      <div className="gate__top">
        <ThemeToggle />
        <button className="btn btn--ghost btn--sm" onClick={signOut}><LogOut size={15} /> Salir</button>
      </div>
      <div className="modal-card modal-card--wide" role="dialog" aria-modal="true" aria-labelledby="ob-title">
        <div className="steps-dots" aria-label={`Paso ${step + 1} de 3`}>
          {STEPS.map((s, i) => (
            <span key={s} className={i < step ? 'is-done' : i === step ? 'is-on' : ''}>
              <b>{i < step ? <Check size={13} /> : i + 1}</b>{s}
            </span>
          ))}
        </div>

        <div className="modal-card__body" key={step}>
          {step === 0 && (
            <>
              <h1 id="ob-title" className="modal-card__title">¡Bienvenido! Cuéntanos de ti</h1>
              <p className="muted">Con estos datos te contactamos para activar tu catálogo.</p>
              <label className="field">
                <span>Tu nombre completo</span>
                <div className="input-icon"><User size={17} /><input autoFocus value={form.full_name} maxLength={60} autoComplete="name" onChange={(e) => set('full_name', e.target.value)} /></div>
              </label>
              <label className="field">
                <span>Celular (WhatsApp)</span>
                <div className="input-icon"><Phone size={17} /><input inputMode="numeric" placeholder="9XXXXXXXX" maxLength={11} value={form.phone} autoComplete="tel" onChange={(e) => set('phone', e.target.value.replace(/[^\d\s]/g, ''))} /></div>
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <h1 id="ob-title" className="modal-card__title">Tu negocio</h1>
              <p className="muted">Todo esto lo podrás cambiar después desde tu panel.</p>
              <label className="field">
                <span>Nombre del negocio</span>
                <div className="input-icon"><Store size={17} /><input autoFocus value={form.name} maxLength={60} placeholder="Ferretería Don Pepe" onChange={(e) => set('name', e.target.value)} /></div>
              </label>
              <div className="field">
                <span>Enlace de tu catálogo</span>
                <div className="slug-input">
                  <Link2 size={16} className="slug-input__icon" />
                  <span className="slug-input__prefix">{window.location.host}/</span>
                  <input value={form.slug} maxLength={40} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }} />
                </div>
                <small className={`hint hint--${slugState}`}>{slugState === 'ok' && <Check size={14} />} {hint}</small>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 id="ob-title" className="modal-card__title">¿Qué vendes?</h1>
              <p className="muted">Te dejamos el catálogo casi listo para tu rubro. Lo que no te sirva lo apagas.</p>
              {!rubros ? <Loader /> : (
                <div className="rubro-grid">
                  {rubros.map((r) => {
                    const Icon = RUBRO_ICON[r.key] || Store
                    return (
                      <button type="button" key={r.key} className={`rubro-card ${form.rubro === r.key ? 'is-active' : ''}`} onClick={() => set('rubro', r.key)}>
                        <span className="rubro-card__icon"><Icon size={20} /></span>
                        <strong>{r.name}</strong>
                        {r.description && <small>{r.description}</small>}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
          {error && <p className="alert alert--error">{error}</p>}
        </div>

        <div className="modal-card__foot">
          {step > 0 ? <button className="btn btn--ghost" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={17} /> Atrás</button> : <span />}
          <button className="btn btn--primary" onClick={next} disabled={busy}>
            {busy ? 'Creando…' : step < 2 ? <>Siguiente <ArrowRight size={17} /></> : <>Crear mi catálogo <Check size={17} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
