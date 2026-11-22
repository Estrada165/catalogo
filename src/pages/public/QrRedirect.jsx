import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function QrRedirect() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    supabase.rpc('resolve_qr', { p_code: code }).then(({ data }) => {
      if (data) navigate(`/${data}?src=qr`, { replace: true })
      else setFailed(true)
    })
  }, [code, navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
      {failed ? (
        <div>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Código no válido</h1>
          <p style={{ opacity: 0.7, margin: 0 }}>Este QR no está asociado a ningún catálogo.</p>
        </div>
      ) : (
        <p style={{ opacity: 0.6 }}>Abriendo catálogo…</p>
      )}
    </div>
  )
}
