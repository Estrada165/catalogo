import { supabase } from './supabase'

const BUCKET = 'catalog'
const MAX_INPUT = 15 * 1024 * 1024

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {}
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la imagen'))
    img.src = URL.createObjectURL(file)
  })
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function compressImage(source, maxSize, quality = 0.82) {
  const width = source.width
  const height = source.height
  const scale = Math.min(1, maxSize / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)

  let blob = await toBlob(canvas, 'image/webp', quality)
  let ext = 'webp'
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, 'image/jpeg', 0.85)
    ext = 'jpg'
  }
  if (!blob) throw new Error('No se pudo comprimir la imagen')
  return { blob, ext, w, h }
}

export async function uploadProductImage(tenantId, file) {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen')
  if (file.size > MAX_INPUT) throw new Error('La imagen supera los 15 MB')

  const source = await loadBitmap(file)
  const full = await compressImage(source, 1200, 0.82)
  const thumb = await compressImage(source, 420, 0.78)
  if (source.close) source.close()

  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)
  const pathFull = `${tenantId}/products/${id}.${full.ext}`
  const pathThumb = `${tenantId}/products/${id}_t.${thumb.ext}`

  const opts = (b) => ({ contentType: b.blob.type, cacheControl: '31536000', upsert: false })
  const [a, b] = await Promise.all([
    supabase.storage.from(BUCKET).upload(pathFull, full.blob, opts(full)),
    supabase.storage.from(BUCKET).upload(pathThumb, thumb.blob, opts(thumb)),
  ])
  if (a.error || b.error) {
    await supabase.storage.from(BUCKET).remove([pathFull, pathThumb])
    throw new Error((a.error || b.error).message)
  }

  const url = (p) => supabase.storage.from(BUCKET).getPublicUrl(p).data.publicUrl
  return {
    full: url(pathFull),
    thumb: url(pathThumb),
    w: full.w,
    h: full.h,
    path_full: pathFull,
    path_thumb: pathThumb,
  }
}

export async function removeImages(images = []) {
  const paths = images.flatMap((i) => [i.path_full, i.path_thumb]).filter(Boolean)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

// Imagen suelta (logo, QR de pago, avatar del bot). Mantiene transparencia en PNG.
export async function uploadAsset(tenantId, file, folder, maxSize = 512) {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen')
  if (file.size > MAX_INPUT) throw new Error('La imagen supera los 15 MB')
  const source = await loadBitmap(file)
  const out = await compressImage(source, maxSize, 0.9)
  if (source.close) source.close()
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  const path = `${tenantId}/${folder}/${id}.${out.ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, out.blob, { contentType: out.blob.type, cacheControl: '31536000' })
  if (error) throw new Error(error.message)
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path }
}

export async function removePaths(paths = []) {
  const list = paths.filter(Boolean)
  if (list.length) await supabase.storage.from(BUCKET).remove(list)
}
