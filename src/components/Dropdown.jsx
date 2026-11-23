import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import './dropdown.css'

// Desplegable con estilo propio (reemplaza al <select> del navegador).
// options: [{ value, label, hint?, group? }] · Se abre flotando sobre todo, nunca queda cortado.
export default function Dropdown({ value, onChange, options, placeholder = 'Elegir', icon = null, ariaLabel, className = '', disabled = false, id }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const list = useRef(null)
  const typed = useRef({ text: '', t: 0 })
  const listId = useId()
  const current = options.find((o) => String(o.value) === String(value))

  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const want = Math.min(320, options.length * 44 + 12)
    const below = innerHeight - r.bottom - 12
    const up = below < Math.min(want, 220) && r.top > below
    const width = Math.max(r.width, 200)
    const left = Math.min(Math.max(8, r.left), innerWidth - width - 8)
    setPos({ left, width, top: up ? undefined : r.bottom + 6, bottom: up ? innerHeight - r.top + 6 : undefined, max: Math.max(160, (up ? r.top : below) - 12) })
  }

  const show = () => {
    if (disabled) return
    place()
    setActive(Math.max(0, options.findIndex((o) => String(o.value) === String(value))))
    setOpen(true)
  }
  const close = (focus = true) => { setOpen(false); if (focus) btn.current?.focus() }
  const pick = (o) => { onChange(o.value); close() }

  useLayoutEffect(() => {
    if (!open) return
    const el = list.current?.querySelector(`[data-i="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!list.current?.contains(e.target) && !btn.current?.contains(e.target)) close(false) }
    const onScroll = (e) => { if (!list.current?.contains(e.target)) close(false) }
    const onResize = () => close(false)
    document.addEventListener('pointerdown', onDown, true)
    addEventListener('scroll', onScroll, true)
    addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      removeEventListener('scroll', onScroll, true)
      removeEventListener('resize', onResize)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) pick(options[active]) }
    else if (e.key === 'Tab') close(false)
    else if (e.key.length === 1) {
      // Escribir una letra salta a la opción que empieza así
      const now = Date.now()
      typed.current = { text: (now - typed.current.t < 700 ? typed.current.text : '') + e.key.toLowerCase(), t: now }
      const i = options.findIndex((o) => String(o.label).toLowerCase().startsWith(typed.current.text))
      if (i >= 0) setActive(i)
    }
  }

  return (
    <>
      <button
        ref={btn}
        id={id}
        type="button"
        className={`dd ${open ? 'is-open' : ''} ${className}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
      >
        {icon && <span className="dd__icon">{icon}</span>}
        <span className={`dd__value ${current ? '' : 'is-placeholder'}`}>{current ? current.label : placeholder}</span>
        <ChevronDown className="dd__chev" size={16} strokeWidth={2.4} />
      </button>
      {open && pos && createPortal(
        <ul
          ref={list}
          id={listId}
          role="listbox"
          className="dd-list"
          aria-label={ariaLabel}
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.max }}
          onKeyDown={onKey}
        >
          {options.map((o, i) => {
            const sel = String(o.value) === String(value)
            const head = o.group && (i === 0 || options[i - 1].group !== o.group)
            return (
              <li key={`${o.value}`} role="presentation">
                {head && <span className="dd-list__group">{o.group}</span>}
                <button
                  type="button"
                  role="option"
                  data-i={i}
                  aria-selected={sel}
                  className={`dd-opt ${i === active ? 'is-active' : ''} ${sel ? 'is-sel' : ''}`}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  tabIndex={-1}
                >
                  <span className="dd-opt__txt">
                    <span>{o.label}</span>
                    {o.hint && <small>{o.hint}</small>}
                  </span>
                  {sel && <Check size={16} strokeWidth={2.6} className="dd-opt__check" />}
                </button>
              </li>
            )
          })}
        </ul>,
        document.body,
      )}
    </>
  )
}
