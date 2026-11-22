import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageCircle, Pencil, CalendarClock, Wallet, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { daysLeft, formatDate } from '../../lib/utils'
import { getContact, waUrl, fillTemplate, planVars } from '../../lib/platform'
import Loader from '../../components/Loader'
import { IconExternal, IconSearch } from '../../components/icons'
import TenantEditor from './TenantEditor'

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'activo', label: 'Activos' },
  { key: 'vencer', label: 'Por vencer' },
  { key: 'suspendido', label: 'Suspendidos' },
]

export const DEFAULT_COBRO = 'Hola {dueño} 👋 Tu catálogo *{negocio}* vence el {vence} ({dias}). La renovación es de *{precio}* por {periodo} días. ¿Te lo renuevo? 🙌'
const money = (n) => `S/ ${Number(n || 0).toFixed(2)}`
export const missingColumns = (msg) => /price|cycle_days|tenant_renewals/.test(msg || '') && /column|schema cache|relation|does not exist/i.test(msg || '')
export const MISSING_009 = 'Falta ejecutar la actualización 009 en Supabase (SQL Editor) para guardar precio, ciclo e historial.'

export default function AdminTenants() {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('todos')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [contact, setContact] = useState({})

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('tenants')
      .select('*, profiles(full_name, phone)')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    setRows(data || [])
  }, [])

  useEffect(() => {
    load()
    getContact().then(setContact)
  }, [load])

  const soon = (t) => t.status === 'activo' && t.expires_at && daysLeft(t.expires_at) <= 7
  const visible = useMemo(() => {
    if (!rows) return []
    const q = query.trim().toLowerCase()
    return rows.filter((t) => {
      if (filter === 'vencer' ? !soon(t) : filter !== 'todos' && t.status !== filter) return false
      if (!q) return true
      return [t.name, t.slug, t.profiles?.full_name, t.profiles?.phone].some((v) => v?.toLowerCase().includes(q))
    })
  }, [rows, filter, query])

  const stats = useMemo(() => {
    const list = rows || []
    const active = list.filter((t) => t.status === 'activo' && (!t.expires_at || daysLeft(t.expires_at) >= 0))
    // Ingreso mensual estimado: cada precio llevado a 30 días
    const monthly = active.reduce((s, t) => s + (t.price ? (Number(t.price) * 30) / (t.cycle_days || 30) : 0), 0)
    return {
      active: active.length,
      soon: list.filter(soon).length,
      pending: list.filter((t) => t.status === 'pendiente').length,
      monthly,
      unpriced: active.filter((t) => t.price == null).length,
    }
  }, [rows])

  const update = async (tenant, patch, log = null) => {
    setBusyId(tenant.id)
    setError('')
    const { error: err } = await supabase.from('tenants').update(patch).eq('id', tenant.id)
    if (err) setError(missingColumns(err.message) ? MISSING_009 : err.message)
    else if (log) await supabase.from('tenant_renewals').insert({ tenant_id: tenant.id, ...log }) // si falta la tabla, no bloquea
    await load()
    setBusyId(null)
  }

  const quickRenew = (t) => {
    const days = t.cycle_days || 30
    const before = t.expires_at
    const base = before && new Date(before) > new Date() ? new Date(before) : new Date()
    base.setDate(base.getDate() + days)
    return update(t, { status: 'activo', expires_at: base.toISOString() }, {
      kind: t.status === 'activo' ? 'renovacion' : 'activacion', days, amount: t.price ?? null, expires_before: before, expires_after: base.toISOString(),
    })
  }

  const cobro = (t) => {
    if (!t.profiles?.phone) return null
    return waUrl(t.profiles.phone, fillTemplate(contact.mensaje_cobro || DEFAULT_COBRO, planVars(t, t.profiles?.full_name)))
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="display">Negocios</h1>
        <span className="muted">{rows ? `${rows.length} registrados` : ''}</span>
      </header>

      {rows && (
        <section className="stats stats--admin">
          <div className="stat"><small>Activos</small><strong>{stats.active}</strong></div>
          <button className={`stat stat--btn${stats.soon ? ' is-warn' : ''}`} onClick={() => setFilter('vencer')}>
            <small>Por vencer (7 días)</small><strong>{stats.soon}</strong>
          </button>
          <button className="stat stat--btn" onClick={() => setFilter('pendiente')}><small>Pendientes</small><strong>{stats.pending}</strong></button>
          <div className="stat">
            <small>Ingreso mensual estimado</small>
            <strong>{money(stats.monthly)}</strong>
            {stats.unpriced > 0 && <small className="text-warn">{stats.unpriced} sin precio</small>}
          </div>
        </section>
      )}

      <div className="toolbar">
        <div className="segmented">
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? 'is-active' : ''} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="search">
          <IconSearch />
          <input placeholder="Buscar negocio, dueño o celular" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {error && <p className="alert alert--error"><AlertCircle size={16} /> {error}</p>}

      {!rows ? (
        <Loader />
      ) : visible.length === 0 ? (
        <div className="card empty"><p>No hay negocios en esta vista.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="table table--tenants">
            <thead>
              <tr>
                <th>Negocio</th>
                <th>Dueño</th>
                <th>Alquiler</th>
                <th>Estado</th>
                <th>Vence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const left = daysLeft(t.expires_at)
                const wa = cobro(t)
                const busy = busyId === t.id
                return (
                  <tr key={t.id}>
                    <td className="t-name" data-label="Negocio">
                      <strong>{t.name}</strong>
                      <a className="table__link" href={`/${t.slug}`} target="_blank" rel="noreferrer">
                        /{t.slug} <IconExternal width={13} height={13} />
                      </a>
                    </td>
                    <td className="t-owner" data-label="Dueño">
                      {t.profiles?.full_name || '—'}
                      {t.profiles?.phone && <small className="muted">{t.profiles.phone}</small>}
                    </td>
                    <td className="t-rent" data-label="Alquiler">
                      {t.price != null ? <strong className="tnum">{money(t.price)}</strong> : <span className="muted">Sin precio</span>}
                      <small className="muted">cada {t.cycle_days || 30} días</small>
                    </td>
                    <td className="t-status" data-label="Estado"><span className={`pill pill--${t.status === 'activo' ? 'ok' : t.status === 'pendiente' ? 'warn' : 'error'}`} style={{ textTransform: 'capitalize' }}>{t.status}</span></td>
                    <td className="t-exp" data-label="Vence">
                      {formatDate(t.expires_at)}
                      {left !== null && <small className={left <= 5 ? 'text-warn' : 'muted'}>{left > 0 ? `${left} ${left === 1 ? 'día' : 'días'}` : left === 0 ? 'vence hoy' : 'vencido'}</small>}
                    </td>
                    <td className="t-actions">
                      <div className="row row--end tenant-actions">
                        <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => quickRenew(t)} title={t.price != null ? `Registra un pago de ${money(t.price)}` : ''}>
                          <CalendarClock size={15} /> {t.status === 'activo' ? `+${t.cycle_days || 30} días` : `Activar ${t.cycle_days || 30} días`}
                        </button>
                        <button className="btn btn--sm" disabled={busy} onClick={() => setEditing(t)}><Pencil size={14} /> Editar</button>
                        {wa && (
                          <a className="btn btn--sm btn--wa" href={wa} target="_blank" rel="noreferrer" title="Enviar mensaje de cobro">
                            <MessageCircle size={15} /> Cobrar
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TenantEditor
          tenant={editing}
          template={contact.mensaje_cobro || DEFAULT_COBRO}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load() }}
        />
      )}
      <p className="muted admin-foot-note"><Wallet size={14} /> El botón “+días” suma a partir del vencimiento actual (o de hoy si ya venció) y lo guarda en el historial con el precio del negocio.</p>
    </div>
  )
}
