import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Switch from '../../components/Switch'
import Loader from '../../components/Loader'
import { IconArrowDown, IconArrowUp, IconClose, IconEdit, IconPlus, IconTrash } from '../../components/icons'
import { Field, ImagePicker, SaveBar, Section, Tabs, useDraft, useSaver } from './ui'

const TABS = [
  { key: 'preguntas', label: 'Preguntas frecuentes' },
  { key: 'bandeja', label: 'Sin respuesta' },
  { key: 'perfil', label: 'Perfil de Lu' },
]

export default function Bot() {
  const { tenant } = useAuth()
  const [tab, setTab] = useState('preguntas')
  const [faqs, setFaqs] = useState(null)
  const [inbox, setInbox] = useState(null)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [f, u] = await Promise.all([
      supabase.from('bot_faqs').select('*').eq('tenant_id', tenant.id).order('sort'),
      supabase.from('bot_unanswered').select('*').eq('tenant_id', tenant.id).eq('resolved', false).order('created_at', { ascending: false }).limit(200),
    ])
    setFaqs(f.data || [])
    setInbox(u.data || [])
  }, [tenant.id])
  useEffect(() => { load() }, [load])

  const run = async (q) => {
    setError('')
    const { error: err } = await q
    if (err) setError(err.message)
    await load()
  }

  const move = (i, dir) => {
    const arr = [...faqs]
    const to = i + dir
    if (to < 0 || to >= arr.length) return
    ;[arr[i], arr[to]] = [arr[to], arr[i]]
    run(supabase.from('bot_faqs').upsert(arr.map((f, k) => ({ ...f, sort: k }))))
  }

  const saveFaq = async (f) => {
    const row = { tenant_id: tenant.id, question: f.question.trim(), answer: f.answer.trim(), keywords: f.keywords, active: f.active }
    if (f.id) await run(supabase.from('bot_faqs').update(row).eq('id', f.id))
    else await run(supabase.from('bot_faqs').insert({ ...row, sort: faqs.length }))
    if (f.fromInbox) await run(supabase.from('bot_unanswered').update({ resolved: true }).eq('id', f.fromInbox))
    setEditing(null)
  }

  return (
    <div className="page page--narrow">
      <header className="page__head">
        <h1 className="display">Bot</h1>
        {inbox?.length > 0 && <span className="pill pill--warn">{inbox.length} sin respuesta</span>}
      </header>
      <p className="muted page__lead">Lu responde sola con tus productos, precios, stock, horario, delivery, pagos y dirección. Aquí agregas respuestas para lo demás.</p>
      <div data-tour="bot-tabs"><Tabs tabs={TABS.map((t) => (t.key === 'bandeja' && inbox?.length ? { ...t, label: `${t.label} (${inbox.length})` } : t))} value={tab} onChange={setTab} /></div>
      {error && <p className="alert alert--error">{error}</p>}

      {tab === 'perfil' ? <ProfileTab /> : !faqs ? <Loader /> : tab === 'preguntas' ? (
        <Section
          title="Preguntas frecuentes"
          hint="También se muestran en el catálogo (si la sección está activa). Las palabras clave ayudan a Lu a reconocer la pregunta aunque la escriban distinto."
          action={<button className="btn btn--sm btn--primary" onClick={() => setEditing({ question: '', answer: '', keywords: [], active: true })}><IconPlus width={16} height={16} /> Pregunta</button>}
        >
          {faqs.length === 0 ? <p className="muted">Aún no tienes preguntas frecuentes.</p> : (
            <ul className="cat-list">
              {faqs.map((f, i) => (
                <li key={f.id} className={`section-row ${f.active ? '' : 'is-hidden'}`}>
                  <div className="cat-row__order">
                    <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><IconArrowUp width={16} height={16} /></button>
                    <button className="icon-btn" disabled={i === faqs.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><IconArrowDown width={16} height={16} /></button>
                  </div>
                  <div className="section-row__info">
                    <strong>{f.question}</strong>
                    <small className="muted clamp-2">{f.answer}</small>
                    {f.keywords?.length > 0 && <div className="mini-tags">{f.keywords.map((k) => <span key={k}>{k}</span>)}</div>}
                  </div>
                  <Switch checked={f.active} onChange={(v) => run(supabase.from('bot_faqs').update({ active: v }).eq('id', f.id))} />
                  <button className="icon-btn" onClick={() => setEditing(f)} aria-label="Editar"><IconEdit width={16} height={16} /></button>
                  <button className="icon-btn" onClick={() => run(supabase.from('bot_faqs').delete().eq('id', f.id))} aria-label="Eliminar"><IconTrash width={16} height={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : (
        <Section title="Preguntas que Lu no supo responder" hint="Respóndelas una vez y Lu ya sabrá qué decir la próxima vez. Si es un producto que no vendes, puedes descartarla.">
          {inbox.length === 0 ? <p className="muted">Todo al día. No hay preguntas pendientes.</p> : (
            <ul className="cat-list">
              {inbox.map((u) => (
                <li key={u.id} className="section-row">
                  <div className="section-row__info">
                    <strong>“{u.question}”</strong>
                    <small className="muted">{new Date(u.created_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}</small>
                  </div>
                  <button className="btn btn--sm btn--primary" onClick={() => setEditing({ question: u.question, answer: '', keywords: [], active: true, fromInbox: u.id })}>Responder</button>
                  <button className="icon-btn" onClick={() => run(supabase.from('bot_unanswered').update({ resolved: true }).eq('id', u.id))} aria-label="Descartar"><IconClose width={16} height={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {editing && <FaqEditor faq={editing} onClose={() => setEditing(null)} onSave={saveFaq} />}
    </div>
  )
}

function FaqEditor({ faq, onClose, onSave }) {
  const [f, setF] = useState(faq)
  const [kw, setKw] = useState('')
  const [busy, setBusy] = useState(false)
  const addKw = () => {
    const parts = kw.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
    if (parts.length) setF((x) => ({ ...x, keywords: [...new Set([...(x.keywords || []), ...parts])].slice(0, 20) }))
    setKw('')
  }
  const ok = f.question.trim() && f.answer.trim()
  return (
    <div className="drawer" role="dialog" aria-modal="true">
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel drawer__panel--sm">
        <header className="drawer__head">
          <h2 className="display">{f.id ? 'Editar pregunta' : 'Nueva pregunta'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
        </header>
        <div className="drawer__body">
          <section className="form-block">
            <Field label="Pregunta"><input value={f.question} maxLength={160} onChange={(e) => setF({ ...f, question: e.target.value })} /></Field>
            <Field label="Respuesta"><textarea rows={5} value={f.answer} maxLength={1000} onChange={(e) => setF({ ...f, answer: e.target.value })} /></Field>
            <div className="field">
              <span>Palabras clave</span>
              <div className="tags">
                {(f.keywords || []).map((k) => (
                  <span key={k} className="tag">{k}<button type="button" onClick={() => setF({ ...f, keywords: f.keywords.filter((x) => x !== k) })} aria-label={`Quitar ${k}`}><IconClose width={12} height={12} /></button></span>
                ))}
                <input className="tags__input" placeholder="Ej.: garantía, cambio, devolución" value={kw} onChange={(e) => setKw(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKw() } }} onBlur={addKw} />
              </div>
              <small className="muted">Palabras que suelen usar tus clientes al preguntar esto.</small>
            </div>
            <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Activa" />
          </section>
        </div>
        <footer className="drawer__foot">
          <div className="row row--end">
            <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn--primary" disabled={!ok || busy} onClick={async () => { setBusy(true); await onSave(f); setBusy(false) }}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function ProfileTab() {
  const { config, saveConfig } = useOutletContext()
  const { tenant } = useAuth()
  const source = useMemo(() => ({ enabled: true, name: 'Lu', greeting: '', ...(config?.bot || {}) }), [config])
  const [d, set, dirty, reset] = useDraft(source)
  const saver = useSaver(async () => {
    if (!d.name.trim()) throw new Error('Ponle un nombre a tu asistente.')
    await saveConfig({ bot: { ...d, name: d.name.trim(), greeting: d.greeting.trim() } })
  })
  if (!config) return <Loader />
  return (
    <>
      <Section title="Perfil del asistente">
        <Switch checked={d.enabled !== false} onChange={(v) => set({ enabled: v })} label="Mostrar el asistente en el catálogo" />
        <div className="form-grid form-grid--logo">
          <div className="field">
            <span>Foto (opcional)</span>
            <ImagePicker tenantId={tenant.id} folder="bot" value={d.avatar} round size={320} label="Subir foto" crop={{ title: 'Foto de tu asistente', subtitle: 'Se verá en un círculo dentro del chat.' }} onChange={(img) => set({ avatar: img?.url || null })} />
          </div>
          <div className="stack">
            <Field label="Nombre"><input value={d.name} maxLength={24} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Saludo" hint={`Si lo dejas vacío: “¡Hola! Soy ${d.name || 'Lu'}, asistente de ${config.business?.name || tenant.name}…”`}>
              <textarea rows={3} maxLength={300} value={d.greeting} onChange={(e) => set({ greeting: e.target.value })} />
            </Field>
          </div>
        </div>
      </Section>
      <SaveBar dirty={dirty} {...saver} onSave={saver.run} onReset={reset} />
    </>
  )
}
