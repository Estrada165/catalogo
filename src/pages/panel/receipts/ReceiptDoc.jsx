import { forwardRef } from 'react'
import { amountInWords, computeTotals, money, qtyText } from '../../../lib/receipts'
import './receipt.css'

const fmtDate = (iso) => {
  const d = new Date(iso || Date.now())
  return {
    date: d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
  }
}

// El documento en sí (A4 o ticket de 80 mm). Se usa para la vista previa, imprimir, PDF e imagen.
const ReceiptDoc = forwardRef(function ReceiptDoc({ receipt, issuer, format = 'a4', code }, ref) {
  const t = computeTotals(receipt)
  const c = receipt.customer || {}
  const when = fmtDate(receipt.issued_at)
  const hasLineDisc = t.lines.some((it) => Number(it.discount) > 0)
  const name = (issuer.name || '').trim()
  const logo = issuer.logo
  const contact = [issuer.address, issuer.phone && `Tel. ${issuer.phone}`, issuer.email].filter(Boolean)
  const bare = !name && !logo && !issuer.ruc && !contact.length
  const number = code || receipt.code || `${receipt.series || 'NV01'}-${'0'.repeat(6)}`
  const custRows = [
    c.name && ['Cliente', c.name],
    c.doc_number && [c.doc_type || 'DNI', c.doc_number],
    c.address && ['Dirección', c.address],
    c.phone && ['Teléfono', c.phone],
  ].filter(Boolean)
  const discLabel = receipt.discount_type === 'percent' && Number(receipt.discount_value) > 0 ? `Descuento (${Number(receipt.discount_value)}%)` : 'Descuento'

  return (
    <div ref={ref} className={`rcpt rcpt--${format}${receipt.status === 'anulada' ? ' is-void' : ''}`} style={{ '--rc-accent': issuer.accent || '#18181B' }}>
      {receipt.status === 'anulada' && <div className="rcpt__void" aria-hidden="true">ANULADA</div>}

      <header className={`rcpt__head${bare ? ' is-bare' : ''}`}>
        {!bare && <div className="rcpt__brand">
          {logo && <img className="rcpt__logo" src={logo} alt="" crossOrigin="anonymous" />}
          <div className="rcpt__issuer">
            {name && <strong className={logo ? '' : 'is-big'}>{name}</strong>}
            {issuer.ruc && <span>RUC {issuer.ruc}</span>}
            {contact.map((x, i) => <span key={i}>{x}</span>)}
          </div>
        </div>}
        <div className="rcpt__box">
          <span className="rcpt__type">Nota de venta</span>
          <strong className="rcpt__num">{number}</strong>
          <span className="rcpt__date">{when.date} · {when.time}</span>
        </div>
      </header>

      {custRows.length > 0 && (
        <section className="rcpt__cust">
          {custRows.map(([k, v]) => (
            <div key={k}><span>{k}</span><b>{v}</b></div>
          ))}
        </section>
      )}

      <table className="rcpt__table">
        <thead>
          <tr>
            <th className="is-qty">Cant.</th>
            <th>Descripción</th>
            <th className="is-num">P. unit.</th>
            {hasLineDisc && <th className="is-num">Desc.</th>}
            <th className="is-num">Importe</th>
          </tr>
        </thead>
        <tbody>
          {t.lines.length === 0 && (
            <tr><td colSpan={hasLineDisc ? 5 : 4} className="rcpt__empty">Agrega productos o servicios</td></tr>
          )}
          {t.lines.map((it, i) => (
            <tr key={i}>
              <td className="is-qty">{qtyText(it.qty, it.unit)}</td>
              <td className="is-desc">{it.description}</td>
              <td className="is-num">{money(it.unit_price)}</td>
              {hasLineDisc && <td className="is-num">{Number(it.discount) > 0 ? `-${money(it.discount)}` : '—'}</td>}
              <td className="is-num">{money(Math.max(0, Number(it.qty) * Number(it.unit_price || 0) - Number(it.discount || 0)))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="rcpt__sum">
        <div className="rcpt__words">
          <p>{amountInWords(t.total)}</p>
          {receipt.payment_method && <p><span>Forma de pago:</span> {receipt.payment_method}</p>}
          {receipt.notes && <p><span>Observaciones:</span> {receipt.notes}</p>}
        </div>
        <dl className="rcpt__totals">
          {(t.discount > 0 || receipt.igv) && <div><dt>Subtotal</dt><dd>{money(t.subtotal)}</dd></div>}
          {t.discount > 0 && <div><dt>{discLabel}</dt><dd>-{money(t.discount)}</dd></div>}
          {receipt.igv && <div><dt>Op. gravada</dt><dd>{money(t.taxable)}</dd></div>}
          {receipt.igv && <div><dt>IGV ({t.rate}%)</dt><dd>{money(t.igv_amount)}</dd></div>}
          <div className="rcpt__total"><dt>Total</dt><dd>{money(t.total)}</dd></div>
        </dl>
      </section>

      <footer className="rcpt__foot">
        {issuer.footer && <p className="rcpt__thanks">{issuer.footer}</p>}
        <p className="rcpt__legal">Documento interno sin valor tributario. No válido como comprobante de pago ante SUNAT.</p>
      </footer>
    </div>
  )
})

export default ReceiptDoc
