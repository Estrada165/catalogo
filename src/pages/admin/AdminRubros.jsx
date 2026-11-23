import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Switch from '../../components/Switch'
import Loader from '../../components/Loader'
import { IconClose, IconEdit, IconPlus, IconTrash } from '../../components/icons'
import { Field } from '../panel/ui'
import Dropdown from '../../components/Dropdown'

const MODULES = [
  ['stock', 'Control de stock'], ['peso', 'Venta por peso o medida'], ['delivery', 'Delivery'], ['pedidos', 'Registro de pedidos'],
  ['bot', 'Asistente Lu'], ['qr', 'Mi QR'], ['analitica', 'Analítica'],
]
const STYLES = ['industrial', 'editorial', 'fresco', 'glamour', 'suave', 'neon']
const CHECKOUT = [
  ['ask_name', 'Pedir nombre'], ['ask_phone', 'Pedir celular'], ['ask_address', 'Pedir dirección'],
  ['allow_delivery', 'Permite delivery'], ['allow_pickup', 'Permite recojo'], ['ask_date', 'Pedir fecha de entrega'], ['ask_dedication', 'Pedir dedicatoria'],
]
const BASE_SECTIONS = ['hero', 'featured', 'categories', 'products', 'promos', 'hours', 'location', 'faq', 'policies', 'social']

function toForm(t) {
  const cfg = t?.config_base || {}
  return {
    id: t?.id,
    key: t?.key || '',
    name: t?.name || '',
    description: t?.description || '',
    active: t?.active !== false,
    sort: t?.sort ?? 0,
    accent: cfg.theme?.accent || '#FF6B35',
    style: cfg.theme?.style || 'industrial',
    mode: cfg.theme?.mode || 'auto',
    modules: { pedidos: true, bot: true, qr: true, analitica: true, delivery: true, ...(cfg.modules || {}) },
    checkout: { ask_name: true, ask_address: true, allow_delivery: true, allow_pickup: true, ...(cfg.checkout || {}) },
    sections: cfg.sections?.length ? cfg.sections : BASE_SECTIONS.map((type, i) => ({ id: type, type, enabled: !['promos', 'location', 'policies'].includes(type), order: i, props: {} })),
    bot: { enabled: true, name: 'Lu', greeting: '', ...(cfg.bot || {}) },
    categories: (t?.categories_base || []).join('\n'),
    faqs: t?.faqs_base || [],
  }
}

