import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Download, RefreshCw, Share, SquarePlus, X, MoreVertical, MonitorDown } from 'lucide-react'
import { applyUpdate, getSnapshot, promptInstall, subscribe, APP_VERSION } from './pwa'
import './pwa.css'

export const usePwa = () => useSyncExternalStore(subscribe, getSnapshot)

// Botón "Instalar app": abre el cuadro del navegador o, si no hay, explica cómo hacerlo
export function InstallButton({ variant = 'card', onDone }) {
  const s = usePwa()
  const [help, setHelp] = useState(null)
  if (s.installed) return null

  const click = async () => {
    const r = await promptInstall()
    if (r === 'ios' || r === 'manual') setHelp(r)
    else onDone?.()
  }

  return (
    <>
      {variant === 'item' ? (
        <button className="more-sheet__item" onClick={click}><span><Download size={20} /></span>Instalar app</button>
      ) : variant === 'icon' ? (
        <button className="icon-btn" onClick={click} aria-label="Instalar app" title="Instalar app"><MonitorDown size={18} /></button>
      ) : (
        <button className="install-card" onClick={click}>
          <span className="install-card__ic"><Download size={18} /></span>
          <span className="install-card__txt"><b>Instalar app</b><small>Ábrelo como una app, sin buscar el enlace</small></span>
        </button>
      )}
      {help && createPortal(<InstallHelp kind={help} onClose={() => setHelp(null)} />, document.body)}
    </>
  )
}

function InstallHelp({ kind, onClose }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  const steps = kind === 'ios'
    ? [
        [<Share key="a" size={18} />, <>Toca <b>Compartir</b> en la barra de Safari (el cuadro con la flecha hacia arriba).</>],
        [<SquarePlus key="b" size={18} />, <>Elige <b>Agregar a inicio</b>.</>],
        [<Download key="c" size={18} />, <>Toca <b>Agregar</b>. El panel queda como una app en tu pantalla.</>],
      ]
    : [
        [<MoreVertical key="a" size={18} />, <>Abre el menú del navegador (<b>⋮</b> en Chrome o <b>…</b> en Edge).</>],
        [<MonitorDown key="b" size={18} />, <>Elige <b>Instalar app</b> o <b>Agregar a la pantalla de inicio</b>.</>],
        [<Download key="c" size={18} />, <>Confirma. Si no ves la opción, abre el panel en <b>Chrome</b> o <b>Edge</b>.</>],
      ]
  return (
    <div className="pwa-help" role="dialog" aria-modal="true" aria-label="Cómo instalar la app">
      <div className="pwa-help__backdrop" onClick={onClose} />
      <div className="pwa-help__card">
        <button className="icon-btn pwa-help__x" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        <img src="/icons/icon-192.png" alt="" width="64" height="64" />
        <h3>Instala el panel</h3>
        <p className="muted">{kind === 'ios' ? 'En iPhone se instala desde Safari:' : 'Tu navegador no mostró el botón automático. Hazlo así:'}</p>
        <ol>{steps.map(([ic, t], i) => <li key={i}><span>{ic}</span><p>{t}</p></li>)}</ol>
        <button className="btn btn--primary btn--block" onClick={onClose}>Entendido</button>
      </div>
    </div>
  )
}

// Aviso de versión nueva (abajo de la pantalla)
export function UpdateToast() {
  const s = usePwa()
  const [busy, setBusy] = useState(false)
  if (!s.updateReady) return null
  return (
    <div className="pwa-update" role="status">
      <RefreshCw size={18} />
      <span>Hay una versión nueva del panel.</span>
      <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => { setBusy(true); applyUpdate() }}>{busy ? 'Actualizando…' : 'Actualizar'}</button>
    </div>
  )
}

export const versionLabel = () => {
  const v = String(APP_VERSION)
  return /^\d{12}/.test(v) ? `Versión ${v.slice(0, 4)}.${v.slice(4, 6)}.${v.slice(6, 8)}·${v.slice(8, 12)}` : 'Versión de prueba'
}
