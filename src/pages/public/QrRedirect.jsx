import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Loader from '../../components/Loader'

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

  if (!failed) return <Loader full />

  return (
    <div className="center-screen">
      <div className="card card--narrow">
        <h1 className="display">Código no válido</h1>
        <p className="muted">Este QR no está asociado a ningún catálogo.</p>
      </div>
    </div>
  )
}
