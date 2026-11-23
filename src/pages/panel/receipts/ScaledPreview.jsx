import { useLayoutEffect, useRef, useState } from 'react'

// Muestra el documento a tamaño real pero achicado para que entre en el espacio disponible
export default function ScaledPreview({ children, docWidth, max = 1 }) {
  const box = useRef(null)
  const inner = useRef(null)
  const [scale, setScale] = useState(0.5)
  const [h, setH] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      const w = box.current?.clientWidth || 0
      const s = Math.min(max, w / docWidth)
      setScale(s)
      setH((inner.current?.offsetHeight || 0) * s)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (box.current) ro.observe(box.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [docWidth, max])

  return (
    <div ref={box} className="rc-preview" style={{ height: h || undefined }}>
      <div ref={inner} className="rc-preview__inner" style={{ width: docWidth, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}
