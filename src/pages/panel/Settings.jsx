import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { isValidSlug, catalogUrl } from '../../lib/utils'
import { formatBytes, removeInBatches } from '../../lib/images'
import Switch from '../../components/Switch'
import Loader from '../../components/Loader'
import { IconPlus, IconTrash, IconArrowUp, IconArrowDown, IconCheck } from '../../components/icons'
import { Field, ImagePicker, SaveBar, Section, Tabs, useDraft, useSaver } from './ui'

const TABS = [
  { key: 'negocio', label: 'Negocio' },
  { key: 'horario', label: 'Horario' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'pedido', label: 'Pedido' },
  { key: 'enlace', label: 'Enlace' },
  { key: 'archivos', label: 'Almacenamiento' },
]

export default function Settings() {
  const { config } = useOutletContext()
  const [tab, setTab] = useState('negocio')

  return (
    <div className="page page--narrow">
      <header className="page__head">
        <h1 className="display">Configuración</h1>
      </header>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {!config ? (
        <Loader />
      ) : tab === 'negocio' ? (
        <BusinessTab />
      ) : tab === 'horario' ? (
        <HoursTab />
      ) : tab === 'entrega' ? (
        <DeliveryTab />
      ) : tab === 'pagos' ? (
        <PaymentsTab />
      ) : tab === 'pedido' ? (
        <CheckoutTab />
      ) : tab === 'enlace' ? (
        <LinkTab />
      ) : (
        <StorageTab />
      )}
    </div>
  )
}

/* ─────────── Negocio ─────────── */
function BusinessTab() {
  const { config, saveConfig } = useOutletContext()
  const { tenant } = useAuth()
  const source = useMemo(() => ({ name: tenant.name, social: {}, ...(config.business || {}) }), [config.business, tenant.name])
  const [d, set, dirty, reset] = useDraft(source)
  const saver = useSaver(async () => {
    const phone = String(d.whatsapp || '').replace(/\D/g, '')
    if (phone && !/^(51)?9\d{8}$/.test(phone)) throw new Error('El WhatsApp debe ser un celular peruano de 9 dígitos.')
    if (!String(d.name || '').trim()) throw new Error('El nombre del negocio no puede estar vacío.')
    await saveConfig({ business: { ...d, name: d.name.trim(), whatsapp: phone ? (phone.length === 9 ? '51' + phone : phone) : '' } })
  })
  const setSocial = (k) => (e) => set({ social: { ...(d.social || {}), [k]: e.target.value.trim() } })

  return (
    <>
      <Section title="Identidad">
        <div className="form-grid form-grid--logo">
          <div className="field">
            <span>Logo</span>
            <ImagePicker tenantId={tenant.id} folder="brand" value={d.logo} round={d.logo_shape === 'round'} label="Subir logo"
              onChange={(img) => set({ logo: img?.url || null })} />
            <div className="row">
              <Switch checked={d.logo_shape === 'round'} onChange={(v) => set({ logo_shape: v ? 'round' : 'square' })} label="Logo redondo" />
            </div>
          </div>
          <div className="stack">
            <Field label="Nombre del negocio">
              <input value={d.name || ''} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Frase corta" hint="Aparece debajo del nombre. Ej.: Todo para tu obra, con delivery en Lima Norte">
              <input value={d.tagline || ''} maxLength={90} onChange={(e) => set({ tagline: e.target.value })} />
            </Field>
          </div>
        </div>
        <Field label="Descripción" hint="Se muestra en el pie del catálogo.">
          <textarea rows={3} maxLength={400} value={d.description || ''} onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </Section>

      <Section title="Contacto" hint="El WhatsApp es obligatorio para recibir pedidos.">
        <div className="form-grid">
          <Field label="WhatsApp para pedidos">
            <input inputMode="numeric" placeholder="9XXXXXXXX" value={String(d.whatsapp || '').replace(/^51(?=9\d{8}$)/, '')} onChange={(e) => set({ whatsapp: e.target.value.replace(/[^\d]/g, '').slice(0, 11) })} />
          </Field>
          <Field label="Número visible (opcional)" hint="Cómo se muestra en el pie. Ej.: 904 670 421">
            <input value={d.whatsapp_display || ''} maxLength={20} onChange={(e) => set({ whatsapp_display: e.target.value })} />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Dirección">
            <input value={d.address || ''} maxLength={140} placeholder="Av. Los Olivos 123, SMP" onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="Enlace de Google Maps (opcional)">
            <input value={d.maps_url || ''} maxLength={300} placeholder="https://maps.app.goo.gl/…" onChange={(e) => set({ maps_url: e.target.value.trim() })} />
          </Field>
        </div>
      </Section>

      <Section title="Redes sociales" hint="Pega el enlace completo de tu perfil. Las vacías no se muestran.">
        <div className="form-grid">
          <Field label="Instagram"><input value={d.social?.instagram || ''} onChange={setSocial('instagram')} placeholder="https://instagram.com/…" /></Field>
          <Field label="Facebook"><input value={d.social?.facebook || ''} onChange={setSocial('facebook')} placeholder="https://facebook.com/…" /></Field>
          <Field label="TikTok"><input value={d.social?.tiktok || ''} onChange={setSocial('tiktok')} placeholder="https://tiktok.com/@…" /></Field>
        </div>
      </Section>

      <SaveBar dirty={dirty} {...saver} onSave={saver.run} onReset={reset} />
    </>
  )
}

