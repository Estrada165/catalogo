import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Loader from '../../components/Loader'

const RANGES = [
  { key: 7, label: '7 días' },
  { key: 30, label: '30 días' },
  { key: 90, label: '90 días' },
]

const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d)
const shortDay = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
}
const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')

// Barras verticales de una sola serie con tooltip al pasar el cursor
function Bars({ data, label, height = 180 }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const n = data.length
  const W = 100 / n
  const ticks = [max, Math.round(max / 2), 0]
  return (
    <div className="chart" role="img" aria-label={label}>
      <div className="chart__axis">{ticks.map((t, i) => <span key={i}>{t}</span>)}</div>
      <div className="chart__plot" style={{ height }} onMouseLeave={() => setHover(null)}>
        <div className="chart__grid"><i /><i /><i /></div>
        {data.map((d, i) => (
          <div key={d.key} className="chart__col" style={{ left: `${i * W}%`, width: `${W}%` }} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}>
            <span className={`chart__bar ${hover === i ? 'is-hover' : ''}`} style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
        ))}
        {hover !== null && (
          <div className="chart__tip" style={{ left: `${Math.min(88, Math.max(12, (hover + 0.5) * W))}%` }}>
            <small>{data[hover].label}</small>
            <b>{data[hover].value}</b>
          </div>
        )}
      </div>
      <div className="chart__x">
        <span>{data[0]?.label}</span>
        {n > 2 && <span>{data[Math.floor(n / 2)]?.label}</span>}
        <span>{data[n - 1]?.label}</span>
      </div>
    </div>
  )
}

function HBars({ rows, unit }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="hbars__label">{r.label}</span>
          <span className="hbars__track"><span className="hbars__bar" style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <b className="hbars__val">{r.value}{unit ? ` ${unit}` : ''}</b>
        </li>
      ))}
    </ul>
  )
}

export default function Analytics() {
  const { tenant } = useAuth()
  const [range, setRange] = useState(30)
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    setData(null)
    const since = new Date(Date.now() - range * 86400000)
    const sinceDay = dayKey(since)
    Promise.all([
      supabase.from('v_daily_stats').select('*').eq('tenant_id', tenant.id).gte('day', sinceDay),
      supabase.from('v_top_products').select('*').eq('tenant_id', tenant.id).order('views', { ascending: false }).limit(8),
      supabase.from('v_peak_hours').select('*').eq('tenant_id', tenant.id),
      supabase.from('orders').select('status,total,created_at').eq('tenant_id', tenant.id).gte('created_at', since.toISOString()),
    ]).then(([daily, top, peak, orders]) => {
      if (!alive) return
      setData({ daily: daily.data || [], top: top.data || [], peak: peak.data || [], orders: orders.data || [] })
    })
    return () => { alive = false }
  }, [tenant.id, range])

  const view = useMemo(() => {
    if (!data) return null
    const byDay = Object.fromEntries(data.daily.map((r) => [r.day, r]))
    const days = []
    for (let i = range - 1; i >= 0; i--) {
      const k = dayKey(new Date(Date.now() - i * 86400000))
      days.push({ key: k, label: shortDay(k), value: Number(byDay[k]?.visits || 0) + Number(byDay[k]?.qr_scans || 0) })
    }
    const sum = (f) => data.daily.reduce((s, r) => s + Number(r[f] || 0), 0)
    const visits = sum('visits') + sum('qr_scans')
    const orders = data.orders.length
    const delivered = data.orders.filter((o) => o.status === 'entregado')
    const revenue = delivered.reduce((s, o) => s + Number(o.total || 0), 0)
    const hours = Array.from({ length: 24 }, (_, h) => ({
      key: h,
      label: `${h % 12 || 12} ${h < 12 ? 'a. m.' : 'p. m.'}`,
      value: Number(data.peak.find((p) => p.hour === h)?.visits || 0),
    }))
    return {
      days,
      visits,
      qr: sum('qr_scans'),
      views: sum('product_views'),
      adds: sum('add_cart'),
      orders,
      delivered: delivered.length,
      revenue,
      sessions: sum('sessions'),
      hours,
      top: data.top.filter((t) => t.views > 0 || t.adds > 0),
    }
  }, [data, range])

  return (
    <div className="page">
      <header className="page__head page__head--split">
        <h1 className="display">Analítica</h1>
        <div className="segmented">
          {RANGES.map((r) => <button key={r.key} className={range === r.key ? 'is-active' : ''} onClick={() => setRange(r.key)}>{r.label}</button>)}
        </div>
      </header>

      {!view ? <Loader /> : (
        <>
          <section className="stats">
            <div className="stat"><small>Visitas</small><strong>{view.visits}</strong><small className="muted">{view.qr} desde tu QR</small></div>
            <div className="stat"><small>Pedidos enviados</small><strong>{view.orders}</strong><small className="muted">{pct(view.orders, view.sessions)} de los visitantes</small></div>
            <div className="stat"><small>Entregados</small><strong>{view.delivered}</strong><small className="muted">{pct(view.delivered, view.orders)} de los pedidos</small></div>
            <div className="stat"><small>Ventas entregadas</small><strong>S/ {view.revenue.toFixed(2)}</strong><small className="muted">Suma de pedidos entregados</small></div>
          </section>

          <section className="card chart-card">
            <h3 className="form-block__title">Visitas por día</h3>
            {view.visits === 0 ? <p className="muted">Aún no hay visitas en este periodo.</p> : <Bars data={view.days} label="Visitas por día" />}
          </section>

          <div className="two-col">
            <section className="card chart-card">
              <h3 className="form-block__title">Actividad en el catálogo</h3>
              <HBars rows={[
                { key: 'v', label: 'Visitantes', value: view.sessions },
                { key: 'p', label: 'Productos abiertos', value: view.views },
                { key: 'c', label: 'Agregados al carrito', value: view.adds },
                { key: 'o', label: 'Pedidos enviados', value: view.orders },
              ]} />
              <small className="muted">Si muchos agregan al carrito pero pocos envían, revisa costos de delivery o los datos que pides.</small>
            </section>

            <section className="card chart-card">
              <h3 className="form-block__title">Productos más vistos · 30 días</h3>
              {view.top.length === 0 ? <p className="muted">Aún no hay datos.</p> : (
                <table className="mini-table">
                  <thead><tr><th>Producto</th><th>Vistas</th><th>Al carrito</th></tr></thead>
                  <tbody>{view.top.map((t) => <tr key={t.product_id}><td>{t.name}</td><td>{t.views}</td><td>{t.adds}</td></tr>)}</tbody>
                </table>
              )}
            </section>
          </div>

          <section className="card chart-card">
            <h3 className="form-block__title">Horas con más visitas · 30 días</h3>
            {view.hours.every((h) => h.value === 0) ? <p className="muted">Aún no hay datos.</p> : <Bars data={view.hours} label="Visitas por hora del día" height={140} />}
          </section>
        </>
      )}
    </div>
  )
}
