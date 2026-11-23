// Exportar la boleta: PDF, imagen (para WhatsApp) e impresión. Las librerías se cargan solo al usarlas.

// Datos del emisor: lo que el dueño puso en Configuración → Boletas, con respaldo en los datos del negocio
export function issuerFrom(config, tenant) {
  const b = config?.business || {}
  const r = b.receipt || {}
  const phone = String(r.phone ?? b.whatsapp ?? '').replace(/^51(?=9\d{8}$)/, '')
  return {
    name: (r.name ?? b.name ?? tenant?.name ?? '').trim(),
    logo: r.show_logo === false ? null : b.logo || null,
    ruc: (r.ruc || '').trim(),
    address: (r.address ?? b.address ?? '').trim(),
    phone: phone.trim(),
    email: (r.email || '').trim(),
    footer: r.footer ?? '¡Gracias por tu compra!',
    series: r.series || 'NV01',
    igv_default: !!r.igv_default,
    format: r.format === 'ticket' ? 'ticket' : 'a4',
    accent: config?.theme?.accent || '#18181B',
  }
}

async function capture(node) {
  const { toPng } = await import('html-to-image')
  const opts = { pixelRatio: 2.5, backgroundColor: '#ffffff', cacheBust: true }
  try {
    return await toPng(node, opts)
  } catch {
    // Si el logo no se deja copiar (permiso del servidor), se exporta sin imágenes antes que fallar
    return toPng(node, { ...opts, filter: (n) => n.tagName !== 'IMG' })
  }
}

const loadImg = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src })

export async function makePdf(node, format, fileName) {
  const png = await capture(node)
  const img = await loadImg(png)
  const { jsPDF } = await import('jspdf')
  if (format === 'ticket') {
    const w = 80
    const h = (img.height * w) / img.width
    const pdf = new jsPDF({ unit: 'mm', format: [w, Math.max(h, 60)] })
    pdf.addImage(png, 'PNG', 0, 0, w, h)
    return pdf.output('blob')
  }
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = 210
  const pageH = 297
  const h = (img.height * w) / img.width
  // Si la boleta es más larga que una hoja, sigue en la siguiente
  let y = 0
  pdf.addImage(png, 'PNG', 0, 0, w, h)
  while (h - (y + pageH) > 2) {
    y += pageH
    pdf.addPage()
    pdf.addImage(png, 'PNG', 0, -y, w, h)
  }
  return pdf.output('blob', { filename: fileName })
}

export async function makeImage(node) {
  const png = await capture(node)
  return (await fetch(png)).blob()
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// Comparte el archivo (WhatsApp, etc.) en celulares; en computadora lo descarga
export async function shareFile(blob, name, text) {
  const file = new File([blob], name, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return 'shared' } catch (e) { if (e?.name === 'AbortError') return 'cancel' }
  }
  download(blob, name)
  return 'downloaded'
}

export function printNode(node) {
  let root = document.getElementById('print-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'print-root'
    document.body.appendChild(root)
  }
  root.innerHTML = ''
  root.appendChild(node.cloneNode(true))
  document.body.classList.add('is-printing')
  const done = () => { document.body.classList.remove('is-printing'); root.innerHTML = ''; removeEventListener('afterprint', done) }
  addEventListener('afterprint', done)
  setTimeout(() => window.print(), 60)
}

export const fileBase = (code, customer) => `Boleta-${code}${customer ? `-${String(customer).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').slice(0, 30)}` : ''}`
