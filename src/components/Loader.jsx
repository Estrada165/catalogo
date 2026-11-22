export default function Loader({ full = false }) {
  return (
    <div className={full ? 'loader loader--full' : 'loader'}>
      <span className="loader__dot" />
      <span className="loader__dot" />
      <span className="loader__dot" />
    </div>
  )
}
