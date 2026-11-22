import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trash2, RefreshCw, HardDrive, Image, Package, Wallet, Bot as BotIcon, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatBytes, removeInBatches } from '../../lib/images'
import Loader from '../../components/Loader'

// Supabase gratis incluye 1 GB de Storage: sirve de referencia para la barra
const QUOTA = 1024 * 1024 * 1024

export default function AdminStorage() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setError('')
    const { data, error: err } = await supabase.rpc('storage_usage_all')
    if (err) setError(err.message)
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const totals = useMemo(() => {
    const t = { files: 0, bytes: 0, orphan_files: 0, orphan_bytes: 0 }
    ;(rows || []).forEach((r) => { t.files += Number(r.files); t.bytes += Number(r.bytes); t.orphan_files += Number(r.orphan_files); t.orphan_bytes += Number(r.orphan_bytes) })
    return t
  }, [rows])

  const clean = async (tenantId = null) => {
    setBusy(tenantId || 'all')
    setMsg('')
    try {
      const { data, error: err } = await supabase.rpc('list_orphan_files_all')
      if (err) throw err
      const files = (data || []).filter((f) => !tenantId || f.tenant_id === tenantId)
      const n = await removeInBatches(files.map((f) => f.name))
      setMsg(`Listo: se borraron ${n} archivos sin usar.`)
      await load()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(null)
    }
  }

  const pct = Math.min(100, (totals.bytes / QUOTA) * 100)

  return (
    <div className="page">
      <header className="page__head page__head--split">
        <h1 className="display">Almacenamiento</h1>
        <button className="btn btn--sm" onClick={load}><RefreshCw size={15} /> Actualizar</button>
      </header>
      <p className="muted page__lead">Lo que ocupa cada negocio en Supabase Storage: fotos de productos, logos, QR de pagos y fotos del asistente. Los archivos sin usar son imágenes reemplazadas o subidas que no se guardaron (con más de 24 horas).</p>
      {error && <p className="alert alert--error">{error}</p>}
      {msg && <p className={`alert ${msg.startsWith('Listo') ? 'alert--ok' : 'alert--error'}`}>{msg}</p>}

      {!rows ? <Loader /> : (
        <>
          <section className="stats">
            <div className="stat stat--wide">
              <small><HardDrive size={14} /> Espacio total</small>
              <strong>{formatBytes(totals.bytes)}</strong>
              <div className="meter"><span style={{ width: `${pct}%` }} /></div>
              <small className="muted">{pct.toFixed(1)}% de 1 GB (plan gratis de Supabase)</small>
            </div>
            <div className="stat"><small>Archivos</small><strong>{totals.files}</strong><small className="muted">{rows.length} carpetas</small></div>
            <div className="stat">
              <small>Sin usar</small>
              <strong>{formatBytes(totals.orphan_bytes)}</strong>
              <small className="muted">{totals.orphan_files} archivos</small>
              {totals.orphan_files > 0 && <button className="btn btn--sm btn--primary" disabled={!!busy} onClick={() => clean()}><Trash2 size={14} /> {busy === 'all' ? 'Limpiando…' : 'Liberar todo'}</button>}
            </div>
          </section>

          {rows.length === 0 ? <div className="card empty"><p>Aún no hay archivos subidos.</p></div> : (
            <div className="table-wrap">
              <table className="table table--storage">
                <thead>
                  <tr>
                    <th>Negocio</th>
                    <th>Total</th>
                    <th><Package size={13} /> Productos</th>
                    <th><Image size={13} /> Marca</th>
                    <th><Wallet size={13} /> Pagos</th>
                    <th><BotIcon size={13} /> Asistente</th>
                    <th>Sin usar</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const share = totals.bytes ? (Number(r.bytes) / totals.bytes) * 100 : 0
                    const gone = !r.slug
                    return (
                      <tr key={r.tenant_id}>
                        <td>
                          <strong className={gone ? 'text-warn' : ''}>{gone && <AlertTriangle size={14} />} {r.tenant_name}</strong>
                          {r.slug ? <span className="table__link">/{r.slug}</span> : <span className="table__link">Carpeta {String(r.tenant_id).slice(0, 8)}…</span>}
                          <div className="meter meter--thin"><span style={{ width: `${Math.max(2, share)}%` }} /></div>
                        </td>
                        <td><strong>{formatBytes(r.bytes)}</strong><small>{r.files} archivos</small></td>
                        <td>{formatBytes(r.products_bytes)}</td>
                        <td>{formatBytes(r.brand_bytes)}</td>
                        <td>{formatBytes(r.payments_bytes)}</td>
                        <td>{formatBytes(r.bot_bytes)}</td>
                        <td>{Number(r.orphan_files) > 0 ? <><strong className="text-warn">{formatBytes(r.orphan_bytes)}</strong><small>{r.orphan_files} archivos</small></> : <span className="muted">—</span>}</td>
                        <td>
                          {Number(r.orphan_files) > 0 && (
                            <button className="btn btn--sm" disabled={!!busy} onClick={() => clean(r.tenant_id)}>{busy === r.tenant_id ? 'Limpiando…' : 'Limpiar'}</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
