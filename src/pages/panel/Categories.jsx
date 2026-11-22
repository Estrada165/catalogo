import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Switch from '../../components/Switch'
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '../../components/icons'

export default function Categories({ tenantId, categories, products, onChange }) {
  const [name, setName] = useState('')
  const [drafts, setDrafts] = useState({})
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const count = (id) => products.filter((p) => p.category_id === id).length

  const run = async (fn) => {
    setBusy(true)
    setError('')
    const { error: err } = await fn()
    if (err) setError(err.message)
    await onChange()
    setBusy(false)
  }

  const add = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setName('')
    run(() => supabase.from('categories').insert({ tenant_id: tenantId, name: n, sort: categories.length }))
  }

  const rename = (c) => {
    const n = (drafts[c.id] ?? c.name).trim()
    setDrafts((d) => {
      const { [c.id]: _, ...rest } = d
      return rest
    })
    if (!n || n === c.name) return
    run(() => supabase.from('categories').update({ name: n }).eq('id', c.id))
  }

  const move = (idx, dir) => {
    const to = idx + dir
    if (to < 0 || to >= categories.length) return
    const arr = [...categories]
    ;[arr[idx], arr[to]] = [arr[to], arr[idx]]
    run(() => supabase.from('categories').upsert(arr.map((c, i) => ({ ...c, sort: i }))))
  }

  const remove = (c) => {
    setConfirmId(null)
    run(() => supabase.from('categories').delete().eq('id', c.id))
  }

  return (
    <div className="page">
      <form className="card add-row" onSubmit={add}>
        <input placeholder="Nueva categoría" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn--primary" disabled={busy || !name.trim()}><IconPlus /> Agregar</button>
      </form>

      {error && <p className="alert alert--error">{error}</p>}

      {categories.length === 0 ? (
        <div className="card empty"><p>No tienes categorías. Los productos sin categoría igual se muestran en el catálogo.</p></div>
      ) : (
        <ul className="cat-list">
          {categories.map((c, i) => (
            <li key={c.id} className={`cat-row ${c.visible ? '' : 'is-hidden'}`}>
              <div className="cat-row__order">
                <button className="icon-btn" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Subir"><IconArrowUp width={16} height={16} /></button>
                <button className="icon-btn" disabled={busy || i === categories.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><IconArrowDown width={16} height={16} /></button>
              </div>
              <input
                className="cat-row__name"
                value={drafts[c.id] ?? c.name}
                maxLength={50}
                onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                onBlur={() => rename(c)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              <small className="muted cat-row__count">{count(c.id)} productos</small>
              <Switch checked={c.visible} disabled={busy} onChange={(v) => run(() => supabase.from('categories').update({ visible: v }).eq('id', c.id))} label="Visible" />
              {confirmId === c.id ? (
                <div className="row">
                  <button className="btn btn--sm btn--danger" onClick={() => remove(c)}>Eliminar</button>
                  <button className="btn btn--sm btn--ghost" onClick={() => setConfirmId(null)}>No</button>
                </div>
              ) : (
                <button className="icon-btn" disabled={busy} onClick={() => setConfirmId(c.id)} aria-label="Eliminar categoría"><IconTrash width={16} height={16} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {confirmId && count(confirmId) > 0 && (
        <p className="alert alert--warn">Los productos de esta categoría no se borran: quedarán como “Sin categoría”.</p>
      )}
    </div>
  )
}
