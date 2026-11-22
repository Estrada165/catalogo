import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import QRCodeStyling from 'qr-code-styling'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Loader from '../../components/Loader'
import Switch from '../../components/Switch'
import { IconCopy, IconCheck, IconQr } from '../../components/icons'
import { Field, SaveBar, Section, useDraft, useSaver } from './ui'

const DOTS = [
  { key: 'rounded', name: 'Redondeado' },
  { key: 'dots', name: 'Puntos' },
  { key: 'classy-rounded', name: 'Elegante' },
  { key: 'extra-rounded', name: 'Fluido' },
  { key: 'square', name: 'Clásico' },
]
const CORNERS = [
  { key: 'extra-rounded', name: 'Redondas' },
  { key: 'dot', name: 'Círculo' },
  { key: 'square', name: 'Cuadradas' },
]
const FORMATS = [
  { key: 'sticker', name: 'Sticker', size: [1200, 1200], desc: 'Cuadrado, para mostrador o bolsas' },
  { key: 'tarjeta', name: 'Tarjeta A6', size: [1240, 1748], desc: 'Para imprimir y poner en tu local' },
  { key: 'historia', name: 'Historia', size: [1080, 1920], desc: 'Para estados de WhatsApp e Instagram' },
  { key: 'solo', name: 'Solo QR', size: [1200, 1200], desc: 'Sin texto ni marco' },
]

