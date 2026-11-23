import { useEffect, useRef, useState } from 'react'
import { FileDown, ImageDown, Printer, MessageCircle, Pencil, Copy, Ban, RotateCcw } from 'lucide-react'
import { money } from '../../../lib/receipts'
import { waUrl } from '../../../lib/platform'
import { IconClose } from '../../../components/icons'
import ReceiptDoc from './ReceiptDoc'
import ScaledPreview from './ScaledPreview'
import { download, fileBase, makeImage, makePdf, printNode, shareFile } from './exporter'

// Ver una boleta emitida y sacarla: PDF, imagen, imprimir o enviarla por WhatsApp
export default function ReceiptViewer({ receipt, issuer, initialFormat, onClose, onEdit, onDuplicate, onToggleVoid }) {
  const [format, setFormat] = useState(initialFormat || issuer.format)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const doc = useRef(null)
  const base = fileBase(receipt.code, receipt.customer?.name)

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])

  const run = (key, fn) => async () => {
    setBusy(key)
    setMsg('')
    try { await fn() } catch (e) { setMsg(e?.message ? `No se pudo: ${e.message}` : 'No se pudo generar el archivo.') }
    setBusy('')
  }

  const pdf = run('pdf', async () => download(await makePdf(doc.current, format, `${base}.pdf`), `${base}.pdf`))
  const img = run('img', async () => {
    const r = await shareFile(await makeImage(doc.current), `${base}.png`, `Boleta ${receipt.code}`)
    if (r === 'downloaded') setMsg('Imagen descargada.')
  })
  const wa = run('wa', async () => {
    const blob = await makeImage(doc.current)
    const text = `🧾 Hola${receipt.customer?.name ? ` ${receipt.customer.name.split(' ')[0]}` : ''}, te envío tu boleta *${receipt.code}* de *${issuer.name || 'nuestra tienda'}* por *${money(receipt.total)}*. ¡Gracias por tu compra! 🙌`
    const r = await shareFile(blob, `${base}.png`, text)
    // En computadora: se descarga la imagen y se abre el chat para adjuntarla
    if (r === 'downloaded') {
      const phone = String(receipt.customer?.phone || '').replace(/\D/g, '')
      if (phone.length >= 9) window.open(waUrl(phone.length === 9 ? `51${phone}` : phone, text), '_blank', 'noopener')
      setMsg('Se descargó la imagen: adjúntala en el chat de WhatsApp.')
    }
  })

  const voided = receipt.status === 'anulada'

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label={`Boleta ${receipt.code}`}>
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel drawer__panel--viewer">
        <header className="drawer__head">
          <div>
            <h2 className="display">{receipt.code}</h2>
            <small className="muted">{receipt.customer?.name || 'Sin cliente'} · {money(receipt.total)}{voided ? ' · Anulada' : ''}</small>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
        </header>
        <div className="drawer__body rc-view">
          <div className="rc-side__bar">
            <div className="segmented segmented--sm">
              <button className={format === 'a4' ? 'is-active' : ''} onClick={() => setFormat('a4')}>Hoja A4</button>
              <button className={format === 'ticket' ? 'is-active' : ''} onClick={() => setFormat('ticket')}>Ticket 80 mm</button>
            </div>
          </div>
          <div className={`rc-paper rc-paper--${format}`}>
            <ScaledPreview docWidth={format === 'ticket' ? 302 : 794} max={format === 'ticket' ? 1.15 : 1}>
              <ReceiptDoc ref={doc} receipt={receipt} issuer={issuer} format={format} />
            </ScaledPreview>
          </div>
        </div>
        <footer className="drawer__foot rc-actions">
          {msg && <p className="muted rc-msg">{msg}</p>}
          <div className="rc-actions__main">
            <button className="btn btn--primary" onClick={pdf} disabled={!!busy}><FileDown size={17} /> {busy === 'pdf' ? 'Generando…' : 'Descargar PDF'}</button>
            <button className="btn btn--wa" onClick={wa} disabled={!!busy}><MessageCircle size={17} /> {busy === 'wa' ? 'Preparando…' : 'WhatsApp'}</button>
            <button className="btn" onClick={img} disabled={!!busy}><ImageDown size={17} /> Imagen</button>
            <button className="btn" onClick={() => printNode(doc.current)} disabled={!!busy}><Printer size={17} /> Imprimir</button>
          </div>
          <div className="rc-actions__more">
            <button className="btn btn--sm btn--ghost" onClick={onEdit}><Pencil size={15} /> Editar</button>
            <button className="btn btn--sm btn--ghost" onClick={onDuplicate}><Copy size={15} /> Duplicar</button>
            <button className="btn btn--sm btn--ghost" onClick={onToggleVoid}>{voided ? <><RotateCcw size={15} /> Restaurar</> : <><Ban size={15} /> Anular</>}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
