import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Search, Package, User, ListPlus, Percent, Receipt } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { computeTotals, emptyItem, lineAmount, money, toRow, IGV_RATE } from '../../../lib/receipts'
import Dropdown from '../../../components/Dropdown'
import Switch from '../../../components/Switch'
import { IconClose } from '../../../components/icons'
import { Tabs } from '../ui'
import ReceiptDoc from './ReceiptDoc'
import ScaledPreview from './ScaledPreview'

const DOCS = [
  { value: 'DNI', label: 'DNI' },
  { value: 'RUC', label: 'RUC' },
  { value: 'CE', label: 'Carné de extranjería' },
  { value: 'PAS', label: 'Pasaporte' },
]
const UNITS = ['und', 'kg', 'g', 'lt', 'm', 'caja', 'paquete', 'servicio']
const toLocalInput = (iso) => {
  const d = new Date(iso || Date.now())
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// Crear o editar una boleta: desde un pedido, desde cero o con productos del catálogo
export default function ReceiptEditor({ initial, issuer, tenantId, methods, existing, onClose, onSaved }) {
  const [d, setD] = useState(initial)
  const [view, setView] = useState('datos')
  const [format, setFormat] = useState(issuer.format)
  const [catalog, setCatalog] = useState(null)
  const [picker, setPicker] = useState(false)
  const [find, setFind] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const t = computeTotals(d)

  const set = (patch) => setD((x) => ({ ...x, ...patch }))
  const setCust = (patch) => setD((x) => ({ ...x, customer: { ...x.customer, ...patch } }))
  const setItem = (key, patch) => setD((x) => ({ ...x, items: x.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }))
  const addItem = (it = {}) => setD((x) => {
    // Reemplaza la primera fila si está vacía
    const blank = x.items.length === 1 && !String(x.items[0].description).trim() && !x.items[0].unit_price
    const row = { ...emptyItem(), ...it }
    return { ...x, items: blank ? [row] : [...x.items, row] }
  })
  const removeItem = (key) => setD((x) => ({ ...x, items: x.items.length > 1 ? x.items.filter((it) => it.key !== key) : [emptyItem()] }))

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && !picker && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose, picker])

  // Productos del catálogo para agregarlos rápido
  useEffect(() => {
    if (!picker || catalog) return
    supabase.from('products').select('id, name, product_variants(id, label, price, unit)').eq('tenant_id', tenantId).order('sort')
      .then(({ data }) => setCatalog((data || []).flatMap((p) => (p.product_variants || []).map((v) => ({
        id: v.id,
        name: p.product_variants.length > 1 || !/^(único|unico)$/i.test(v.label) ? `${p.name} · ${v.label}` : p.name,
        price: v.price,
        unit: v.unit || 'und',
      })))))
  }, [picker, catalog, tenantId])

  const found = useMemo(() => {
    const q = find.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const list = catalog || []
    if (!q) return list.slice(0, 30)
    return list.filter((x) => x.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)).slice(0, 30)
  }, [catalog, find])

  const payOptions = useMemo(() => {
    const names = [...new Set([...methods.map((m) => m.name), 'Efectivo', 'Tarjeta', 'Transferencia'])]
    return [{ value: '', label: 'Sin indicar' }, ...names.map((n) => ({ value: n, label: n }))]
  }, [methods])

  const save = async () => {
    setError('')
    if (!t.lines.length) return setError('Agrega al menos un producto o servicio con su descripción y cantidad.')
    if (d.items.some((it) => String(it.description).trim() && (it.unit_price === '' || it.unit_price === null))) return setError('Hay productos sin precio. Escribe el precio (puede ser 0).')
    setSaving(true)
    const row = toRow(d, tenantId)
    const q = existing
      ? supabase.from('receipts').update(row).eq('id', existing.id).select().single()
      : supabase.from('receipts').insert(row).select().single()
    const { data, error: err } = await q
    setSaving(false)
    if (err) {
      const missing = /receipts/.test(err.message) && /relation|does not exist|schema cache/i.test(err.message)
      return setError(missing ? 'Falta ejecutar la actualización 010 en Supabase (SQL Editor) para guardar boletas.' : err.message)
    }
    onSaved(data, format)
  }

  const form = (
    <div className="rc-form">
      <section className="form-block">
        <h3 className="form-block__title"><User size={16} /> Cliente <small className="muted">(opcional)</small></h3>
        <div className="form-grid">
          <label className="field field--span">
            <span>Nombre o razón social</span>
            <input value={d.customer.name} maxLength={120} placeholder="Ej. Ana Torres" onChange={(e) => setCust({ name: e.target.value })} />
          </label>
          <div className="field">
            <span>Documento</span>
            <div className="rc-doc">
              <Dropdown ariaLabel="Tipo de documento" value={d.customer.doc_type || 'DNI'} onChange={(v) => setCust({ doc_type: v })} options={DOCS} />
              <input inputMode={d.customer.doc_type === 'DNI' || d.customer.doc_type === 'RUC' ? 'numeric' : 'text'} maxLength={d.customer.doc_type === 'RUC' ? 11 : d.customer.doc_type === 'DNI' ? 8 : 15}
                placeholder={d.customer.doc_type === 'RUC' ? '20123456789' : d.customer.doc_type === 'DNI' ? '12345678' : 'Número'}
                value={d.customer.doc_number} onChange={(e) => setCust({ doc_number: d.customer.doc_type === 'DNI' || d.customer.doc_type === 'RUC' ? e.target.value.replace(/\D/g, '') : e.target.value })} />
            </div>
          </div>
          <label className="field">
            <span>Celular</span>
            <input inputMode="tel" maxLength={15} placeholder="987654321" value={d.customer.phone} onChange={(e) => setCust({ phone: e.target.value.replace(/[^\d+ ]/g, '') })} />
          </label>
          <label className="field field--span">
            <span>Dirección</span>
            <input maxLength={160} value={d.customer.address} onChange={(e) => setCust({ address: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="form-block">
        <div className="form-block__head">
          <h3 className="form-block__title"><ListPlus size={16} /> Detalle</h3>
          <button type="button" className="btn btn--sm" onClick={() => setPicker(true)}><Package size={15} /> Desde mi catálogo</button>
        </div>
        <div className="rc-items">
          <div className="rc-items__head" aria-hidden="true">
            <span>Descripción</span><span>Cant.</span><span>Unidad</span><span>P. unit.</span><span>Desc. S/</span><span>Importe</span><span />
          </div>
          {d.items.map((it) => (
            <div key={it.key} className="rc-item">
              <input className="rc-item__desc" aria-label="Descripción" placeholder="Producto o servicio" maxLength={160} value={it.description} onChange={(e) => setItem(it.key, { description: e.target.value })} />
              <input className="rc-item__qty" aria-label="Cantidad" inputMode="decimal" value={it.qty} onChange={(e) => setItem(it.key, { qty: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })} />
              <Dropdown className="rc-item__unit" ariaLabel="Unidad" value={it.unit || 'und'} onChange={(v) => setItem(it.key, { unit: v })} options={UNITS.map((u) => ({ value: u, label: u }))} />
              <input className="rc-item__price" aria-label="Precio unitario" inputMode="decimal" placeholder="0.00" value={it.unit_price} onChange={(e) => setItem(it.key, { unit_price: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })} />
              <input className="rc-item__disc" aria-label="Descuento de la línea" inputMode="decimal" placeholder="0.00" value={it.discount} onChange={(e) => setItem(it.key, { discount: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })} />
              <strong className="rc-item__amount tnum">{money(lineAmount(it))}</strong>
              <button type="button" className="icon-btn rc-item__del" onClick={() => removeItem(it.key)} aria-label="Quitar línea"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn--sm btn--ghost rc-add" onClick={() => addItem()}><Plus size={15} /> Agregar línea</button>
      </section>

      <section className="form-block">
        <h3 className="form-block__title"><Percent size={16} /> Descuento e IGV</h3>
        <div className="rc-discount">
          <div className="segmented">
            <button type="button" className={d.discount_type === 'amount' ? 'is-active' : ''} onClick={() => set({ discount_type: 'amount' })}>Monto S/</button>
            <button type="button" className={d.discount_type === 'percent' ? 'is-active' : ''} onClick={() => set({ discount_type: 'percent' })}>Porcentaje %</button>
          </div>
          <input aria-label="Descuento general" inputMode="decimal" placeholder={d.discount_type === 'percent' ? 'Ej. 10' : 'Ej. 5.00'} value={d.discount_value}
            onChange={(e) => set({ discount_value: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })} />
        </div>
        <Switch checked={d.igv} onChange={(v) => set({ igv: v })} label={`Mostrar IGV (${IGV_RATE}%)`} />
        <small className="muted">{d.igv ? `Tus precios ya incluyen el IGV: se desglosa (Op. gravada + IGV) y el total no cambia.` : 'Apagado: la boleta no muestra IGV.'}</small>

        <dl className="rc-sum">
          <div><dt>Subtotal</dt><dd>{money(t.subtotal)}</dd></div>
          {t.discount > 0 && <div><dt>Descuento</dt><dd>-{money(t.discount)}</dd></div>}
          {d.igv && <div><dt>Op. gravada</dt><dd>{money(t.taxable)}</dd></div>}
          {d.igv && <div><dt>IGV ({IGV_RATE}%)</dt><dd>{money(t.igv_amount)}</dd></div>}
          <div className="is-total"><dt>Total</dt><dd>{money(t.total)}</dd></div>
        </dl>
      </section>

      <section className="form-block">
        <h3 className="form-block__title"><Receipt size={16} /> Más datos</h3>
        <div className="form-grid">
          <div className="field">
            <span>Forma de pago</span>
            <Dropdown ariaLabel="Forma de pago" value={d.payment_method || ''} onChange={(v) => set({ payment_method: v })} options={payOptions} />
          </div>
          <label className="field">
            <span>Fecha y hora</span>
            <input type="datetime-local" value={toLocalInput(d.issued_at)} onChange={(e) => e.target.value && set({ issued_at: new Date(e.target.value).toISOString() })} />
          </label>
          <label className="field field--span">
            <span>Observaciones</span>
            <textarea rows={2} maxLength={300} placeholder="Ej. Garantía de 6 meses" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </div>
      </section>
    </div>
  )

  const preview = (
    <div className="rc-side">
      <div className="rc-side__bar">
        <span className="muted">Vista previa</span>
        <div className="segmented segmented--sm">
          <button type="button" className={format === 'a4' ? 'is-active' : ''} onClick={() => setFormat('a4')}>A4</button>
          <button type="button" className={format === 'ticket' ? 'is-active' : ''} onClick={() => setFormat('ticket')}>Ticket</button>
        </div>
      </div>
      <div className={`rc-paper rc-paper--${format}`}>
        <ScaledPreview docWidth={format === 'ticket' ? 302 : 794} max={format === 'ticket' ? 1.1 : 1}>
          <ReceiptDoc receipt={d} issuer={issuer} format={format} code={existing?.code || `${(d.series || issuer.series)}-······`} />
        </ScaledPreview>
      </div>
    </div>
  )

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label="Boleta">
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel drawer__panel--receipt">
        <header className="drawer__head">
          <div>
            <h2 className="display">{existing ? `Editar ${existing.code}` : 'Nueva boleta'}</h2>
            <small className="muted">{d.order_id ? 'Armada desde el pedido; revisa y ajusta lo que necesites.' : 'Llénala con tus productos o con lo que quieras.'}</small>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
        </header>
        <div className="rc-tabs"><Tabs tabs={[{ key: 'datos', label: 'Datos' }, { key: 'vista', label: 'Vista previa' }]} value={view} onChange={setView} /></div>
        <div className={`drawer__body rc-body is-${view}`}>
          {form}
          {preview}
        </div>
        <footer className="drawer__foot">
          {error && <p className="alert alert--error">{error}</p>}
          <div className="row row--end">
            <strong className="rc-foot-total tnum">Total {money(t.total)}</strong>
            <button className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn btn--primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : existing ? 'Guardar cambios' : 'Emitir boleta'}</button>
          </div>
        </footer>
      </div>

      {picker && (
        <div className="rc-picker" role="dialog" aria-label="Agregar desde mi catálogo">
          <div className="rc-picker__backdrop" onClick={() => setPicker(false)} />
          <div className="rc-picker__panel">
            <div className="rc-picker__head">
              <label className="search">
                <Search size={16} />
                <input autoFocus placeholder="Buscar en tus productos" value={find} onChange={(e) => setFind(e.target.value)} />
              </label>
              <button className="icon-btn" onClick={() => setPicker(false)} aria-label="Cerrar"><IconClose /></button>
            </div>
            <ul className="rc-picker__list">
              {!catalog && <li className="muted rc-picker__empty">Cargando…</li>}
              {catalog && !found.length && <li className="muted rc-picker__empty">No encontré productos con ese nombre.</li>}
              {found.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { addItem({ description: p.name, unit_price: p.price ?? '', unit: p.unit }); setPicker(false); setFind('') }}>
                    <span>{p.name}</span>
                    <b className="tnum">{p.price === null ? 'A consultar' : money(p.price)}</b>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
