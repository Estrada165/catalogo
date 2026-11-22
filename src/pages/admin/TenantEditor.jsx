import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, History, Minus, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import { waUrl, fillTemplate, planVars } from '../../lib/platform'
import Switch from '../../components/Switch'
import { IconClose } from '../../components/icons'

const DAY = 86400000
const CYCLES = [15, 30, 60, 90, 180, 365]
const KIND = { activacion: 'Activación', renovacion: 'Renovación', ajuste: 'Ajuste' }
const toInput = (d) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '')
const money = (n) => `S/ ${Number(n || 0).toFixed(2)}`
const isMissing = (msg) => /price|cycle_days|tenant_renewals/.test(msg || '') && /column|schema cache|relation|does not exist/i.test(msg || '')

// Editar el plan de un negocio: vencimiento exacto, días, precio, ciclo, estado e historial
export default function TenantEditor({ tenant, template, onClose, onSaved }) {
  const original = tenant.expires_at ? new Date(tenant.expires_at) : null
  const [exp, setExp] = useState(original)
  const [status, setStatus] = useState(tenant.status)
  const [price, setPrice] = useState(tenant.price ?? '')
  const [cycle, setCycle] = useState(String(tenant.cycle_days || 30))
  const [logPay, setLogPay] = useState(true)
  const [amount, setAmount] = useState(tenant.price ?? '')
  const [note, setNote] = useState('')
  const [history, setHistory] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('tenant_renewals').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(12)
      .then(({ data, error: err }) => setHistory(err ? false : data || []))
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [tenant.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const left = exp ? Math.ceil((exp.getTime() - Date.now()) / DAY) : null
  // Días que cambian respecto a lo guardado (contra hoy si ya estaba vencido)
  const delta = useMemo(() => {
    if (!exp) return 0
    const from = original && original > new Date() ? original : new Date()
    return Math.round((exp.getTime() - from.getTime()) / DAY)
  }, [exp]) // eslint-disable-line react-hooks/exhaustive-deps
  const changedDate = (exp?.getTime() || 0) !== (original?.getTime() || 0)

  const shift = (days) => {
    const base = exp && (exp > new Date() || days < 0) ? exp : new Date()
    setExp(new Date(base.getTime() + days * DAY))
  }
  const setDays = (n) => {
    if (n === '' || isNaN(Number(n))) return
    setExp(new Date(Date.now() + Number(n) * DAY))
  }
  const setDate = (v) => {
    if (!v) return
    const [y, m, d] = v.split('-').map(Number)
    const now = new Date()
    setExp(new Date(y, m - 1, d, now.getHours(), now.getMinutes()))
  }

  const draft = { ...tenant, expires_at: exp?.toISOString() || null, price: price === '' ? null : Number(price), cycle_days: Number(cycle) || 30 }
  const message = fillTemplate(template, planVars(draft, tenant.profiles?.full_name))
  const phone = tenant.profiles?.phone

  const save = async () => {
    setError('')
    if (price !== '' && (isNaN(Number(price)) || Number(price) < 0)) return setError('Revisa el precio.')
    const c = Number(cycle)
    if (!Number.isInteger(c) || c < 1 || c > 366) return setError('El ciclo debe ser entre 1 y 366 días.')
    setSaving(true)
    const patch = { status, expires_at: exp ? exp.toISOString() : null, price: price === '' ? null : Number(price), cycle_days: c }
    const { error: err } = await supabase.from('tenants').update(patch).eq('id', tenant.id)
    if (err) {
      setSaving(false)
      return setError(isMissing(err.message) ? 'Falta ejecutar la actualización 009 en Supabase (SQL Editor).' : err.message)
    }
    if (changedDate || (logPay && note.trim())) {
      const pay = logPay && delta > 0
      await supabase.from('tenant_renewals').insert({
        tenant_id: tenant.id,
        kind: pay ? (tenant.status === 'activo' ? 'renovacion' : 'activacion') : 'ajuste',
        days: delta,
        amount: pay && amount !== '' ? Number(amount) : null,
        note: note.trim() || null,
        expires_before: tenant.expires_at,
        expires_after: patch.expires_at,
      })
    }
    onSaved()
  }

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label={`Editar ${tenant.name}`}>
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel">
        <header className="drawer__head">
          <div>
            <h2 className="display">{tenant.name}</h2>
            <small className="muted">/{tenant.slug} · {tenant.profiles?.full_name || 'sin nombre'}</small>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
        </header>

        <div className="drawer__body">
          <section className="form-block">
            <h3 className="form-block__title">Vencimiento</h3>
            <div className="te-left">
              <strong className="tnum">{left === null ? 'Sin vencimiento' : left > 0 ? `${left} ${left === 1 ? 'día' : 'días'}` : left === 0 ? 'Vence hoy' : `Vencido hace ${-left} d`}</strong>
              {changedDate && <span className={`pill pill--${delta >= 0 ? 'ok' : 'warn'}`}>{delta >= 0 ? '+' : ''}{delta} días</span>}
              <small className="muted">{original ? `Antes: ${formatDate(original)}` : 'Antes: sin fecha'}</small>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Fecha de vencimiento</span>
                <input type="date" value={toInput(exp)} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="field">
                <span>Días restantes</span>
                <input type="number" inputMode="numeric" min="-365" max="3650" value={left ?? ''} placeholder="Sin vencimiento" onChange={(e) => setDays(e.target.value)} />
              </label>
            </div>
            <div className="te-chips">
              {[-30, -7, -1].map((n) => <button key={n} type="button" className="btn btn--sm" onClick={() => shift(n)}><Minus size={13} />{-n}</button>)}
              {[1, 7, 30].map((n) => <button key={n} type="button" className="btn btn--sm" onClick={() => shift(n)}><Plus size={13} />{n}</button>)}
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setExp(original)} disabled={!changedDate}>Deshacer</button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setExp(null)}>Sin vencimiento</button>
            </div>
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Alquiler</h3>
            <div className="form-grid">
              <label className="field">
                <span>Precio (S/)</span>
                <input inputMode="decimal" placeholder="Ej. 30" value={price} onChange={(e) => setPrice(e.target.value.replace(',', '.'))} />
              </label>
              <label className="field">
                <span>Cada cuántos días</span>
                <input list="te-cycles" inputMode="numeric" value={cycle} onChange={(e) => setCycle(e.target.value.replace(/\D/g, '').slice(0, 3))} />
                <datalist id="te-cycles">{CYCLES.map((c) => <option key={c} value={c} />)}</datalist>
              </label>
            </div>
            <label className="field">
              <span>Estado</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pendiente">Pendiente (aún no activo)</option>
                <option value="activo">Activo</option>
                <option value="suspendido">Suspendido</option>
              </select>
            </label>
          </section>

          {changedDate && delta > 0 && (
            <section className="form-block">
              <Switch checked={logPay} onChange={setLogPay} label="Registrar como pago" />
              {logPay && (
                <div className="form-grid">
                  <label className="field">
                    <span>Monto recibido (S/)</span>
                    <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.'))} />
                  </label>
                  <label className="field">
                    <span>Nota</span>
                    <input placeholder="Ej. Yape 22/11" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
                  </label>
                </div>
              )}
            </section>
          )}

          <section className="form-block">
            <h3 className="form-block__title">Mensaje de cobro</h3>
            <p className="preview-msg">{message}</p>
            {phone ? (
              <a className="btn btn--sm btn--wa" href={waUrl(phone, message)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Enviar a {phone}</a>
            ) : <small className="muted">El dueño no registró su celular.</small>}
            <small className="muted">El texto se cambia en Ajustes → Mensaje de cobro.</small>
          </section>

          <section className="form-block">
            <h3 className="form-block__title"><History size={16} /> Historial</h3>
            {history === null ? <small className="muted">Cargando…</small>
              : history === false ? <small className="muted">El historial aparece al ejecutar la actualización 009.</small>
                : history.length === 0 ? <small className="muted">Aún no hay movimientos.</small>
                  : (
                    <ul className="te-history">
                      {history.map((h) => (
                        <li key={h.id}>
                          <span className={`pill pill--${h.kind === 'ajuste' ? 'warn' : 'ok'}`}>{KIND[h.kind] || h.kind}</span>
                          <div>
                            <b className="tnum">{h.days > 0 ? `+${h.days}` : h.days} días{h.amount != null ? ` · ${money(h.amount)}` : ''}</b>
                            <small className="muted">{formatDate(h.created_at)}{h.expires_after ? ` → vence ${formatDate(h.expires_after)}` : ''}{h.note ? ` · ${h.note}` : ''}</small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
          </section>
        </div>

        <footer className="drawer__foot">
          {error && <p className="alert alert--error">{error}</p>}
          <div className="row row--end">
            <button className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn btn--primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
