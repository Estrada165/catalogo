import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { GUIDES, guideForPath } from './guides'

export { guideForPath }

/* ─── Estado global mínimo ─── */
let state = { guide: null, step: 0 }
const subs = new Set()
const emit = () => subs.forEach((f) => f())
const setState = (patch) => { state = { ...state, ...patch }; emit() }
const useTour = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)

const seenKey = (uid) => `guias:${uid || 'anon'}`
function seen(uid) {
  try { return JSON.parse(localStorage.getItem(seenKey(uid))) || {} } catch { return {} }
}
function markSeen(uid, id) {
  try { localStorage.setItem(seenKey(uid), JSON.stringify({ ...seen(uid), [id]: true })) } catch {}
}

let currentUser = null
export function startTour(id) { if (GUIDES[id]) setState({ guide: id, step: 0 }) }
function finish() { if (state.guide) markSeen(currentUser, state.guide); setState({ guide: null, step: 0 }) }

// Abre la guía de la sección la primera vez que se entra
export function useAutoTour(uid, id, ready = true) {
  useEffect(() => {
    if (!uid || !id || !ready || seen(uid)[id]) return
    const t = setTimeout(() => {
      if (state.guide || document.querySelector('.drawer, .sheet-root, [role="dialog"][aria-modal="true"]')) return
      startTour(id)
    }, 900)
    return () => clearTimeout(t)
  }, [uid, id, ready])
}

const PAD = 8
const GAP = 14

function findVisible(selector) {
  if (!selector) return null
  for (const sel of selector.split(',').map((s) => s.trim())) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el
    }
  }
  return null
}

export default function TourHost({ userId }) {
  currentUser = userId
  const { guide, step } = useTour()
  const steps = guide ? GUIDES[guide] : null
  const cur = steps?.[step]
  const [rect, setRect] = useState(null)
  const [h, setH] = useState(200)
  const card = useRef(null)

  useLayoutEffect(() => { if (card.current) setH(card.current.offsetHeight) })

  useLayoutEffect(() => {
    if (!cur) return
    const el = findVisible(cur.target)
    if (!el) { setRect(null); return }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const measure = () => setRect(el.getBoundingClientRect())
    measure()
    const t = setTimeout(measure, 380)
    addEventListener('resize', measure)
    addEventListener('scroll', measure, true)
    return () => { clearTimeout(t); removeEventListener('resize', measure); removeEventListener('scroll', measure, true) }
  }, [guide, step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!guide) return
    const k = (e) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') setState({ step: Math.max(0, state.step - 1) })
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [guide])

  if (!cur) return null
  const last = step === steps.length - 1
  function next() { if (state.step + 1 >= GUIDES[state.guide].length) finish(); else setState({ step: state.step + 1 }) }

  const vw = innerWidth, vh = innerHeight, M = 16
  const w = Math.min(340, vw - M * 2)
  const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b))
  let style
  if (rect) {
    const hx = rect.left - PAD, hy = rect.top - PAD, hw = rect.width + PAD * 2, hh = rect.height + PAD * 2
    const cx = clamp(hx + hw / 2 - w / 2, M, vw - w - M)
    const cy = clamp(hy + hh / 2 - h / 2, M, vh - h - M)
    if (hy + hh + GAP + h <= vh - M) style = { left: cx, top: hy + hh + GAP }
    else if (hy - GAP - h >= M) style = { left: cx, top: hy - GAP - h }
    else if (hx + hw + GAP + w <= vw - M) style = { left: hx + hw + GAP, top: cy }
    else if (hx - GAP - w >= M) style = { left: hx - GAP - w, top: cy }
    else style = { left: cx, top: vh - h - M }
  } else {
    style = { left: (vw - w) / 2, top: Math.max(M, (vh - h) / 2) }
  }
  style.width = w

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div className="tour__hole" style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
      ) : (
        <div className="tour__veil" onClick={finish} />
      )}
      <div className="tour__card" ref={card} style={style} key={`${guide}-${step}`}>
        <button className="icon-btn tour__close" onClick={finish} aria-label="Cerrar guía"><X size={16} /></button>
        <p className="tour__step">PASO {step + 1} DE {steps.length}</p>
        <h2 id="tour-title" className="tour__title">{cur.title}</h2>
        <p className="tour__text">{cur.text}</p>
        <div className="tour__foot">
          <div className="tour__dots" aria-hidden="true">
            {steps.map((_, i) => <span key={i} className={i === step ? 'is-on' : ''} />)}
          </div>
          {step === 0
            ? <button className="btn btn--ghost btn--sm" onClick={finish}>Saltar</button>
            : <button className="btn btn--sm" onClick={() => setState({ step: step - 1 })}>Atrás</button>}
          <button className="btn btn--primary btn--sm" onClick={next}>{last ? '¡Listo!' : 'Siguiente'}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