/* ─────────── Horario ─────────── */
const DAYS = [
  { n: 1, l: 'Lun' }, { n: 2, l: 'Mar' }, { n: 3, l: 'Mié' }, { n: 4, l: 'Jue' },
  { n: 5, l: 'Vie' }, { n: 6, l: 'Sáb' }, { n: 0, l: 'Dom' },
]

function HoursTab() {
  const { config, saveConfig } = useOutletContext()
  const source = useMemo(() => ({ hours: Array.isArray(config.business?.hours) ? config.business.hours : [] }), [config.business])
  const [d, set, dirty, reset] = useDraft(source)
  const saver = useSaver(async () => {
    for (const r of d.hours) {
      if (!r.days.length) throw new Error('Cada horario necesita al menos un día.')
      if (!r.open || !r.close) throw new Error('Completa la hora de apertura y cierre.')
    }
    await saveConfig({ business: { ...(config.business || {}), hours: d.hours } })
  })
  const upd = (i, patch) => set({ hours: d.hours.map((r, k) => (k === i ? { ...r, ...patch } : r)) })
  const used = new Set(d.hours.flatMap((r) => r.days))

  return (
    <>
      <Section
        title="Horario de atención"
        hint="Se usa para mostrar “Abierto / Cerrado” en el catálogo y para que Lu responda. Puedes tener horarios distintos por día."
        action={<button className="btn btn--sm" onClick={() => set({ hours: [...d.hours, { days: DAYS.map((x) => x.n).filter((n) => !used.has(n)).slice(0, 5), open: '09:00', close: '18:00' }] })}><IconPlus width={16} height={16} /> Horario</button>}
      >
        {d.hours.length === 0 && <p className="muted">Sin horario publicado. El catálogo mostrará “Catálogo en línea”.</p>}
        {d.hours.map((r, i) => (
          <div key={i} className="hours-row">
            <div className="day-picks">
              {DAYS.map((x) => (
                <button key={x.n} type="button" className={r.days.includes(x.n) ? 'is-on' : ''}
                  onClick={() => upd(i, { days: r.days.includes(x.n) ? r.days.filter((n) => n !== x.n) : [...r.days, x.n] })}>{x.l}</button>
              ))}
            </div>
            <div className="row">
              <input type="time" value={r.open} onChange={(e) => upd(i, { open: e.target.value })} aria-label="Abre" />
              <span className="muted">a</span>
              <input type="time" value={r.close} onChange={(e) => upd(i, { close: e.target.value })} aria-label="Cierra" />
              <button className="icon-btn" onClick={() => set({ hours: d.hours.filter((_, k) => k !== i) })} aria-label="Quitar horario"><IconTrash width={16} height={16} /></button>
            </div>
          </div>
        ))}
      </Section>
      <SaveBar dirty={dirty} {...saver} onSave={saver.run} onReset={reset} />
    </>
  )
}

