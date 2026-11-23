import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// App instalable del panel: en cada compilación se genera un sw.js con una versión nueva
// (así el navegador detecta la actualización) y el manifest con el nombre de la plataforma.
function panelPwa(appName) {
  const version = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  let outDir = 'dist'
  return {
    name: 'panel-pwa',
    configResolved(cfg) { outDir = cfg.build.outDir },
    config: () => ({ define: { __APP_VERSION__: JSON.stringify(version) } }),
    closeBundle() {
      const out = (f) => resolve(outDir, f)
      const sw = readFileSync(resolve('src/pwa/sw-template.js'), 'utf8').replace(/__VERSION__/g, version)
      writeFileSync(out('sw.js'), sw)
      writeFileSync(out('version.json'), JSON.stringify({ version }))
      const manifest = {
        id: '/app',
        name: `${appName} · Panel`,
        short_name: appName.length > 12 ? 'Panel' : appName,
        description: 'Administra tu catálogo, pedidos y boletas.',
        lang: 'es',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        background_color: '#f3f2ee',
        theme_color: '#141416',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Pedidos', url: '/panel/pedidos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Productos', url: '/panel/productos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Boletas', url: '/panel/boletas', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      }
      writeFileSync(out('manifest.webmanifest'), JSON.stringify(manifest, null, 2))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), panelPwa(env.VITE_APP_NAME || 'Catálogo')],
  }
})