export default function AdminRubros() {
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null)
  const [counts, setCounts] = useState({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [t, n] = await Promise.all([
      supabase.from('rubro_templates').select('*').order('sort'),
      supabase.from('tenants').select('rubro_key'),
    ])
    if (t.error) setError(t.error.message)
    setRows(t.data || [])
    const c = {}
    ;(n.data || []).forEach((x) => { c[x.rubro_key] = (c[x.rubro_key] || 0) + 1 })
    setCounts(c)
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (f) => {
    const row = {
      key: f.key,
      name: f.name.trim(),
      description: f.description.trim() || null,
      active: f.active,
      sort: Number(f.sort) || 0,
      config_base: {
        theme: { accent: f.accent, style: f.style, mode: f.mode },
        modules: f.modules,
        sections: f.sections,
        checkout: { ...f.checkout, payment_methods: [] },
        bot: f.bot,
      },
      categories_base: f.categories.split('\n').map((x) => x.trim()).filter(Boolean),
      faqs_base: f.faqs.filter((x) => x.question?.trim() && x.answer?.trim()),
    }
    const q = f.id ? supabase.from('rubro_templates').update(row).eq('id', f.id) : supabase.from('rubro_templates').insert(row)
    const { error: err } = await q
    if (err) throw err
    setEditing(null)
    load()
  }

  return (
    <div className="page">
      <header className="page__head page__head--split">
        <h1 className="display">Plantillas de rubro</h1>
        <button className="btn btn--primary" onClick={() => setEditing(toForm(null))}><IconPlus /> Nueva plantilla</button>
      </header>
      <p className="muted page__lead">Es el punto de partida de cada negocio al registrarse. Cambiar una plantilla no afecta a los negocios que ya la usan.</p>
      {error && <p className="alert alert--error">{error}</p>}
      {!rows ? <Loader /> : (
        <ul className="cat-list">
          {rows.map((t) => (
            <li key={t.id} className={`section-row ${t.active ? '' : 'is-hidden'}`}>
              <span className="swatch swatch--sm" style={{ '--c': t.config_base?.theme?.accent || '#999' }} />
              <div className="section-row__info">
                <strong>{t.name} <small className="muted">· {t.key}</small></strong>
                <small className="muted">{t.description || 'Sin descripción'} · {counts[t.key] || 0} negocios</small>
              </div>
              <button className="icon-btn" onClick={() => setEditing(toForm(t))} aria-label="Editar"><IconEdit width={16} height={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {editing && <RubroEditor form={editing} isNew={!editing.id} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  )
}

function RubroEditor({ form, isNew, onClose, onSave }) {
  const [f, setF] = useState(form)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const submit = async () => {
    if (!/^[a-z0-9-]{3,30}$/.test(f.key)) return setError('La clave debe tener de 3 a 30 letras minúsculas, números o guiones.')
    if (!f.name.trim()) return setError('Ponle un nombre.')
    setBusy(true)
    setError('')
    try { await onSave(f) } catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <div className="drawer" role="dialog" aria-modal="true">
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel">
        <header className="drawer__head">
          <h2 className="display">{isNew ? 'Nueva plantilla' : f.name}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
        </header>
        <div className="drawer__body">
          <section className="form-block">
            <div className="form-grid">
              <Field label="Nombre"><input value={f.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} /></Field>
              <Field label="Clave" hint={isNew ? 'No se puede cambiar después' : 'Fija'}><input value={f.key} disabled={!isNew} maxLength={30} onChange={(e) => set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /></Field>
            </div>
            <Field label="Descripción (se ve al elegir el rubro)"><input value={f.description} maxLength={120} onChange={(e) => set({ description: e.target.value })} /></Field>
            <div className="form-grid">
              <Field label="Orden"><input type="number" value={f.sort} onChange={(e) => set({ sort: e.target.value })} /></Field>
              <div className="field field--switches"><Switch checked={f.active} onChange={(v) => set({ active: v })} label="Disponible al registrarse" /></div>
            </div>
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Estilo por defecto</h3>
            <div className="form-grid">
              <Field label="Color"><input type="color" value={f.accent} onChange={(e) => set({ accent: e.target.value.toUpperCase() })} /></Field>
              <Field label="Estilo"><Dropdown ariaLabel="Estilo" value={f.style} onChange={(v) => set({ style: v })} options={STYLES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} /></Field>
              <Field label="Modo"><Dropdown ariaLabel="Modo" value={f.mode} onChange={(v) => set({ mode: v })} options={[{ value: 'auto', label: 'Según el dispositivo' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]} /></Field>
            </div>
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Módulos</h3>
            <div className="switch-grid">{MODULES.map(([k, l]) => <Switch key={k} checked={!!f.modules[k]} onChange={(v) => set({ modules: { ...f.modules, [k]: v } })} label={l} />)}</div>
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Pedido</h3>
            <div className="switch-grid">{CHECKOUT.map(([k, l]) => <Switch key={k} checked={!!f.checkout[k]} onChange={(v) => set({ checkout: { ...f.checkout, [k]: v } })} label={l} />)}</div>
            <Field label="Primera línea del mensaje de WhatsApp"><input value={f.checkout.message_header || ''} maxLength={120} onChange={(e) => set({ checkout: { ...f.checkout, message_header: e.target.value } })} /></Field>
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Secciones activas</h3>
            <div className="switch-grid">{f.sections.map((s) => (
              <Switch key={s.type} checked={s.enabled} disabled={['hero', 'products'].includes(s.type)} label={s.type}
                onChange={(v) => set({ sections: f.sections.map((x) => (x.type === s.type ? { ...x, enabled: v } : x)) })} />
            ))}</div>
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Categorías iniciales</h3>
            <textarea rows={5} value={f.categories} placeholder="Una por línea" onChange={(e) => set({ categories: e.target.value })} />
          </section>

          <section className="form-block">
            <div className="form-block__head">
              <h3 className="form-block__title">Asistente</h3>
            </div>
            <Field label="Saludo de Lu para este rubro"><input value={f.bot.greeting || ''} maxLength={200} onChange={(e) => set({ bot: { ...f.bot, greeting: e.target.value } })} /></Field>
            <div className="form-block__head">
              <h3 className="form-block__title">Preguntas frecuentes iniciales</h3>
              <button className="btn btn--sm" onClick={() => set({ faqs: [...f.faqs, { question: '', answer: '', keywords: [] }] })}><IconPlus width={14} height={14} /> Pregunta</button>
            </div>
            {f.faqs.map((q, i) => (
              <div key={i} className="variant">
                <div className="stack">
                  <input placeholder="Pregunta" value={q.question} onChange={(e) => set({ faqs: f.faqs.map((x, k) => (k === i ? { ...x, question: e.target.value } : x)) })} />
                  <textarea rows={2} placeholder="Respuesta" value={q.answer} onChange={(e) => set({ faqs: f.faqs.map((x, k) => (k === i ? { ...x, answer: e.target.value } : x)) })} />
                  <input placeholder="Palabras clave separadas por coma" value={(q.keywords || []).join(', ')} onChange={(e) => set({ faqs: f.faqs.map((x, k) => (k === i ? { ...x, keywords: e.target.value.split(',').map((w) => w.trim()).filter(Boolean) } : x)) })} />
                </div>
                <button className="icon-btn variant__remove" onClick={() => set({ faqs: f.faqs.filter((_, k) => k !== i) })} aria-label="Quitar"><IconTrash width={16} height={16} /></button>
              </div>
            ))}
          </section>
        </div>
        <footer className="drawer__foot">
          {error && <p className="alert alert--error">{error}</p>}
          <div className="row row--end">
            <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn--primary" onClick={submit} disabled={busy}>{busy ? 'Guardando…' : 'Guardar plantilla'}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