/* ─────────── Entrega ─────────── */
function DeliveryTab() {
  const { config, saveConfig } = useOutletContext()
  const { tenant } = useAuth()
  const source = useMemo(() => ({ allow_delivery: config.checkout?.allow_delivery !== false, allow_pickup: config.checkout?.allow_pickup !== false }), [config.checkout])
  const [d, set, dirty, reset] = useDraft(source)
  const saver = useSaver(async () => {
    if (!d.allow_delivery && !d.allow_pickup) throw new Error('Activa al menos una forma de entrega.')
    await saveConfig({ checkout: { ...(config.checkout || {}), ...d }, modules: { ...(config.modules || {}), delivery: d.allow_delivery } })
  })

  const [zones, setZones] = useState(null)
  const [newZone, setNewZone] = useState({ name: '', cost: '' })
  const [error, setError] = useState('')
  const load = async () => {
    const { data } = await supabase.from('delivery_zones').select('*').eq('tenant_id', tenant.id).order('sort')
    setZones(data || [])
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (q) => {
    setError('')
    const { error: err } = await q
    if (err) setError(err.message)
    load()
  }
  const addZone = (e) => {
    e.preventDefault()
    if (!newZone.name.trim()) return
    const cost = Number(String(newZone.cost).replace(',', '.')) || 0
    run(supabase.from('delivery_zones').insert({ tenant_id: tenant.id, name: newZone.name.trim(), cost, sort: zones.length }))
    setNewZone({ name: '', cost: '' })
  }
  const move = (i, dir) => {
    const arr = [...zones]
    const to = i + dir
    if (to < 0 || to >= arr.length) return
    ;[arr[i], arr[to]] = [arr[to], arr[i]]
    run(supabase.from('delivery_zones').upsert(arr.map((z, k) => ({ ...z, sort: k }))))
  }

  return (
    <>
      <Section title="Formas de entrega">
        <Switch checked={d.allow_delivery} onChange={(v) => set({ allow_delivery: v })} label="Delivery a domicilio" />
        <Switch checked={d.allow_pickup} onChange={(v) => set({ allow_pickup: v })} label="Recojo en tienda" />
      </Section>
      <SaveBar dirty={dirty} {...saver} onSave={saver.run} onReset={reset} />

      {d.allow_delivery && (
        <Section title="Zonas de delivery" hint="El cliente elige su zona y el costo se suma al pedido. Si no agregas zonas, el delivery queda “por confirmar”. Pon 0 para envío gratis.">
          <form className="zone-add" onSubmit={addZone}>
            <input placeholder="Zona o distrito" value={newZone.name} maxLength={60} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} />
            <input placeholder="Costo S/" inputMode="decimal" value={newZone.cost} onChange={(e) => setNewZone({ ...newZone, cost: e.target.value })} />
            <button className="btn btn--primary" disabled={!newZone.name.trim()}><IconPlus width={16} height={16} /> Agregar</button>
          </form>
          {error && <p className="alert alert--error">{error}</p>}
          {!zones ? <Loader /> : zones.length === 0 ? <p className="muted">Aún no tienes zonas.</p> : (
            <ul className="cat-list">
              {zones.map((z, i) => (
                <li key={z.id} className={`cat-row ${z.active ? '' : 'is-hidden'}`}>
                  <div className="cat-row__order">
                    <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><IconArrowUp width={16} height={16} /></button>
                    <button className="icon-btn" disabled={i === zones.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><IconArrowDown width={16} height={16} /></button>
                  </div>
                  <input className="cat-row__name" defaultValue={z.name} maxLength={60} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== z.name && run(supabase.from('delivery_zones').update({ name: e.target.value.trim() }).eq('id', z.id))} />
                  <label className="cost-input">S/
                    <input defaultValue={Number(z.cost).toFixed(2)} inputMode="decimal" onBlur={(e) => {
                      const c = Number(e.target.value.replace(',', '.'))
                      if (!isNaN(c) && c >= 0 && c !== Number(z.cost)) run(supabase.from('delivery_zones').update({ cost: c }).eq('id', z.id))
                    }} />
                  </label>
                  <Switch checked={z.active} onChange={(v) => run(supabase.from('delivery_zones').update({ active: v }).eq('id', z.id))} label="Activa" />
                  <button className="icon-btn" onClick={() => run(supabase.from('delivery_zones').delete().eq('id', z.id))} aria-label="Eliminar zona"><IconTrash width={16} height={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </>
  )
}

/* ─────────── Pagos ─────────── */
const PAY_PRESETS = ['Yape', 'Plin', 'Transferencia BCP', 'Transferencia Interbank', 'Transferencia BBVA', 'Efectivo', 'Tarjeta', 'Binance']

function PaymentsTab() {
  const { config, saveConfig } = useOutletContext()
  const { tenant } = useAuth()
  const source = useMemo(() => ({ methods: Array.isArray(config.checkout?.payment_methods) ? config.checkout.payment_methods : [] }), [config.checkout])
  const [d, set, dirty, reset] = useDraft(source)
  const saver = useSaver(async () => {
    if (d.methods.some((m) => !m.name?.trim())) throw new Error('Cada método de pago necesita un nombre.')
    await saveConfig({ checkout: { ...(config.checkout || {}), payment_methods: d.methods.map((m) => ({ ...m, name: m.name.trim() })) } })
  })
  const upd = (i, patch) => set({ methods: d.methods.map((m, k) => (k === i ? { ...m, ...patch } : m)) })
  const move = (i, dir) => {
    const arr = [...d.methods]
    const to = i + dir
    if (to < 0 || to >= arr.length) return
    ;[arr[i], arr[to]] = [arr[to], arr[i]]
    set({ methods: arr })
  }
  const add = (name) => set({ methods: [...d.methods, { name, account_label: /yape|plin/i.test(name) ? 'Número' : /transferencia/i.test(name) ? 'Cuenta' : '', account: '', holder: '', note: '', qr_url: null }] })
  const missing = PAY_PRESETS.filter((p) => !d.methods.some((m) => m.name === p))

  return (
    <>
      <Section title="Métodos de pago" hint="El cliente elige uno al enviar su pedido y ve tu número, titular o QR para pagar.">
        {missing.length > 0 && (
          <div className="chips-add">
            {missing.map((p) => <button key={p} className="btn btn--sm" onClick={() => add(p)}><IconPlus width={14} height={14} /> {p}</button>)}
            <button className="btn btn--sm btn--ghost" onClick={() => add('')}><IconPlus width={14} height={14} /> Otro</button>
          </div>
        )}
        {d.methods.length === 0 && <p className="muted">Sin métodos de pago. El pago se coordina por WhatsApp.</p>}
        {d.methods.map((m, i) => (
          <div key={i} className="pay-card">
            <div className="pay-card__qr">
              <ImagePicker tenantId={tenant.id} folder="payments" value={m.qr_url} size={900} label="QR (opcional)" onChange={(img) => upd(i, { qr_url: img?.url || null })} />
            </div>
            <div className="pay-card__fields">
              <div className="form-grid">
                <Field label="Nombre"><input value={m.name} maxLength={40} onChange={(e) => upd(i, { name: e.target.value })} /></Field>
                <Field label="Titular"><input value={m.holder || ''} maxLength={60} onChange={(e) => upd(i, { holder: e.target.value })} /></Field>
              </div>
              <div className="form-grid">
                <Field label="Etiqueta del número"><input value={m.account_label || ''} placeholder="Número, Cuenta, CCI…" maxLength={30} onChange={(e) => upd(i, { account_label: e.target.value })} /></Field>
                <Field label="Número o cuenta"><input value={m.account || ''} maxLength={40} onChange={(e) => upd(i, { account: e.target.value })} /></Field>
              </div>
              <Field label="Nota (opcional)"><input value={m.note || ''} placeholder="Ej.: Envía la captura del pago por WhatsApp" maxLength={140} onChange={(e) => upd(i, { note: e.target.value })} /></Field>
            </div>
            <div className="pay-card__actions">
              <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><IconArrowUp width={16} height={16} /></button>
              <button className="icon-btn" disabled={i === d.methods.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><IconArrowDown width={16} height={16} /></button>
              <button className="icon-btn" onClick={() => set({ methods: d.methods.filter((_, k) => k !== i) })} aria-label="Quitar"><IconTrash width={16} height={16} /></button>
            </div>
          </div>
        ))}
      </Section>
      <SaveBar dirty={dirty} {...saver} onSave={saver.run} onReset={reset} />
    </>
  )
}

/* ─────────── Pedido (checkout) ─────────── */
function CheckoutTab() {
  const { config, saveConfig } = useOutletContext()
  const { tenant, refresh } = useAuth()
  const ck = config.checkout || {}
  const source = useMemo(() => ({
    ask_name: ck.ask_name !== false,
    ask_phone: !!ck.ask_phone,
    ask_address: ck.ask_address !== false,
    ask_date: !!ck.ask_date,
    ask_dedication: !!ck.ask_dedication,
    message_header: ck.message_header || '',
    order_prefix: tenant.order_prefix || 'PED',
  }), [ck, tenant.order_prefix]) // eslint-disable-line react-hooks/exhaustive-deps
  const [d, set, dirty, reset] = useDraft(source)
  const saver = useSaver(async () => {
    const prefix = d.order_prefix.toUpperCase()
    if (!/^[A-Z0-9]{2,5}$/.test(prefix)) throw new Error('El prefijo debe tener de 2 a 5 letras o números.')
    const { order_prefix, ...rest } = d
    await saveConfig({ checkout: { ...ck, ...rest, message_header: rest.message_header.trim() } })
    if (prefix !== tenant.order_prefix) {
      const { error } = await supabase.from('tenants').update({ order_prefix: prefix }).eq('id', tenant.id)
      if (error) throw error
      await refresh()
    }
  })

  return (
    <>
      <Section title="Datos que pides al cliente">
        <Switch checked={d.ask_name} onChange={(v) => set({ ask_name: v })} label="Nombre" />
        <Switch checked={d.ask_phone} onChange={(v) => set({ ask_phone: v })} label="Celular" />
        <Switch checked={d.ask_address} onChange={(v) => set({ ask_address: v })} label="Dirección (solo para delivery)" />
        <Switch checked={d.ask_date} onChange={(v) => set({ ask_date: v })} label="Fecha de entrega (encargos, florerías, pastelerías)" />
        <Switch checked={d.ask_dedication} onChange={(v) => set({ ask_dedication: v })} label="Dedicatoria (regalos, flores)" />
      </Section>
      <Section title="Mensaje de WhatsApp">
        <Field label="Primera línea del mensaje" hint="Si la dejas vacía: “Hola, quiero hacer este pedido en {tu negocio}:”">
          <input value={d.message_header} maxLength={120} onChange={(e) => set({ message_header: e.target.value })} />
        </Field>
        <Field label="Prefijo del código de pedido" hint={`Tus pedidos se verán como ${(d.order_prefix || 'PED').toUpperCase()}-0001`}>
          <input value={d.order_prefix} maxLength={5} onChange={(e) => set({ order_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
        </Field>
      </Section>
      <SaveBar dirty={dirty} {...saver} onSave={saver.run} onReset={reset} />
    </>
  )
}

/* ─────────── Enlace ─────────── */
function LinkTab() {
  const { tenant, refresh } = useAuth()
  const [slug, setSlug] = useState(tenant.slug)
  const [state, setState] = useState('same')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (slug === tenant.slug) return setState('same')
    if (!isValidSlug(slug)) return setState('invalid')
    setState('checking')
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('slug_available', { p_slug: slug })
      setState(data ? 'ok' : 'taken')
    }, 400)
    return () => clearTimeout(t)
  }, [slug, tenant.slug])

  const save = async () => {
    setBusy(true)
    setMsg('')
    const { error } = await supabase.from('tenants').update({ slug }).eq('id', tenant.id)
    setBusy(false)
    if (error) return setMsg(error.message)
    await refresh()
    setMsg('Enlace actualizado. El enlace anterior seguirá llevando a tu catálogo.')
  }

  return (
    <Section title="Enlace de tu catálogo" hint="Si lo cambias, el enlace anterior y tus QR impresos siguen funcionando: redirigen al nuevo.">
      <div className="slug-input">
        <span className="slug-input__prefix">{window.location.host}/</span>
        <input value={slug} maxLength={40} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
      </div>
      <small className={`hint hint--${state === 'ok' ? 'ok' : state === 'taken' || state === 'invalid' ? 'taken' : 'idle'}`}>
        {state === 'same' && `Actual: ${catalogUrl(tenant.slug)}`}
        {state === 'invalid' && 'Mínimo 3 caracteres: minúsculas, números y guiones. Algunas palabras están reservadas.'}
        {state === 'checking' && 'Verificando…'}
        {state === 'ok' && <><IconCheck width={14} height={14} /> Disponible</>}
        {state === 'taken' && 'Ese enlace ya está en uso.'}
      </small>
      {msg && <p className={`alert ${msg.startsWith('Enlace') ? 'alert--ok' : 'alert--error'}`}>{msg}</p>}
      <div className="row">
        <button className="btn btn--primary" disabled={state !== 'ok' || busy} onClick={save}>{busy ? 'Guardando…' : 'Cambiar enlace'}</button>
      </div>
    </Section>
  )
}

/* ─────────── Almacenamiento ─────────── */
function StorageTab() {
  const { tenant } = useAuth()
  const [usage, setUsage] = useState(null)
  const [orphans, setOrphans] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const [u, o] = await Promise.all([
      supabase.rpc('storage_usage', { p_tenant: tenant.id }),
      supabase.rpc('list_orphan_files', { p_tenant: tenant.id }),
    ])
    if (u.error || o.error) setMsg((u.error || o.error).message)
    setUsage(u.data?.[0] || { files: 0, bytes: 0 })
    setOrphans(o.data || [])
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const clean = async () => {
    setBusy(true)
    setMsg('')
    try {
      const n = await removeInBatches(orphans.map((f) => f.name))
      setMsg(`Listo: se borraron ${n} ${n === 1 ? 'archivo' : 'archivos'}.`)
      await load()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  const orphanBytes = (orphans || []).reduce((s, f) => s + Number(f.bytes || 0), 0)

  return (
    <>
      <Section title="Espacio usado" hint="Fotos de productos, logo, foto de Lu y QR de pagos. Las fotos se comprimen al subirlas para ocupar poco.">
        {!usage ? <Loader /> : (
          <div className="stats stats--2">
            <div className="stat"><small>Archivos</small><strong>{usage.files}</strong></div>
            <div className="stat"><small>Espacio</small><strong>{formatBytes(usage.bytes)}</strong></div>
          </div>
        )}
      </Section>
      <Section title="Archivos sin usar" hint="Imágenes que ya no aparecen en ningún producto ni en tu configuración: fotos reemplazadas o subidas que no se guardaron. Solo se cuentan las que tienen más de 24 horas.">
        {!orphans ? <Loader /> : orphans.length === 0 ? (
          <p className="muted">Todo limpio. No hay archivos sin usar.</p>
        ) : (
          <div className="row row--between">
            <span><strong>{orphans.length}</strong> {orphans.length === 1 ? 'archivo' : 'archivos'} · {formatBytes(orphanBytes)}</span>
            <button className="btn btn--primary" disabled={busy} onClick={clean}>{busy ? 'Limpiando…' : 'Liberar espacio'}</button>
          </div>
        )}
        {msg && <p className={`alert ${msg.startsWith('Listo') ? 'alert--ok' : 'alert--error'}`}>{msg}</p>}
      </Section>
    </>
  )
}
