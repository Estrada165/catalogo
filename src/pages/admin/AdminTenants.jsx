import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { daysLeft, formatDate } from '../../lib/utils'
import Loader from '../../components/Loader'
import { IconExternal, IconSearch } from '../../components/icons'

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'activo', label: 'Activos' },
  { key: 'suspendido', label: 'Suspendidos' },
]

export default function AdminTenants() {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('todos')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

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
  }, [load])

  const visible = useMemo(() => {
    if (!rows) return []
    const q = query.trim().toLowerCase()
    return rows.filter((t) => {
      if (filter !== 'todos' && t.status !== filter) return false
      if (!q) return true
      return [t.name, t.slug, t.profiles?.full_name, t.profiles?.phone].some((v) => v?.toLowerCase().includes(q))
    })
  }, [rows, filter, query])

  const update = async (tenant, patch) => {
    setBusyId(tenant.id)
    setError('')
    const { error: err } = await supabase.from('tenants').update(patch).eq('id', tenant.id)
    if (err) setError(err.message)
    await load()
    setBusyId(null)
  }

  const addDays = (tenant, days) => {
    const base = tenant.expires_at && new Date(tenant.expires_at) > new Date() ? new Date(tenant.expires_at) : new Date()
    base.setDate(base.getDate() + days)
    return update(tenant, { status: 'activo', expires_at: base.toISOString() })
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="display">Negocios</h1>
        <span className="muted">{rows ? `${rows.length} registrados` : ''}</span>
      </header>

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

      {error && <p className="alert alert--error">{error}</p>}

      {!rows ? (
        <Loader />
      ) : visible.length === 0 ? (
        <div className="card empty"><p>No hay negocios en esta vista.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Negocio</th>
                <th>Dueño</th>
                <th>Rubro</th>
                <th>Estado</th>
                <th>Vence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const left = daysLeft(t.expires_at)
                return (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                      <a className="table__link" href={`/${t.slug}`} target="_blank" rel="noreferrer">
                        /{t.slug} <IconExternal width={13} height={13} />
                      </a>
                    </td>
                    <td>
                      {t.profiles?.full_name || '—'}
                      {t.profiles?.phone && (
                        <a className="table__link" href={`https://wa.me/51${t.profiles.phone}`} target="_blank" rel="noreferrer">
                          {t.profiles.phone}
                        </a>
                      )}
                    </td>
                    <td>{t.rubro_key || '—'}</td>
                    <td><span className={`pill pill--${t.status === 'activo' ? 'ok' : t.status === 'pendiente' ? 'warn' : 'error'}`}>{t.status}</span></td>
                    <td>
                      {formatDate(t.expires_at)}
                      {left !== null && <small className={left <= 5 ? 'text-warn' : 'muted'}>{left > 0 ? `${left} días` : 'vencido'}</small>}
                    </td>
                    <td>
                      <div className="row row--end">
                        <button className="btn btn--sm btn--primary" disabled={busyId === t.id} onClick={() => addDays(t, 30)}>
                          {t.status === 'activo' ? '+30 días' : 'Activar 30 días'}
                        </button>
                        {t.status === 'activo' ? (
                          <button className="btn btn--sm" disabled={busyId === t.id} onClick={() => update(t, { status: 'suspendido' })}>
                            Suspender
                          </button>
                        ) : t.status === 'suspendido' ? (
                          <button className="btn btn--sm" disabled={busyId === t.id} onClick={() => update(t, { status: 'activo' })}>
                            Reactivar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
