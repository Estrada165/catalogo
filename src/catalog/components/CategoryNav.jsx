import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  LayoutGrid, Tag, Wrench, Hammer, PaintBucket, Zap, Droplets, Bolt, Sparkles, Flower2, Gift, Heart, Cake, Coffee, CupSoda,
  Milk, Apple, Croissant, ShoppingBasket, Shirt, Gem, Baby, Dog, Pill, SprayCan, Smartphone, Tv, Music, Gamepad2, BookOpen, Package, Star, Flame,
} from 'lucide-react'

// Ícono según el nombre de la categoría (sin configurar nada)
const RULES = [
  [/herramient/i, Wrench], [/construc|cement|ladrill/i, Hammer], [/pintur/i, PaintBucket], [/electric|luz|foco/i, Zap],
  [/gasfit|agua|tuber/i, Droplets], [/tornill|clavo|perno/i, Bolt], [/perfum|fragan|decant|cosm|maquill|belleza/i, Sparkles],
  [/flor|ramo|arreglo/i, Flower2], [/regalo|sets?\b|detalle/i, Gift], [/aniversario|amor|condolenc/i, Heart], [/cumple|torta|pastel/i, Cake],
  [/caf[eé]|desayun/i, Coffee], [/bebid|gaseos|jugo/i, CupSoda], [/l[aá]cte|leche|queso/i, Milk], [/frut|verdur/i, Apple],
  [/pan|panader/i, Croissant], [/abarrot|despensa|bodega/i, ShoppingBasket], [/ropa|polo|moda|vestid/i, Shirt], [/joya|accesor/i, Gem],
  [/beb[eé]|niñ/i, Baby], [/mascot|perro|gato/i, Dog], [/salud|farmac|medic/i, Pill], [/limpie/i, SprayCan], [/celular|tecnolog|accesorios tec/i, Smartphone],
  [/video|stream|tv|pel[ií]cul/i, Tv], [/m[uú]sic/i, Music], [/juego|gamer/i, Gamepad2], [/libro|herramientas digitales|curso/i, BookOpen],
  [/combo|promo|oferta/i, Flame], [/destacad|nuevo/i, Star], [/snack|dulce/i, Package],
]
export const iconFor = (name) => RULES.find(([re]) => re.test(name || ''))?.[1] || Tag

export default function CategoryNav({ cats, active, onPick, total }) {
  const scroller = useRef(null)
  const [ind, setInd] = useState(null)
  const [edge, setEdge] = useState({ l: false, r: false })

  const measure = () => {
    const el = scroller.current
    const btn = el?.querySelector('[aria-pressed="true"]')
    if (!btn) return
    setInd({ x: btn.offsetLeft, w: btn.offsetWidth })
    setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }

  useLayoutEffect(measure, [active, cats.length])
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // La categoría activa siempre a la vista
  useEffect(() => {
    const el = scroller.current
    const btn = el?.querySelector('[aria-pressed="true"]')
    if (!btn) return
    const left = btn.offsetLeft - 48
    const right = btn.offsetLeft + btn.offsetWidth + 48
    if (left < el.scrollLeft) el.scrollTo({ left, behavior: 'smooth' })
    else if (right > el.scrollLeft + el.clientWidth) el.scrollTo({ left: right - el.clientWidth, behavior: 'smooth' })
  }, [active])

  return (
    <div className={`catnav${edge.l ? ' is-l' : ''}${edge.r ? ' is-r' : ''}`}>
      <div className="catnav__track" ref={scroller} onScroll={() => setEdge({ l: scroller.current.scrollLeft > 4, r: scroller.current.scrollLeft + scroller.current.clientWidth < scroller.current.scrollWidth - 4 })} role="group" aria-label="Categorías">
        {ind && <span className="catnav__ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden="true" />}
        <button className="catnav__btn" aria-pressed={active === 'all'} onClick={() => onPick('all')}>
          <LayoutGrid size={16} /><span>Todo</span><em>{total}</em>
        </button>
        {cats.map((c) => {
          const Icon = iconFor(c.name)
          return (
            <button key={c.id} className="catnav__btn" aria-pressed={active === c.id} onClick={() => onPick(c.id)}>
              <Icon size={16} /><span>{c.name}</span><em>{c.count}</em>
            </button>
          )
        })}
      </div>
    </div>
  )
}
