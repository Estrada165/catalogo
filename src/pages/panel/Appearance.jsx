import { useEffect, useMemo, useRef, useState } from 'react'
import { Sun, Moon, Smartphone, Monitor } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { FONTS } from '../../catalog/lib/fonts'
import Switch from '../../components/Switch'
import Loader from '../../components/Loader'
import { IconArrowDown, IconArrowUp, IconExternal } from '../../components/icons'
import { Field, ImagePicker, SaveBar, Section, Tabs, useDraft, useSaver } from './ui'

const ACCENTS = ['#FF6B35', '#F5B700', '#2BB673', '#1E88E5', '#7C4DFF', '#E86A92', '#E53935', '#C9A96E', '#00A3A3', '#121316']

const STYLES = [
  { key: 'industrial', name: 'Industrial', desc: 'Técnico y firme' },
  { key: 'editorial', name: 'Editorial', desc: 'Serif elegante y limpio' },
  { key: 'fresco', name: 'Fresco', desc: 'Redondeado y amable' },
  { key: 'glamour', name: 'Glamour', desc: 'Lujo, ideal en oscuro' },
  { key: 'suave', name: 'Suave', desc: 'Delicado y cálido' },
  { key: 'neon', name: 'Neón', desc: 'Ancho y llamativo' },
]

const CARD_STYLES = [
  { key: 'tecla', name: 'Tecla', desc: 'Con relieve' },
  { key: 'suave', name: 'Suave', desc: 'Sombra difusa' },
  { key: 'linea', name: 'Línea', desc: 'Solo borde' },
]

const SECTION_INFO = {
  hero: { name: 'Portada', desc: 'Nombre, frase, buscador y datos de entrega', fixed: true },
  popular: { name: 'Lo más pedido', desc: 'Accesos en la portada a lo que más piden tus clientes' },
  howto: { name: '¿Cómo comprar?', desc: 'Pasos cortos para hacer un pedido, armados con tu configuración' },
  featured: { name: 'Destacados', desc: 'Accesos rápidos a los productos marcados como destacados' },
  categories: { name: 'Filtro de categorías', desc: 'Botones para filtrar por categoría' },
  products: { name: 'Productos', desc: 'La grilla del catálogo', fixed: true },
  promos: { name: 'Promociones', desc: 'Próximamente', hidden: true },
  hours: { name: 'Horario', desc: 'Tus horarios en la información del negocio' },
  location: { name: 'Dirección', desc: 'Tu dirección y el enlace al mapa' },
  faq: { name: 'Preguntas frecuentes', desc: 'Las preguntas que cargues en la sección Bot' },
  policies: { name: 'Políticas y condiciones', desc: 'Cambios, garantía, devoluciones…', editable: true },
  social: { name: 'Redes sociales', desc: 'Tus redes junto al bloque de dudas' },
}

const MODULE_INFO = [
  { key: 'stock', name: 'Control de stock', desc: 'Muestra “Agotado”, “Quedan 3” y no deja pedir más de lo que hay.' },
  { key: 'peso', name: 'Venta por peso o medida', desc: 'Kilos, metros, litros, con cantidad mínima e incremento.' },
  { key: 'pedidos', name: 'Registro de pedidos', desc: 'Cada pedido queda guardado con código en tu panel.' },
  { key: 'bot', name: 'Asistente Lu', desc: 'Responde preguntas con la información de tu catálogo.' },
  { key: 'qr', name: 'Mi QR', desc: 'Diseña e imprime el QR de tu catálogo.' },
  { key: 'analitica', name: 'Analítica', desc: 'Visitas, productos más vistos y pedidos.' },
]

const DISPLAY_FONTS = ['bricolage', 'space-grotesk', 'sora', 'unbounded', 'syne', 'outfit', 'fraunces', 'dm-serif', 'montserrat', 'lexend']
const BODY_FONTS = ['plus-jakarta', 'dm-sans', 'manrope', 'inter-tight', 'rubik', 'lexend', 'montserrat', 'outfit', 'sora']

const TABS = [
  { key: 'estilo', label: 'Estilo' },
  { key: 'secciones', label: 'Secciones' },
  { key: 'modulos', label: 'Módulos' },
]

