import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { clearContactCache, waUrl, fillTemplate } from '../../lib/platform'
import Loader from '../../components/Loader'
import { Field, SaveBar, Section, useDraft, useSaver } from '../panel/ui'

const DEFAULTS = {
  whatsapp: '',
  mensaje_activacion: 'Hola, acabo de registrar mi negocio {negocio} ({enlace}) y quiero activar mi catálogo. 🙌',
  mensaje_renovacion: 'Hola, quiero renovar el plan de mi catálogo {negocio} ({enlace}). 🔄',
}

export default function AdminSettings() {
  const [source, setSource] = useState(null)
  useEffect(() => {
    supabase.from('platform_settings').select('value').eq('key', 'contacto').maybeSingle().then(({ data }) => setSource({ ...DEFAULTS, ...(data?.value || {}) }))
  }, [])
  const [d, set, dirty, reset] = useDraft(source)
  const saver = useSaver(async () => {
    const phone = String(d.whatsapp || '').replace(/\D/g, '')
    if (phone && !/^(51)?9\d{8}$/.test(phone)) throw new Error('El WhatsApp debe ser un celular peruano de 9 dígitos.')
    const value = { ...d, whatsapp: phone }
    const { error } = await supabase.from('platform_settings').upsert({ key: 'contacto', value, updated_at: new Date().toISOString() })
    if (error) throw error
    clearContactCache()
    setSource(value)
  })

  if (!d) return <div className="page"><Loader /></div>
  const sample = { negocio: 'Ferretería Don Pepe', enlace: `${location.host}/don-pepe` }

  return (
    <div className="page page--narrow">
      <header className="page__head"><h1 className="display">Ajustes de la plataforma</h1></header>
      <Section title="Tu WhatsApp de contacto" hint="Los negocios pendientes, suspendidos o por vencer ven un botón para escribirte a este número con el mensaje de abajo ya escrito.">
        <Field label="WhatsApp">
          <input inputMode="numeric" placeholder="9XXXXXXXX" value={String(d.whatsapp || '').replace(/^51(?=9\d{8}$)/, '')} onChange={(e) => set({ whatsapp: e.target.value.replace(/\D/g, '').slice(0, 11) })} />
        </Field>
      </Section>
      <Section title="Mensajes" hint="Usa {negocio} y {enlace}: se reemplazan solos. Puedes usar emojis.">
        <Field label="Para activar una cuenta nueva">
          <textarea rows={3} maxLength={400} value={d.mensaje_activacion} onChange={(e) => set({ mensaje_activacion: e.target.value })} />
        </Field>
        <p className="preview-msg">{fillTemplate(d.mensaje_activacion, sample)}</p>
        <Field label="Para renovar o reactivar">
          <textarea rows={3} maxLength={400} value={d.mensaje_renovacion} onChange={(e) => set({ mensaje_renovacion: e.target.value })} />
        </Field>
        <p className="preview-msg">{fillTemplate(d.mensaje_renovacion, sample)}</p>
        {d.whatsapp && (
          <a className="btn btn--sm btn--wa" href={waUrl(d.whatsapp, fillTemplate(d.mensaje_activacion, sample))} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Probar el mensaje</a>
        )}
      </Section>
      <SaveBar dirty={dirty} {...saver} onSave={saver.run} onReset={reset} />
    </div>
  )
}
