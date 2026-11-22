export default function ComingSoon({ title, phase }) {
  return (
    <div className="page">
      <header className="page__head">
        <h1 className="display">{title}</h1>
      </header>
      <div className="card empty">
        <p>Esta sección se construye en la {phase}.</p>
      </div>
    </div>
  )
}
