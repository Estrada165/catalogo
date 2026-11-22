import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ZoomIn, ZoomOut, RotateCcw, Check, Move, X } from 'lucide-react'

// Ajuste manual de imágenes (como WhatsApp / Instagram): se ve la foto completa con la zona
// que se mostrará bien marcada. Se arrastra para acomodar y se hace zoom con la barra,
// la rueda del mouse o pellizcando en el celular.
//   shape: 'rect' | 'circle' · aspect: ancho/alto · size: lado mayor final en px
//   fit: permite alejar hasta ver la imagen entera (lo que sobra queda con `background` o transparente)
//   guide: 'qr' dibuja esquinas de visor
export default function Cropper({ source, shape = 'rect', aspect = 1, size = 1200, fit = false, background = null, guide = null, title, subtitle, onDone, onClose }) {
  const [img, setImg] = useState(null)
  const [box, setBox] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [moving, setMoving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const stage = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  useEffect(() => {
    let alive = true
    let url
    ;(async () => {
      try {
        const blob = source instanceof Blob ? source : await fetch(source, { mode: 'cors' }).then((r) => r.blob())
        const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
        url = URL.createObjectURL(blob)
        if (alive) setImg({ bitmap, url, w: bitmap.width, h: bitmap.height })
      } catch {
        if (alive) setError('No se pudo leer la imagen.')
      }
    })()
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [source])

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const m = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    m()
    const ro = new ResizeObserver(m)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const margin = 26
  const rec = box && (() => {
    const maxW = box.w - margin * 2, maxH = box.h - margin * 2
    const w = Math.min(maxW, maxH * aspect)
    return { w, h: w / aspect, x: (box.w - w) / 2, y: (box.h - w / aspect) / 2 }
  })()
  const cover = img && rec ? Math.max(rec.w / img.w, rec.h / img.h) : 1
  const contain = img && rec ? Math.min(rec.w / img.w, rec.h / img.h) : 1
  const minZoom = fit ? contain / cover : 1
  const maxZoom = 5
  const scale = cover * zoom

  const limit = (p, s = scale) => {
    if (!img || !rec) return p
    const iw = img.w * s, ih = img.h * s
    const lim = (v, t, r) => (t >= r ? Math.min(0, Math.max(r - t, v)) : (r - t) / 2)
    return { x: lim(p.x, iw, rec.w), y: lim(p.y, ih, rec.h) }
  }

  useEffect(() => {
    if (!img || !rec) return
    setZoom(1)
    setPos(limit({ x: (rec.w - img.w * cover) / 2, y: (rec.h - img.h * cover) / 2 }, cover))
  }, [img, box?.w, box?.h]) // eslint-disable-line react-hooks/exhaustive-deps

  const changeZoom = (nz, cx = rec?.w / 2, cy = rec?.h / 2) => {
    const z = Math.min(maxZoom, Math.max(minZoom, nz))
    const s0 = scale, s1 = cover * z
    setZoom(z)
    setPos((p) => limit({ x: cx - (cx - p.x) * (s1 / s0), y: cy - (cy - p.y) * (s1 / s0) }, s1))
  }

  const onDown = (e) => {
    if (!img) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setMoving(true)
    const ps = [...pointers.current.values()]
    gesture.current = ps.length === 2
      ? { type: 'pinch', d0: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), z0: zoom }
      : { type: 'move', x0: e.clientX, y0: e.clientY, p0: pos }
  }
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (g.type === 'move') setPos(limit({ x: g.p0.x + e.clientX - g.x0, y: g.p0.y + e.clientY - g.y0 }))
    else {
      const ps = [...pointers.current.values()]
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y)
      const r = stage.current.getBoundingClientRect()
      changeZoom(g.z0 * (d / g.d0), (ps[0].x + ps[1].x) / 2 - r.left - rec.x, (ps[0].y + ps[1].y) / 2 - r.top - rec.y)
    }
  }
  const onUp = (e) => {
    pointers.current.delete(e.pointerId)
    const ps = [...pointers.current.entries()]
    gesture.current = ps.length === 1 ? { type: 'move', x0: ps[0][1].x, y0: ps[0][1].y, p0: pos } : null
    if (!ps.length) setMoving(false)
  }

  useEffect(() => {
    const el = stage.current
    const fn = (e) => {
      e.preventDefault()
      if (!img || !rec) return
      const r = el.getBoundingClientRect()
      changeZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left - rec.x, e.clientY - r.top - rec.y)
    }
    el?.addEventListener('wheel', fn, { passive: false })
    return () => el?.removeEventListener('wheel', fn)
  })

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); if (!busy) onClose() } }
    addEventListener('keydown', fn, true)
    return () => removeEventListener('keydown', fn, true)
  }, [busy, onClose])

  const reset = () => { setZoom(1); setPos(limit({ x: (rec.w - img.w * cover) / 2, y: (rec.h - img.h * cover) / 2 }, cover)) }

  const done = async () => {
    if (!img || !rec) return
    setBusy(true)
    try {
      const W = Math.max(1, Math.round(Math.min(aspect >= 1 ? size : size * aspect, rec.w / scale)))
      const H = Math.max(1, Math.round(W / aspect))
      const k = W / rec.w
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const ctx = c.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, W, H) }
      ctx.drawImage(img.bitmap, pos.x * k, pos.y * k, img.w * scale * k, img.h * scale * k)
      let blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.9))
      if (!blob || blob.type !== 'image/webp') blob = await new Promise((ok) => c.toBlob(ok, background ? 'image/jpeg' : 'image/png', 0.9))
      await onDone(blob)
    } catch (e) {
      setError(e?.message || 'No se pudo ajustar la imagen.')
      setBusy(false)
    }
  }

  const round = shape === 'circle'
  const radius = round ? '50%' : '14px'

  return createPortal(
    <div className="crop" role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <div className="crop__backdrop" onClick={() => !busy && onClose()} />
      <div className="crop__panel">
        <header className="crop__head">
          <div>
            <h2 id="crop-title">{title || (round ? 'Acomoda tu foto' : 'Acomoda la imagen')}</h2>
            <small>{subtitle || 'Arrastra para mover · acerca o aleja con la barra'}</small>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div
          ref={stage}
          className={`crop__stage ${moving ? 'is-moving' : ''}`}
          style={{ aspectRatio: aspect >= 1 ? '4 / 3' : '3 / 4' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {!img && !error && <div className="crop__loading"><span className="spin-ring" /></div>}
          {error && <div className="crop__loading">{error}</div>}
          {img && rec && (
            <>
              <img src={img.url} alt="" draggable={false} className="crop__img"
                style={{ left: rec.x + pos.x, top: rec.y + pos.y, width: img.w * scale, height: img.h * scale }} />
              <div className="crop__frame" style={{ left: rec.x, top: rec.y, width: rec.w, height: rec.h, borderRadius: radius, background: background && zoom < 1 ? 'transparent' : undefined }}>
                {guide === 'qr' && ['tl', 'tr', 'bl', 'br'].map((c) => <span key={c} className={`crop__qr crop__qr--${c}`} />)}
                <div className="crop__thirds" style={{ borderRadius: radius }}>
                  <i style={{ left: '33.33%' }} /><i style={{ left: '66.66%' }} />
                  <b style={{ top: '33.33%' }} /><b style={{ top: '66.66%' }} />
                </div>
              </div>
              {!moving && <span className="crop__hint"><Move size={12} /> Arrastra para acomodar</span>}
            </>
          )}
        </div>

        <div className="crop__zoom">
          <button className="icon-btn" onClick={() => changeZoom(zoom / 1.25)} aria-label="Alejar"><ZoomOut size={18} /></button>
          <input type="range" min={minZoom} max={maxZoom} step={0.01} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} aria-label="Zoom" />
          <button className="icon-btn" onClick={() => changeZoom(zoom * 1.25)} aria-label="Acercar"><ZoomIn size={18} /></button>
          <button className="icon-btn" onClick={reset} aria-label="Reiniciar" title="Reiniciar"><RotateCcw size={17} /></button>
        </div>
        {fit && <small className="crop__note">Puedes alejar hasta ver la imagen completa.</small>}

        <footer className="crop__foot">
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn btn--primary" onClick={done} disabled={!img || busy}>
            {busy ? 'Guardando…' : <><Check size={17} /> Usar {round ? 'esta foto' : 'esta imagen'}</>}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
