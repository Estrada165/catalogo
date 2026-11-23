import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { Plus, Search, ReceiptText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { draftFromRow, emptyReceipt, money, receiptFromOrder } from '../../lib/receipts'
import Loader from '../../components/Loader'
import { issuerFrom } from './receipts/exporter'
import ReceiptEditor from './receipts/ReceiptEditor'
import ReceiptViewer from './receipts/ReceiptViewer'

const when = (iso) => new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })

export default function Receipts() {
  const { config } = useOutletContext()
  const { tenant } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const issuer = useMemo(() => issuerFrom(config, tenant), [config, tenant])
  const methods = config?.checkout?.payment_methods || []
  const [rows, setRows] = useState(null)
  const [missing, setMissing] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('todas')
  const [editor, setEditor] = useState(null) // { initial, existing }
  const [viewing, setViewing] = useState(null) // { receipt, format }

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('receipts').select('*').eq('tenant_id', tenant.id).order('issued_at', { ascending: false }).limit(500)
    if (error) { setMissing(/relation|does not exist|schema cache/i.test(error.message)); setRows([]); return [] }
    setRows(data || [])
    return data || []
  }, [tenant.id])

  useEffect(() => { load() }, [load])

  // Llegar desde un pedido: "Crear boleta" o "Ver boleta"
  useEffect(() => {
    const st = location.state
    if (!st || rows === null) return
    if (st.fromOrder) setEditor({ initial: receiptFromOrder(st.fromOrder, issuer) })
    if (st.openId) { const r = rows.find((x) => x.id === st.openId); if (r) setViewing({ receipt: r }) }
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows || []).filter((r) => (filter === 'todas' || r.status === filter) && (!q || [r.code, r.customer?.name, r.customer?.doc_number, r.notes].some((v) => String(v || '').toLowerCase().includes(q))))
  }, [rows, query, filter])

  const month = useMemo(() => {
    const now = new Date()
    const list = (rows || []).filter((r) => r.status === 'emitida' && new Date(r.issued_at).getMonth() === now.getMonth() && new Date(r.issued_at).getFullYear() === now.getFullYear())
    return { n: list.length, total: list.reduce((s, r) => s + Number(r.total || 0), 0) }
  }, [rows])

  const toggleVoid = async (r) => {
    const status = r.status === 'anulada' ? 'emitida' : 'anulada'
    if (status === 'anulada' && !confirm(`¿Anular la boleta ${r.code}? Seguirá en la lista marcada como anulada.`)) return
    await supabase.from('receipts').update({ status }).eq('id', r.id)
    const list = await load()
    setViewing((v) => (v ? { ...v, receipt: list.find((x) => x.id === r.id) || v.receipt } : v))
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="display">Boletas</h1>
          <p className="muted">Notas de venta para tus clientes, en PDF, imagen o impresas.</p>
        </div>
        <button className="btn btn--primary" data-tour="nueva-boleta" onClick={() => setEditor({ initial: emptyReceipt(issuer) })} disabled={missing}>
          <Plus size={18} /> Nueva boleta
        </button>
      </header>

      {missing && (
        <p className="alert alert--error">Para usar Boletas falta ejecutar la actualización 010 en Supabase (SQL Editor).</p>
      )}

      {rows && rows.length > 0 && (
        <section className="stats stats--receipts">
          <div className="stat"><small>Boletas este mes</small><strong>{month.n}</strong></div>
          <div className="stat"><small>Total este mes</small><strong>{money(month.total)}</strong></div>
        </section>
      )}

      {rows && rows.length > 0 && (
        <div className="toolbar">
          <div className="segmented">
            {[['todas', 'Todas'], ['emitida', 'Emitidas'], ['anulada', 'Anuladas']].map(([k, l]) => (
              <button key={k} className={filter === k ? 'is-active' : ''} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          <label className="search">
            <Search size={16} />
            <input placeholder="Buscar por número, cliente o documento" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
      )}

      {rows === null ? (
        <Loader />
      ) : rows.length === 0 && !missing ? (
        <div className="card empty rc-empty">
          <ReceiptText size={34} />
          <h3>Aún no tienes boletas</h3>
          <p className="muted">Créala desde un pedido entregado (en Pedidos) o desde cero con el botón “Nueva boleta”.</p>
        </div>
      ) : visible.length === 0 && !missing ? (
        <div className="card empty"><p>No hay boletas en esta vista.</p></div>
      ) : (
        <ul className="rc-list" data-tour="lista-boletas">
          {visible.map((r) => (
            <li key={r.id}>
              <button className={`rc-row${r.status === 'anulada' ? ' is-void' : ''}`} onClick={() => setViewing({ receipt: r })}>
                <span className="rc-row__icon"><ReceiptText size={18} /></span>
                <span className="rc-row__main">
                  <strong>{r.code}</strong>
                  <small className="muted">{r.customer?.name || 'Sin cliente'} · {when(r.issued_at)}</small>
                </span>
                {r.status === 'anulada' ? <span className="pill pill--error">Anulada</span> : r.order_id ? <span className="pill">Pedido</span> : null}
                <strong className="rc-row__total tnum">{money(r.total)}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editor && (
        <ReceiptEditor
          initial={editor.initial}
          existing={editor.existing}
          issuer={issuer}
          tenantId={tenant.id}
          methods={methods}
          onClose={() => setEditor(null)}
          onSaved={async (saved, format) => { setEditor(null); await load(); setViewing({ receipt: saved, format }) }}
        />
      )}

      {viewing && (
        <ReceiptViewer
          key={viewing.receipt.id + viewing.receipt.status}
          receipt={viewing.receipt}
          issuer={issuer}
          initialFormat={viewing.format}
          onClose={() => setViewing(null)}
          onEdit={() => { const r = viewing.receipt; setViewing(null); setEditor({ initial: draftFromRow(r), existing: r }) }}
          onDuplicate={() => { const r = viewing.receipt; setViewing(null); setEditor({ initial: { ...draftFromRow(r), id: undefined, code: undefined, status: undefined, order_id: null, issued_at: new Date().toISOString() } }) }}
          onToggleVoid={() => toggleVoid(viewing.receipt)}
        />
      )}
    </div>
  )
}