export default function Appearance() {
  const { config, saveConfig } = useOutletContext()
  const { tenant } = useAuth()
  const [tab, setTab] = useState('estilo')
  const [stamp, setStamp] = useState(0)
  const [previewMode, setPreviewMode] = useState(null)
  const [device, setDevice] = useState('phone')
  const [frameReady, setFrameReady] = useState(false)
  const frame = useRef(null)

  const source = useMemo(() => {
    if (!config) return null
    const known = Object.keys(SECTION_INFO)
    const sections = [...(config.sections || [])].sort((a, b) => a.order - b.order)
    known.forEach((type) => {
      if (!sections.some((s) => s.type === type)) sections.push({ id: type, type, enabled: !SECTION_INFO[type].hidden && type !== 'policies', order: sections.length, props: {} })
    })
    return { theme: { accent: '#FF6B35', style: 'industrial', mode: 'auto', ...(config.theme || {}) }, sections, modules: { ...(config.modules || {}) } }
  }, [config])
  const [d, set, dirty, reset] = useDraft(source)
  const saver = useSaver(async () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(d.theme.accent || '')) throw new Error('El color debe tener formato #RRGGBB.')
    await saveConfig({ theme: d.theme, sections: d.sections.map((s, i) => ({ ...s, order: i })), modules: d.modules })
  })

  useEffect(() => { setFrameReady(false) }, [stamp, device])
  // La vista previa recibe el borrador al instante (sin guardar)
  useEffect(() => {
    const on = (e) => { if (e.origin === location.origin && e.data?.type === 'cat:preview-ready') setFrameReady(true) }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, [])
  useEffect(() => {
    if (!frameReady || !d) return
    frame.current?.contentWindow?.postMessage({ type: 'cat:preview', theme: d.theme, sections: d.sections, modules: d.modules, mode: previewMode }, location.origin)
  }, [d, previewMode, frameReady])

  if (!d) return <div className="page"><Loader /></div>

  const theme = (patch) => set({ theme: { ...d.theme, ...patch } })
  const cover = d.theme.cover || {}
  const setCover = (patch) => theme({ cover: { ...cover, ...patch } })
  const coverMode = cover.mode || 'none'
  const sec = (type, patch) => set({ sections: d.sections.map((s) => (s.type === type ? { ...s, ...patch } : s)) })
  const move = (i, dir) => {
    const arr = [...d.sections]
    const to = i + dir
    if (to < 0 || to >= arr.length) return
    ;[arr[i], arr[to]] = [arr[to], arr[i]]
    set({ sections: arr })
  }
  const url = `/${tenant.slug}`

  return (
    <div className="page appearance">
      <header className="page__head page__head--split">
        <h1 className="display">Apariencia</h1>
        <a className="btn" href={url} target="_blank" rel="noreferrer"><IconExternal width={16} height={16} /> Abrir catálogo</a>
      </header>

      <div className="appearance__grid">
        <div className="appearance__form">
          <Tabs tabs={TABS} value={tab} onChange={setTab} />

          {tab === 'estilo' && (
            <>
              <Section tour="color" title="Color principal" hint="Se usa en botones, precios y detalles. El catálogo ajusta el tono automáticamente para que siempre se lea bien.">
                <div className="swatches">
                  {ACCENTS.map((c) => (
                    <button key={c} className={`swatch ${d.theme.accent?.toUpperCase() === c ? 'is-on' : ''}`} style={{ '--c': c }} onClick={() => theme({ accent: c })} aria-label={c} />
                  ))}
                  <label className="swatch swatch--custom" style={{ '--c': d.theme.accent }}>
                    <input type="color" value={d.theme.accent} onChange={(e) => theme({ accent: e.target.value.toUpperCase() })} aria-label="Color personalizado" />
                  </label>
                  <input className="hex-input" value={d.theme.accent} maxLength={7} onChange={(e) => theme({ accent: e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value })} />
                </div>
              </Section>

              <Section tour="estilos" title="Estilo" hint="Define tipografías y forma de las tarjetas. Luego puedes ajustarlas abajo.">
                <div className="option-grid">
                  {STYLES.map((s) => (
                    <button key={s.key} className={`option-card ${d.theme.style === s.key ? 'is-on' : ''}`}
                      onClick={() => theme({ style: s.key, font_display: undefined, font_body: undefined, font_cards: undefined, card_style: undefined })}>
                      <strong>{s.name}</strong><small>{s.desc}</small>
                    </button>
                  ))}
                </div>
              </Section>

              <Section tour="portada" title="Portada" hint="Opcional. Una imagen o un degradado detrás de tu logo y nombre. Las tarjetas de productos no cambian.">
                <div className="option-grid option-grid--3">
                  {[['none', 'Sin portada', 'Fondo liso'], ['image', 'Imagen', 'Foto con difuminado'], ['gradient', 'Degradado', 'Con tus colores']].map(([k, n, h]) => (
                    <button key={k} className={`option-card ${coverMode === k ? 'is-on' : ''}`} onClick={() => setCover({ mode: k })}>
                      <strong>{n}</strong><small>{h}</small>
                    </button>
                  ))}
                </div>
                {coverMode === 'image' && (
                  <>
                    <ImagePicker wide tenantId={tenant.id} folder="brand" value={cover.image} size={1800} label="Subir imagen de portada"
                      crop={{ aspect: 16 / 9, fit: false, title: 'Ajusta tu portada', subtitle: 'En computadora se ve a la derecha; en celular, arriba. Deja lo importante al centro.' }}
                      onChange={(img) => setCover({ image: img?.url || null })} />
                    <Field label={`Intensidad · ${cover.strength || 80}%`}>
                      <input type="range" min={20} max={100} step={5} value={cover.strength || 80} onChange={(e) => setCover({ strength: Number(e.target.value) })} />
                    </Field>
                    <div className="field">
                      <span>Enfoque</span>
                      <div className="segmented">
                        {[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']].map(([k, l]) => (
                          <button key={k} className={(cover.focus || 'center') === k ? 'is-active' : ''} onClick={() => setCover({ focus: k })}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <Switch checked={!!cover.blur} onChange={(v) => setCover({ blur: v })} label="Difuminar la imagen (más suave, ideal si tiene texto o mucho detalle)" />
                  </>
                )}
                {coverMode === 'gradient' && (
                  <>
                    <div className="form-grid">
                      <Field label="Color 1">
                        <div className="cover-color"><input type="color" value={cover.color1 || d.theme.accent} onChange={(e) => setCover({ color1: e.target.value.toUpperCase() })} /><code>{cover.color1 || d.theme.accent}</code></div>
                      </Field>
                      <Field label="Color 2">
                        <div className="cover-color"><input type="color" value={cover.color2 || '#8B7DFF'} onChange={(e) => setCover({ color2: e.target.value.toUpperCase() })} /><code>{cover.color2 || '#8B7DFF'}</code></div>
                      </Field>
                    </div>
                    <div className="field">
                      <span>Forma</span>
                      <div className="segmented">
                        {[['aurora', 'Aurora'], ['diagonal', 'Diagonal']].map(([k, l]) => (
                          <button key={k} className={(cover.shape || 'aurora') === k ? 'is-active' : ''} onClick={() => setCover({ shape: k })}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <Field label={`Intensidad · ${cover.strength || 80}%`}>
                      <input type="range" min={20} max={100} step={5} value={cover.strength || 80} onChange={(e) => setCover({ strength: Number(e.target.value) })} />
                    </Field>
                  </>
                )}
              </Section>

              <Section title="Modo">
                <div className="segmented">
                  {[['auto', 'Según el dispositivo'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, l]) => (
                    <button key={k} className={(d.theme.mode || 'auto') === k ? 'is-active' : ''} onClick={() => theme({ mode: k })}>{l}</button>
                  ))}
                </div>
                <small className="muted">El cliente siempre puede cambiarlo con el botón de luna.</small>
              </Section>

              <Section title="Ajustes finos">
                <div className="field">
                  <span>Tarjetas</span>
                  <div className="option-grid option-grid--3">
                    {CARD_STYLES.map((c) => (
                      <button key={c.key} className={`option-card ${(d.theme.card_style || '') === c.key ? 'is-on' : ''}`} onClick={() => theme({ card_style: c.key })}>
                        <strong>{c.name}</strong><small>{c.desc}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-grid">
                  <Field label="Tipografía de títulos">
                    <select value={d.theme.font_display || ''} onChange={(e) => theme({ font_display: e.target.value || undefined })}>
                      <option value="">Según el estilo</option>
                      {DISPLAY_FONTS.map((k) => <option key={k} value={k}>{FONTS[k].name} · {FONTS[k].style}</option>)}
                    </select>
                  </Field>
                  <Field label="Tipografía de textos">
                    <select value={d.theme.font_body || ''} onChange={(e) => theme({ font_body: e.target.value || undefined, font_cards: e.target.value || undefined })}>
                      <option value="">Según el estilo</option>
                      {BODY_FONTS.map((k) => <option key={k} value={k}>{FONTS[k].name} · {FONTS[k].style}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label={`Redondeo de esquinas · ${d.theme.radius || 18}px`}>
                  <input type="range" min={6} max={28} step={1} value={d.theme.radius || 18} onChange={(e) => theme({ radius: Number(e.target.value) })} />
                </Field>
              </Section>
            </>
          )}

          {tab === 'secciones' && (
            <Section title="Secciones del catálogo" hint="Apaga lo que no uses y ordena cómo aparece. La portada y los productos siempre se muestran.">
              <ul className="cat-list">
                {d.sections.map((s, i) => {
                  const info = SECTION_INFO[s.type]
                  if (!info || info.hidden) return null
                  return (
                    <li key={s.type} className={`section-row ${s.enabled || info.fixed ? '' : 'is-hidden'}`}>
                      <div className="cat-row__order">
                        <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><IconArrowUp width={16} height={16} /></button>
                        <button className="icon-btn" disabled={i === d.sections.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><IconArrowDown width={16} height={16} /></button>
                      </div>
                      <div className="section-row__info">
                        <strong>{info.name}</strong>
                        <small className="muted">{info.desc}</small>
                        {info.editable && s.enabled && (
                          <div className="section-row__edit">
                            <input placeholder="Título" value={s.props?.title || ''} maxLength={50} onChange={(e) => sec(s.type, { props: { ...(s.props || {}), title: e.target.value } })} />
                            <textarea rows={4} placeholder="Una condición por línea. Ej.: Cambios dentro de 7 días con boleta" value={s.props?.text || ''} maxLength={2000}
                              onChange={(e) => sec(s.type, { props: { ...(s.props || {}), text: e.target.value } })} />
                          </div>
                        )}
                      </div>
                      {info.fixed ? <small className="muted">Siempre visible</small> : <Switch checked={s.enabled} onChange={(v) => sec(s.type, { enabled: v })} />}
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

          {tab === 'modulos' && (
            <Section title="Módulos" hint="Enciende solo lo que tu negocio necesita. Al apagar un módulo desaparece del catálogo y del menú de tu panel.">
              <ul className="cat-list">
                {MODULE_INFO.map((m) => (
                  <li key={m.key} className="section-row">
                    <div className="section-row__info">
                      <strong>{m.name}</strong>
                      <small className="muted">{m.desc}</small>
                    </div>
                    <Switch checked={d.modules[m.key] !== false && (m.key === 'stock' || m.key === 'peso' ? !!d.modules[m.key] : true)}
                      onChange={(v) => set({ modules: { ...d.modules, [m.key]: v } })} />
                  </li>
                ))}
              </ul>
              <small className="muted">El delivery se activa en Configuración → Entrega.</small>
            </Section>
          )}

          <SaveBar dirty={dirty} {...saver} onSave={saver.run} onReset={reset} />
        </div>

        <aside className="appearance__preview" data-tour="preview">
          <div className="preview-tools">
            <div className="segmented segmented--sm">
              <button className={device === 'phone' ? 'is-active' : ''} onClick={() => setDevice('phone')} aria-label="Celular"><Smartphone size={15} /></button>
              <button className={device === 'desktop' ? 'is-active' : ''} onClick={() => setDevice('desktop')} aria-label="Computadora"><Monitor size={15} /></button>
            </div>
            <div className="segmented segmented--sm">
              <button className={previewMode !== 'dark' ? 'is-active' : ''} onClick={() => setPreviewMode('light')}><Sun size={15} /> Claro</button>
              <button className={previewMode === 'dark' ? 'is-active' : ''} onClick={() => setPreviewMode('dark')}><Moon size={15} /> Oscuro</button>
            </div>
          </div>
          <div className={device === 'phone' ? 'phone' : 'browser'}>
            {device === 'desktop' && <div className="browser__bar"><i /><i /><i /><span>{location.host}{url}</span></div>}
            <div className="frame-wrap">
              <iframe ref={frame} key={stamp + device} src={`${url}?preview=1`} title="Vista previa del catálogo" />
            </div>
          </div>
          <small className="muted">{dirty ? 'Así se verá cuando guardes.' : 'Vista previa en vivo'}</small>
        </aside>
      </div>
    </div>
  )
}
