import { MapPin, Clock, Truck, Store, Wallet, MessageCircle, ExternalLink, Instagram, Facebook, Music2, Link2 } from 'lucide-react'
import Sheet from './Sheet'
import { money } from '../lib/format'
import { waLink } from '../lib/cart'

const SOCIAL = { instagram: ['Instagram', Instagram], facebook: ['Facebook', Facebook], tiktok: ['TikTok', Music2] }

// Todo lo práctico del negocio en un solo lugar: dónde, cuándo, cómo entregan y cómo se paga
export default function InfoSheet({ open, onClose, cat, sym, status, hours, deliveryOn, pickupOn, showAddress, showHours, showSocial }) {
  const s = cat.settings
  const social = showSocial ? Object.entries(s.social || {}).filter(([, v]) => v) : []
  return (
    <Sheet open={open} onClose={onClose} title={s.business_name}>
      {(s.description || s.tagline) && <p className="info__lead">{s.description || s.tagline}</p>}

      <div className="info">
        {showAddress && s.address && (
          <section className="info__card">
            <span className="info__ic"><MapPin size={18} /></span>
            <div>
              <h4>Dirección</h4>
              <p>{s.address}</p>
              {s.maps_url && <a className="link-btn info__link" href={s.maps_url} target="_blank" rel="noopener noreferrer">Abrir en el mapa <ExternalLink size={13} /></a>}
            </div>
          </section>
        )}

        {showHours && hours.length > 0 && (
          <section className="info__card">
            <span className="info__ic"><Clock size={18} /></span>
            <div>
              <h4>Horario {status && <em className={`info__st${status.open ? '' : ' is-closed'}`}>{status.open ? 'Abierto' : 'Cerrado'}</em>}</h4>
              <dl className="info__rows">
                {hours.map((h) => <div key={h.label}><dt>{h.label}</dt><dd className="tnum">{h.time}</dd></div>)}
              </dl>
            </div>
          </section>
        )}

        {(deliveryOn || pickupOn) && (
          <section className="info__card">
            <span className="info__ic">{deliveryOn ? <Truck size={18} /> : <Store size={18} />}</span>
            <div>
              <h4>Entrega</h4>
              {deliveryOn && (cat.zones.length > 0 ? (
                <dl className="info__rows">
                  {cat.zones.map((z) => <div key={z.id}><dt>{z.name}</dt><dd className="tnum">{Number(z.cost) > 0 ? money(z.cost, sym) : 'Gratis'}</dd></div>)}
                </dl>
              ) : <p>Hacemos delivery. El costo se coordina por WhatsApp.</p>)}
              {pickupOn && <p className={deliveryOn ? 'info__also' : ''}><Store size={14} /> También puedes recoger en tienda.</p>}
            </div>
          </section>
        )}

        {cat.payment_methods.length > 0 && (
          <section className="info__card">
            <span className="info__ic"><Wallet size={18} /></span>
            <div>
              <h4>Medios de pago</h4>
              <div className="info__pays">
                {cat.payment_methods.map((m, i) => (
                  <span key={i} className="info__pay">
                    {m.logo_url ? <img src={m.logo_url} alt="" /> : <b>{m.name.slice(0, 1)}</b>}
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {social.length > 0 && (
          <section className="info__card">
            <span className="info__ic"><Link2 size={18} /></span>
            <div>
              <h4>Síguenos</h4>
              <div className="info__pays">
                {social.map(([k, url]) => {
                  const [label, Ic] = SOCIAL[k] || [k, Link2]
                  return <a key={k} className="info__pay" href={url} target="_blank" rel="noopener noreferrer"><Ic size={16} />{label}</a>
                })}
              </div>
            </div>
          </section>
        )}
      </div>

      {s.whatsapp && (
        <a className="key key--wa key--block key--lg info__wa" href={waLink(s.whatsapp, `👋 Hola, tengo una consulta sobre el catálogo de ${s.business_name}.`)} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={18} /> Escribir por WhatsApp
        </a>
      )}
    </Sheet>
  )
}
