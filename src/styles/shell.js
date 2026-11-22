import './tokens.css'
import './base.css'
import './app.css'
import './panel.css'

if (!document.getElementById('shell-fonts')) {
  const link = document.createElement('link')
  link.id = 'shell-fonts'
  link.rel = 'stylesheet'
  link.href = 'https://api.fontshare.com/v2/css?f[]=clash-display@500,600&f[]=satoshi@400,500,700&display=swap'
  document.head.appendChild(link)
}

try {
  const t = localStorage.getItem('theme')
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t
} catch {}