const DEFAULT = {
  dots: 'rounded', corners: 'extra-rounded', color: '#121316', bg: '#FFFFFF', accent: null,
  logo: true, format: 'tarjeta', title: '', subtitle: 'Escanea y mira nuestro catálogo', cta: 'Haz tu pedido por WhatsApp',
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fitText(ctx, text, maxW, size, weight = 700, family = 'Clash Display, Satoshi, system-ui, sans-serif') {
  let s = size
  do {
    ctx.font = `${weight} ${s}px ${family}`
    if (ctx.measureText(text).width <= maxW) break
    s -= 2
  } while (s > 16)
  return s
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

async function composeImage({ design, qrBlob, logo, name, url, accent }) {
  const fmt = FORMATS.find((f) => f.key === design.format) || FORMATS[0]
  const [W, H] = fmt.size
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const qrImg = await createImageBitmap(qrBlob)
  await document.fonts?.ready
  const acc = design.accent || accent || '#FF6B35'

  if (design.format === 'solo') {
    ctx.fillStyle = design.bg
    ctx.fillRect(0, 0, W, H)
    ctx.drawImage(qrImg, 60, 60, W - 120, H - 120)
    return c
  }

  // Fondo
  ctx.fillStyle = acc
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.85, H * 0.05, 10, W * 0.85, H * 0.05, W)
  glow.addColorStop(0, 'rgba(255,255,255,.28)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const pad = Math.round(W * 0.07)
  const cardX = pad
  const cardW = W - pad * 2
  const top = design.format === 'sticker' ? pad : Math.round(H * 0.06)
  const cardY = top
  const cardH = H - top - pad
  ctx.fillStyle = 'rgba(0,0,0,.18)'
  roundRect(ctx, cardX, cardY + 14, cardW, cardH, 48)
  ctx.fill()
  ctx.fillStyle = design.bg
  roundRect(ctx, cardX, cardY, cardW, cardH, 48)
  ctx.fill()

  const inner = cardW - pad * 1.4
  const cx = W / 2
  let y = cardY + pad * 0.9
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  if (logo && design.format !== 'sticker') {
    const s = Math.round(W * 0.15)
    ctx.save()
    roundRect(ctx, cx - s / 2, y, s, s, s * 0.28)
    ctx.clip()
    ctx.drawImage(logo, cx - s / 2, y, s, s)
    ctx.restore()
    y += s + pad * 0.45
  }

  const title = design.title || name
  const ts = fitText(ctx, title, inner, design.format === 'sticker' ? 74 : 92)
  ctx.fillStyle = design.color
  ctx.font = `700 ${ts}px Clash Display, Satoshi, system-ui, sans-serif`
  ctx.fillText(title, cx, y)
  y += ts * 1.15

  if (design.subtitle) {
    ctx.font = `500 ${Math.round(W * 0.034)}px Satoshi, system-ui, sans-serif`
    ctx.fillStyle = design.color
    ctx.globalAlpha = 0.72
    for (const l of wrap(ctx, design.subtitle, inner)) { ctx.fillText(l, cx, y); y += W * 0.045 }
    ctx.globalAlpha = 1
  }

  const bottomSpace = design.format === 'sticker' ? pad * 1.3 : pad * 2.6
  const qrSize = Math.min(inner, cardY + cardH - y - bottomSpace - pad * 0.4)
  const qy = y + pad * 0.4
  ctx.drawImage(qrImg, cx - qrSize / 2, qy, qrSize, qrSize)
  y = qy + qrSize + pad * 0.45

  if (design.cta && design.format !== 'sticker') {
    const fs = Math.round(W * 0.036)
    ctx.font = `700 ${fs}px Satoshi, system-ui, sans-serif`
    const tw = Math.min(inner, ctx.measureText(design.cta).width + fs * 2.2)
    ctx.fillStyle = acc
    roundRect(ctx, cx - tw / 2, y, tw, fs * 2.3, fs * 1.15)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    ctx.fillText(design.cta, cx, y + fs * 1.15)
    ctx.textBaseline = 'top'
    y += fs * 2.9
  }

  ctx.font = `600 ${Math.round(W * 0.028)}px Satoshi, system-ui, sans-serif`
  ctx.fillStyle = design.color
  ctx.globalAlpha = 0.55
  ctx.fillText(url.replace(/^https?:\/\//, ''), cx, Math.min(y, cardY + cardH - pad * 0.9))
  ctx.globalAlpha = 1
  return c
}

export default function QrPage() {
  const { tenant } = useAuth()
  const { config } = useOutletContext()
  const [qr, setQr] = useState(null)
  const [copied, setCopied] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const qrRef = useRef(null)

  useEffect(() => {
    supabase.from('qr_codes').select('*').eq('tenant_id', tenant.id).order('created_at').limit(1).maybeSingle().then(async ({ data }) => {
      if (data) return setQr(data)
      const { data: created } = await supabase.from('qr_codes').insert({ tenant_id: tenant.id }).select().single()
      setQr(created)
    })
  }, [tenant.id])

  const source = useMemo(() => ({ ...DEFAULT, ...(qr?.design || {}) }), [qr])
  const [d, set, dirty, reset] = useDraft(source)
  const saver = useSaver(async () => {
    const { data, error } = await supabase.from('qr_codes').update({ design: d }).eq('code', qr.code).select().single()
    if (error) throw error
    setQr(data)
  })

  const link = qr ? `${window.location.origin}/q/${qr.code}` : ''
  const logoUrl = config?.business?.logo || null
  const accent = config?.theme?.accent || '#FF6B35'
  const name = config?.business?.name || tenant.name

  const qrOptions = useCallback((type = 'canvas') => ({
      type,
      width: 1000,
      height: 1000,
      data: link,
      margin: 0,
      qrOptions: { errorCorrectionLevel: d.logo && logoUrl ? 'H' : 'Q' },
      dotsOptions: { type: d.dots, color: d.color },
      cornersSquareOptions: { type: d.corners, color: d.accent || d.color },
      cornersDotOptions: { type: d.corners === 'square' ? 'square' : 'dot', color: d.color },
      backgroundOptions: { color: d.bg },
      image: d.logo && logoUrl ? logoUrl : undefined,
      imageOptions: { crossOrigin: 'anonymous', margin: 14, imageSize: 0.32, hideBackgroundDots: true },
  }), [link, d, logoUrl])
  const buildQr = useCallback(() => new QRCodeStyling(qrOptions('canvas')), [qrOptions])

  // Vista previa
  useEffect(() => {
    if (!qr) return
    let alive = true
    const t = setTimeout(async () => {
      try {
        const code = buildQr()
        const blob = await code.getRawData('png')
        const logo = await loadImage(logoUrl)
        const canvas = await composeImage({ design: d, qrBlob: blob, logo, name, url: `${window.location.host}/${tenant.slug}`, accent })
        if (!alive) return
        canvas.toBlob((b) => {
          if (!alive || !b) return
          setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b) })
        }, 'image/png')
      } catch {}
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [qr, d, buildQr, logoUrl, name, tenant.slug, accent])

  const download = async () => {
    setBusy(true)
    try {
      const code = buildQr()
      const blob = await code.getRawData('png')
      const logo = await loadImage(logoUrl)
      const canvas = await composeImage({ design: d, qrBlob: blob, logo, name, url: `${window.location.host}/${tenant.slug}`, accent })
      const a = document.createElement('a')
      a.download = `qr-${tenant.slug}-${d.format}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } finally {
      setBusy(false)
    }
  }
  const downloadSvg = () => {
    const code = new QRCodeStyling(qrOptions('svg'))
    code.download({ name: `qr-${tenant.slug}`, extension: 'svg' })
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  if (!qr) return <div className="page"><Loader /></div>

  return (
    <div className="page">
      <header className="page__head"><h1 className="display">Mi QR</h1></header>
      <p className="muted page__lead">Este QR siempre lleva a tu catálogo, aunque cambies tu enlace. Cada escaneo se cuenta en la analítica.</p>

      <div className="qr-grid">
        <div className="qr-form">
          <Section title="Enlace del QR">
            <div className="link-card link-card--flat">
              <p className="link-card__url">{link.replace(/^https?:\/\//, '')}</p>
              <button className="btn btn--sm" onClick={copy}>{copied ? <IconCheck width={15} height={15} /> : <IconCopy width={15} height={15} />} {copied ? 'Copiado' : 'Copiar'}</button>
            </div>
          </Section>

          <Section title="Formato">
            <div className="option-grid">
              {FORMATS.map((f) => (
                <button key={f.key} className={`option-card ${d.format === f.key ? 'is-on' : ''}`} onClick={() => set({ format: f.key })}>
                  <strong>{f.name}</strong><small>{f.desc}</small>
                </button>
              ))}
            </div>
          </Section>

          {d.format !== 'solo' && (
            <Section title="Textos">
              <Field label="Título" hint={`Si lo dejas vacío: ${name}`}><input value={d.title} maxLength={40} onChange={(e) => set({ title: e.target.value })} /></Field>
              <Field label="Subtítulo"><input value={d.subtitle} maxLength={70} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
              {d.format !== 'sticker' && <Field label="Botón"><input value={d.cta} maxLength={40} onChange={(e) => set({ cta: e.target.value })} /></Field>}
            </Section>
          )}

          <Section title="Diseño del código">
            <div className="field">
              <span>Puntos</span>
              <div className="chips-add">{DOTS.map((x) => <button key={x.key} className={`btn btn--sm ${d.dots === x.key ? 'btn--primary' : ''}`} onClick={() => set({ dots: x.key })}>{x.name}</button>)}</div>
            </div>
            <div className="field">
              <span>Esquinas</span>
              <div className="chips-add">{CORNERS.map((x) => <button key={x.key} className={`btn btn--sm ${d.corners === x.key ? 'btn--primary' : ''}`} onClick={() => set({ corners: x.key })}>{x.name}</button>)}</div>
            </div>
            <div className="form-grid">
              <Field label="Color del código"><input type="color" value={d.color} onChange={(e) => set({ color: e.target.value })} /></Field>
              <Field label="Color de esquinas"><input type="color" value={d.accent || d.color} onChange={(e) => set({ accent: e.target.value })} /></Field>
              <Field label="Fondo"><input type="color" value={d.bg} onChange={(e) => set({ bg: e.target.value })} /></Field>
            </div>
            <Switch checked={d.logo && !!logoUrl} disabled={!logoUrl} onChange={(v) => set({ logo: v })} label={logoUrl ? 'Logo en el centro' : 'Sube tu logo en Configuración para ponerlo al centro'} />
            <small className="muted">Usa colores oscuros sobre fondo claro: si el contraste es bajo, algunos celulares no lo leen.</small>
          </Section>
          <SaveBar dirty={dirty} {...saver} onSave={saver.run} onReset={reset} />
        </div>

        <aside className="qr-preview">
          <div className="qr-preview__img" ref={qrRef}>
            {previewUrl ? <img src={previewUrl} alt="Vista previa del QR" /> : <div className="qr-preview__ph"><IconQr width={40} height={40} /></div>}
          </div>
          <div className="row">
            <button className="btn btn--primary" onClick={download} disabled={busy}>{busy ? 'Preparando…' : 'Descargar PNG'}</button>
            <button className="btn" onClick={downloadSvg}>Solo QR en SVG</button>
          </div>
        </aside>
      </div>
    </div>
  )
}
