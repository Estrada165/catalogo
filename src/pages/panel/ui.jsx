import { useEffect, useMemo, useRef, useState } from 'react'
import { uploadAsset } from '../../lib/images'
import { IconImage, IconTrash } from '../../components/icons'
import Loader from '../../components/Loader'

// Copia editable de un objeto, con "hay cambios" y "deshacer"
export function useDraft(source) {
  const [draft, setDraft] = useState(source)
  const base = useRef(JSON.stringify(source))
  useEffect(() => {
    base.current = JSON.stringify(source)
    setDraft(source)
  }, [source])
  const dirty = useMemo(() => JSON.stringify(draft) !== base.current, [draft])
  const set = (patch) => setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }))
  const reset = () => setDraft(JSON.parse(base.current))
  return [draft, set, dirty, reset, setDraft]
}

export function Section({ title, hint, action, children }) {
  return (
    <section className="form-block">
      {(title || action) && (
        <div className="form-block__head">
          <h3 className="form-block__title">{title}</h3>
          {action}
        </div>
      )}
      {hint && <small className="muted">{hint}</small>}
      {children}
    </section>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  )
}

export function SaveBar({ dirty, saving, onSave, onReset, error, saved }) {
  if (!dirty && !error && !saved) return null
  return (
    <div className={`savebar ${dirty ? 'is-dirty' : ''}`}>
      <span className={error ? 'text-error' : 'muted'}>
        {error || (dirty ? 'Tienes cambios sin guardar' : 'Cambios guardados')}
      </span>
      {dirty && (
        <div className="row">
          <button className="btn btn--ghost" onClick={onReset} disabled={saving}>Descartar</button>
          <button className="btn btn--primary" onClick={onSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      )}
    </div>
  )
}

// Hook de guardado con estado y mensaje de éxito temporal
export function useSaver(fn) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const run = async (...args) => {
    setSaving(true)
    setError('')
    try {
      await fn(...args)
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (e) {
      setError(e.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }
  return { saving, error, saved, run }
}

export function ImagePicker({ tenantId, folder, value, onChange, size = 512, label = 'Subir imagen', round = false }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pick = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const out = await uploadAsset(tenantId, file, folder, size)
      onChange(out)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="img-picker">
      <button type="button" className={`img-picker__box ${round ? 'is-round' : ''}`} onClick={() => input.current?.click()}>
        {busy ? <Loader /> : value ? <img src={value} alt="" /> : <><IconImage /><small>{label}</small></>}
      </button>
      {value && !busy && (
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange(null)}><IconTrash width={15} height={15} /> Quitar</button>
      )}
      {error && <small className="text-error">{error}</small>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="segmented segmented--scroll">
      {tabs.map((t) => (
        <button key={t.key} className={value === t.key ? 'is-active' : ''} onClick={() => onChange(t.key)}>{t.label}</button>
      ))}
    </div>
  )
}
