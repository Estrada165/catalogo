import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/manrope'
import './tokens.css'
import './base.css'
import './app.css'
import './panel.css'
import './polish.css'

try {
  const t = localStorage.getItem('theme')
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t
} catch {}
