import { useState } from 'react'
import { IconMoon, IconSun } from './icons'

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(currentTheme)

  const toggle = (e) => {
    const next = theme === 'dark' ? 'light' : 'dark'
    const apply = () => {
      document.documentElement.dataset.theme = next
      try { localStorage.setItem('theme', next) } catch {}
      setTheme(next)
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduce) {
      apply()
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))

    const transition = document.startViewTransition(apply)
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }
      )
    })
  }

  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  )
}
