import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { removeImages, uploadProductImage } from '../../lib/images'
import Switch from '../../components/Switch'
import Loader from '../../components/Loader'
import Cropper from '../../components/Cropper'
import { Crop, ListChecks, AlertTriangle, ListOrdered, StickyNote } from 'lucide-react'
import { IconClose, IconImage, IconPlus, IconTrash } from '../../components/icons'
import { PosSelect, moveTo } from './ui'

const UNITS = [
  { value: 'und', label: 'Unidad' },
  { value: 'kg', label: 'Kilo (kg)' },
  { value: 'g', label: 'Gramo (g)' },
  { value: 'l', label: 'Litro (l)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'm', label: 'Metro (m)' },
  { value: 'caja', label: 'Caja' },
  { value: 'paquete', label: 'Paquete' },
  { value: 'docena', label: 'Docena' },
]

const MAX_IMAGES = 6

// Bloques de "Más información" que se ven al abrir el producto en el catálogo
export const DETAIL_KINDS = [
  { kind: 'incluye', title: 'Incluye', Icon: ListChecks, hint: 'Lo que trae o incluye. Uno por línea.', ph: 'Estuche de regalo\nTarjeta con dedicatoria' },
  { kind: 'atencion', title: 'Ten en cuenta', Icon: AlertTriangle, hint: 'Avisos, condiciones o restricciones. Uno por línea.', ph: 'No incluye pilas\nColores sujetos a stock' },
  { kind: 'pasos', title: 'Cómo usar', Icon: ListOrdered, hint: 'Pasos en orden. Uno por línea.', ph: 'Limpia la superficie\nAplica dos capas' },
  { kind: 'nota', title: 'Nota', Icon: StickyNote, hint: 'Un texto destacado (garantía, cuidado, envío…).', ph: 'Garantía de 6 meses por defectos de fábrica.' },
]
const kindInfo = (k) => DETAIL_KINDS.find((d) => d.kind === k) || DETAIL_KINDS[0]
const newKey = () => Math.random().toString(36).slice(2)

function emptyVariant() {
  return { key: Math.random().toString(36).slice(2), label: '', price: '', compare_price: '', stock: '', unit: 'und', min_qty: '1', step: '1', sku: '' }
}

function toForm(product) {
  if (!product) {
    return {
      name: '', description: '', category_id: '', badge: '', featured: false, visible: true,
      images: [], tags: [], attributes: [], details: [], variants: [{ ...emptyVariant(), label: 'Único' }],
    }
  }
  const variants = [...(product.product_variants || [])]
    .sort((a, b) => a.sort - b.sort)
    .map((v) => ({
      key: v.id,
      id: v.id,
      label: v.label || '',
      price: v.price ?? '',
      compare_price: v.compare_price ?? '',
      stock: v.stock ?? '',
      unit: v.unit || 'und',
      min_qty: String(v.min_qty ?? 1),
      step: String(v.step ?? 1),
      sku: v.sku || '',
    }))
  return {
    name: product.name || '',
    description: product.description || '',
    category_id: product.category_id || '',
    badge: product.badge || '',
    featured: !!product.featured,
    visible: product.visible !== false,
    images: product.images || [],
    tags: product.tags || [],
    attributes: Object.entries(product.attributes || {}).map(([k, v]) => ({ key: Math.random().toString(36).slice(2), name: k, value: String(v) })),
    details: (Array.isArray(product.details) ? product.details : []).map((d) => ({
      key: newKey(), kind: d.kind || 'incluye', title: d.title || kindInfo(d.kind).title, text: (d.items || []).join('\n'),
    })),
    variants: variants.length ? variants : [{ ...emptyVariant(), label: 'Único' }],
  }
}

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

export default function ProductEditor({ tenantId, product, categories, modules, nextSort, onClose, onSaved, onCategoryCreated }) {
  const [form, setForm] = useState(() => toForm(product))
  const [uploading, setUploading] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [newCat, setNewCat] = useState(null)
  const [queue, setQueue] = useState([])
  const [adjusting, setAdjusting] = useState(null)
  const uploadedThisSession = useRef([])
  const removedImages = useRef([])
  const fileInput = useRef(null)

  const useStock = !!modules?.stock
  const usePeso = !!modules?.peso

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && cancel()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const cancel = async () => {
    if (saving) return
    if (uploadedThisSession.current.length) await removeImages(uploadedThisSession.current)
    onClose()
  }

  const onFiles = (files) => {
    setError('')
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, MAX_IMAGES - form.images.length - queue.length))
    if (list.length) setQueue((q) => [...q, ...list])
  }

  // Sube la imagen ya ajustada; si `replaceIdx` viene, reemplaza esa foto
  const uploadCropped = async (blob, replaceIdx = null) => {
    setUploading((n) => n + 1)
    try {
      const img = await uploadProductImage(tenantId, blob)
      uploadedThisSession.current.push(img)
      setForm((f) => {
        if (replaceIdx === null) return { ...f, images: [...f.images, img] }
        const old = f.images[replaceIdx]
        if (old) {
          if (uploadedThisSession.current.includes(old)) {
            uploadedThisSession.current = uploadedThisSession.current.filter((i) => i !== old)
            removeImages([old])
          } else removedImages.current.push(old)
        }
        return { ...f, images: f.images.map((x, i) => (i === replaceIdx ? img : x)) }
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading((n) => n - 1)
    }
  }

  const removeImage = (idx) => {
    const img = form.images[idx]
    const isNew = uploadedThisSession.current.includes(img)
    if (isNew) {
      uploadedThisSession.current = uploadedThisSession.current.filter((i) => i !== img)
      removeImages([img])
    } else {
      removedImages.current.push(img)
    }
    set({ images: form.images.filter((_, i) => i !== idx) })
  }

  const moveImage = (idx, to) => set({ images: moveTo(form.images, idx, to) })

  const setVariant = (key, patch) => set({ variants: form.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) })
  const addVariant = () => set({ variants: [...form.variants, emptyVariant()] })
  const removeVariant = (key) => form.variants.length > 1 && set({ variants: form.variants.filter((v) => v.key !== key) })

  const setDetail = (key, patch) => set({ details: form.details.map((d) => (d.key === key ? { ...d, ...patch } : d)) })
  const addDetail = (kind) => set({ details: [...form.details, { key: newKey(), kind, title: kindInfo(kind).title, text: '' }] })
  const moveDetail = (idx, to) => set({ details: moveTo(form.details, idx, to) })

  const addTag = () => {
    const parts = tagInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    if (!parts.length) return
    set({ tags: Array.from(new Set([...form.tags, ...parts])).slice(0, 30) })
    setTagInput('')
  }

  const createCategory = async () => {
    const name = (newCat || '').trim()
    if (!name) return setNewCat(null)
    const { data, error: err } = await supabase
      .from('categories')
      .insert({ tenant_id: tenantId, name, sort: categories.length })
      .select()
      .single()
    if (err) return setError(err.message)
    onCategoryCreated(data)
    set({ category_id: data.id })
    setNewCat(null)
  }

  const validate = () => {
    if (!form.name.trim()) return 'El producto necesita un nombre.'
    if (form.variants.length > 1 && form.variants.some((v) => !v.label.trim())) return 'Ponle nombre a cada variante (ej. 100 ml, Grande, 1 kg).'
    for (const v of form.variants) {
      if (v.price !== '' && (isNaN(Number(v.price)) || Number(v.price) < 0)) return 'Revisa los precios: deben ser números positivos.'
      if (v.compare_price !== '' && v.price !== '' && Number(v.compare_price) <= Number(v.price)) return 'El precio anterior debe ser mayor al precio actual.'
      if (useStock && v.stock !== '' && Number(v.stock) < 0) return 'El stock no puede ser negativo.'
      if (usePeso && (Number(v.min_qty) <= 0 || Number(v.step) <= 0)) return 'La cantidad mínima y el incremento deben ser mayores a 0.'
    }
    return ''
  }

  const save = async () => {
    const msg = validate()
    if (msg) return setError(msg)
    setError('')
    setSaving(true)

    try {
      const attributes = {}
      form.attributes.forEach((a) => {
        if (a.name.trim() && a.value.trim()) attributes[a.name.trim()] = a.value.trim()
      })

      const details = form.details
        .map((d) => ({
          kind: d.kind,
          title: d.title.trim() || kindInfo(d.kind).title,
          items: (d.kind === 'nota' ? [d.text.trim()] : d.text.split('\n').map((t) => t.trim())).filter(Boolean).slice(0, 30),
        }))
        .filter((d) => d.items.length)
        .slice(0, 8)

      const payload = {
        tenant_id: tenantId,
        category_id: form.category_id || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        badge: form.badge.trim() || null,
        featured: form.featured,
        visible: form.visible,
        images: form.images,
        tags: form.tags,
        attributes,
        // Solo se envía si hay algo (o ya había), así no falla si aún no se ejecutó la migración 008
        ...(details.length || (product && 'details' in product) ? { details } : {}),
      }

      let productId = product?.id
      if (productId) {
        const { error: err } = await supabase.from('products').update(payload).eq('id', productId)
        if (err) throw err
      } else {
        const { data, error: err } = await supabase.from('products').insert({ ...payload, sort: nextSort }).select('id').single()
        if (err) throw err
        productId = data.id
      }

      const rows = form.variants.map((v, i) => ({
        tenant_id: tenantId,
        product_id: productId,
        label: v.label.trim() || 'Único',
        price: num(v.price),
        compare_price: num(v.compare_price),
        stock: useStock ? num(v.stock) : null,
        unit: usePeso ? v.unit : 'und',
        min_qty: usePeso ? Number(v.min_qty) || 1 : 1,
        step: usePeso ? Number(v.step) || 1 : 1,
        sku: v.sku.trim() || null,
        visible: true,
        sort: i,
        ...(v.id ? { id: v.id } : {}),
      }))

      const keptIds = rows.filter((r) => r.id).map((r) => r.id)
      const originalIds = (product?.product_variants || []).map((v) => v.id)
      const removedIds = originalIds.filter((id) => !keptIds.includes(id))

      if (removedIds.length) {
        const { error: err } = await supabase.from('product_variants').delete().in('id', removedIds)
        if (err) throw err
      }
      const existing = rows.filter((r) => r.id)
      const fresh = rows.filter((r) => !r.id)
      if (existing.length) {
        const { error: err } = await supabase.from('product_variants').upsert(existing)
        if (err) throw err
      }
      if (fresh.length) {
        const { error: err } = await supabase.from('product_variants').insert(fresh)
        if (err) throw err
      }

      if (removedImages.current.length) await removeImages(removedImages.current)
      uploadedThisSession.current = []
      onSaved()
    } catch (e) {
      const missing = /details/.test(e.message || '') && /column|schema cache/i.test(e.message || '')
      setError(missing
        ? 'Para guardar “Más información” falta ejecutar la actualización 008 en Supabase (SQL Editor).'
        : e.message || 'No se pudo guardar el producto.')
      setSaving(false)
    }
  }

  return (
    <div className="drawer" role="dialog" aria-modal="true">
      <div className="drawer__backdrop" onClick={cancel} />
      <div className="drawer__panel drawer__panel--editor">
        <header className="drawer__head">
          <h2 className="display">{product ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button className="icon-btn" onClick={cancel} aria-label="Cerrar"><IconClose /></button>
        </header>

        <div className="drawer__body editor-body">
          <section className="form-block">
            <h3 className="form-block__title">Fotos</h3>
            <div className="image-grid">
              {form.images.map((img, i) => (
                <div key={img.path_full || img.full} className="image-tile">
                  <img src={img.thumb || img.full} alt="" />
                  {i === 0 && <span className="image-tile__cover">Portada</span>}
                  <PosSelect className="image-tile__pos" index={i} total={form.images.length} onChange={(to) => moveImage(i, to)} label="Orden de la foto" />
                  <div className="image-tile__actions">
                    <button type="button" onClick={() => setAdjusting(i)} aria-label="Ajustar foto" title="Ajustar"><Crop size={15} /></button>
                    <button type="button" onClick={() => removeImage(i)} aria-label="Quitar foto"><IconTrash width={15} height={15} /></button>
                  </div>
                </div>
              ))}
              {Array.from({ length: uploading }).map((_, i) => (
                <div key={`up-${i}`} className="image-tile image-tile--loading"><Loader /></div>
              ))}
              {form.images.length + uploading < MAX_IMAGES && (
                <button
                  type="button"
                  className="image-tile image-tile--add"
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    onFiles(e.dataTransfer.files)
                  }}
                >
                  <IconImage />
                  <small>Agregar foto</small>
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                onFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <small className="muted">Hasta {MAX_IMAGES} fotos. Al subirlas puedes moverlas y acercarlas para mostrar lo que quieras; la primera es la portada.</small>
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Información</h3>
            <label className="field">
              <span>Nombre</span>
              <input value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} />
            </label>

            <div className="field">
              <span>Categoría</span>
              {newCat === null ? (
                <div className="row">
                  <select value={form.category_id} onChange={(e) => set({ category_id: e.target.value })}>
                    <option value="">Sin categoría</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" className="btn btn--sm" onClick={() => setNewCat('')}><IconPlus width={16} height={16} /> Nueva</button>
                </div>
              ) : (
                <div className="row">
                  <input autoFocus placeholder="Nombre de la categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), createCategory())} />
                  <button type="button" className="btn btn--sm btn--primary" onClick={createCategory}>Crear</button>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => setNewCat(null)}>Cancelar</button>
                </div>
              )}
            </div>

            <label className="field">
              <span>Descripción</span>
              <textarea rows={4} maxLength={2000} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Etiqueta destacada</span>
                <input placeholder="Nuevo, Oferta, Más vendido…" maxLength={24} value={form.badge} onChange={(e) => set({ badge: e.target.value })} />
              </label>
              <div className="field field--switches">
                <Switch checked={form.visible} onChange={(v) => set({ visible: v })} label="Visible en el catálogo" />
                <Switch checked={form.featured} onChange={(v) => set({ featured: v })} label="Destacado" />
              </div>
            </div>
          </section>

          <section className="form-block">
            <div className="form-block__head">
              <h3 className="form-block__title">Variantes y precios</h3>
              <button type="button" className="btn btn--sm" onClick={addVariant}><IconPlus width={16} height={16} /> Variante</button>
            </div>
            <small className="muted">Tamaños, presentaciones, duraciones o medidas. Deja el precio vacío para mostrar “A consultar”.</small>

            <div className="variants">
              {form.variants.map((v) => (
                <div key={v.key} className="variant">
                  <div className="variant__grid">
                    <label className="field">
                      <span>Nombre</span>
                      <input placeholder={form.variants.length > 1 ? 'Ej. 100 ml' : 'Único'} value={v.label} onChange={(e) => setVariant(v.key, { label: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>Precio (S/)</span>
                      <input inputMode="decimal" placeholder="A consultar" value={v.price} onChange={(e) => setVariant(v.key, { price: e.target.value.replace(',', '.') })} />
                    </label>
                    <label className="field">
                      <span>Precio anterior</span>
                      <input inputMode="decimal" placeholder="Opcional" value={v.compare_price} onChange={(e) => setVariant(v.key, { compare_price: e.target.value.replace(',', '.') })} />
                    </label>
                    {useStock && (
                      <label className="field">
                        <span>Stock</span>
                        <input inputMode="decimal" placeholder="Sin control" value={v.stock} onChange={(e) => setVariant(v.key, { stock: e.target.value.replace(',', '.') })} />
                      </label>
                    )}
                    {usePeso && (
                      <>
                        <label className="field">
                          <span>Se vende por</span>
                          <select value={v.unit} onChange={(e) => setVariant(v.key, { unit: e.target.value })}>
                            {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
                        </label>
                        <label className="field">
                          <span>Cantidad mínima</span>
                          <input inputMode="decimal" value={v.min_qty} onChange={(e) => setVariant(v.key, { min_qty: e.target.value.replace(',', '.') })} />
                        </label>
                        <label className="field">
                          <span>Incremento</span>
                          <input inputMode="decimal" value={v.step} onChange={(e) => setVariant(v.key, { step: e.target.value.replace(',', '.') })} />
                        </label>
                      </>
                    )}
                    <label className="field">
                      <span>Código / SKU</span>
                      <input placeholder="Opcional" value={v.sku} onChange={(e) => setVariant(v.key, { sku: e.target.value })} />
                    </label>
                  </div>
                  {form.variants.length > 1 && (
                    <button type="button" className="icon-btn variant__remove" onClick={() => removeVariant(v.key)} aria-label="Quitar variante">
                      <IconTrash width={16} height={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Más información</h3>
            <small className="muted">Lo que el cliente ve al tocar “Ver detalles”: qué incluye, qué tener en cuenta, cómo usarlo. Agrega solo lo que te sirva.</small>
            {form.details.map((d, i) => {
              const info = kindInfo(d.kind)
              return (
                <div key={d.key} className="dblock" data-kind={d.kind}>
                  <div className="dblock__head">
                    <span className="dblock__icon"><info.Icon size={16} /></span>
                    <input className="dblock__title" value={d.title} maxLength={40} placeholder={info.title} onChange={(e) => setDetail(d.key, { title: e.target.value })} aria-label="Título del bloque" />
                    <PosSelect index={i} total={form.details.length} onChange={(to) => moveDetail(i, to)} label="Orden del bloque" />
                    <button type="button" className="icon-btn" onClick={() => set({ details: form.details.filter((x) => x.key !== d.key) })} aria-label="Quitar bloque"><IconTrash width={15} height={15} /></button>
                  </div>
                  <textarea rows={d.kind === 'nota' ? 2 : 3} maxLength={1500} value={d.text} placeholder={info.ph} onChange={(e) => setDetail(d.key, { text: e.target.value })} />
                  <small className="muted">{info.hint}</small>
                </div>
              )
            })}
            {form.details.length < 8 && (
              <div className="dblock-add">
                {DETAIL_KINDS.map((k) => (
                  <button key={k.kind} type="button" className="btn btn--sm" onClick={() => addDetail(k.kind)}>
                    <k.Icon size={15} /> {k.title}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="form-block">
            <div className="form-block__head">
              <h3 className="form-block__title">Características</h3>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => set({ attributes: [...form.attributes, { key: Math.random().toString(36).slice(2), name: '', value: '' }] })}
              >
                <IconPlus width={16} height={16} /> Campo
              </button>
            </div>
            <small className="muted">Datos libres que se muestran en el detalle: marca, aroma, talla, material, medida… Si varios productos usan el mismo campo (ej. Marca), aparece como filtro en tu catálogo.</small>
            {form.attributes.map((a) => (
              <div key={a.key} className="attr-row">
                <input placeholder="Campo (ej. Marca)" value={a.name} onChange={(e) => set({ attributes: form.attributes.map((x) => (x.key === a.key ? { ...x, name: e.target.value } : x)) })} />
                <input placeholder="Valor (ej. Stanley)" value={a.value} onChange={(e) => set({ attributes: form.attributes.map((x) => (x.key === a.key ? { ...x, value: e.target.value } : x)) })} />
                <button type="button" className="icon-btn" onClick={() => set({ attributes: form.attributes.filter((x) => x.key !== a.key) })} aria-label="Quitar campo">
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            ))}
          </section>

          <section className="form-block">
            <h3 className="form-block__title">Palabras clave</h3>
            <small className="muted">Otras formas en que tus clientes buscan este producto. Las usa el buscador y el bot (ej. foco, bombilla, lámpara).</small>
            <div className="tags">
              {form.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                  <button type="button" onClick={() => set({ tags: form.tags.filter((x) => x !== t) })} aria-label={`Quitar ${t}`}><IconClose width={12} height={12} /></button>
                </span>
              ))}
              <input
                className="tags__input"
                placeholder="Escribe y presiona Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                onBlur={addTag}
              />
            </div>
          </section>
        </div>

        <footer className="drawer__foot">
          {error && <p className="alert alert--error">{error}</p>}
          <div className="row row--end">
            <button className="btn btn--ghost" onClick={cancel} disabled={saving}>Cancelar</button>
            <button className="btn btn--primary" onClick={save} disabled={saving || uploading > 0}>
              {saving ? 'Guardando…' : uploading > 0 ? 'Subiendo fotos…' : 'Guardar producto'}
            </button>
          </div>
        </footer>
      </div>
      {queue.length > 0 && (
        <Cropper
          key={queue[0].name + queue.length}
          source={queue[0]}
          aspect={1}
          size={1200}
          fit
          background="#ffffff"
          title={queue.length > 1 ? `Ajusta la foto (${queue.length} pendientes)` : 'Ajusta la foto'}
          subtitle="Así se verá en la tarjeta del catálogo. Aleja para mostrarla completa."
          onClose={() => setQueue((q) => q.slice(1))}
          onDone={async (blob) => { setQueue((q) => q.slice(1)); uploadCropped(blob) }}
        />
      )}
      {adjusting !== null && form.images[adjusting] && (
        <Cropper
          source={form.images[adjusting].full}
          aspect={1}
          size={1200}
          fit
          background="#ffffff"
          title="Ajusta la foto"
          onClose={() => setAdjusting(null)}
          onDone={async (blob) => { const i = adjusting; setAdjusting(null); uploadCropped(blob, i) }}
        />
      )}
    </div>
  )
}
