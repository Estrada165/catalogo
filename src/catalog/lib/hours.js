// Formato guardado en tenant_config.business.hours:
// [{ days: [1,2,3,4,5], open: "08:00", close: "18:00" }, { days: [6], open: "09:00", close: "13:00" }]
// days: 0 = domingo … 6 = sábado

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function limaNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t)?.value
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const minutes = (Number(get('hour')) % 24) * 60 + Number(get('minute'))
  return { day, minutes }
}

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number)
  return h * 60 + (m || 0)
}

export function openStatus(hours) {
  if (!Array.isArray(hours) || hours.length === 0) return null
  const { day, minutes } = limaNow()

  for (const r of hours) {
    if (!r.days?.includes(day)) continue
    const o = toMin(r.open)
    const c = toMin(r.close)
    const inside = c > o ? minutes >= o && minutes < c : minutes >= o || minutes < c
    if (inside) return { open: true, label: `Abierto · cierra ${r.close}` }
  }

  for (let i = 0; i < 7; i++) {
    const d = (day + i) % 7
    const ranges = hours.filter((r) => r.days?.includes(d)).sort((a, b) => toMin(a.open) - toMin(b.open))
    for (const r of ranges) {
      if (i === 0 && toMin(r.open) <= minutes) continue
      const when = i === 0 ? 'hoy' : i === 1 ? 'mañana' : DAY_NAMES[d].toLowerCase()
      return { open: false, label: `Cerrado · abre ${when} ${r.open}` }
    }
  }
  return { open: false, label: 'Cerrado' }
}

export function hoursRows(hours) {
  if (!Array.isArray(hours)) return []
  return hours.map((r) => {
    const days = [...(r.days || [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    let label = days.map((d) => SHORT[d]).join(', ')
    const ordered = days.map((d) => (d + 6) % 7)
    const consecutive = ordered.length > 2 && ordered.every((d, i) => i === 0 || d === ordered[i - 1] + 1)
    if (consecutive) label = `${SHORT[days[0]]} a ${SHORT[days[days.length - 1]]}`
    return { label, time: `${r.open} – ${r.close}` }
  })
}
