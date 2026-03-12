import { useNavigate, useParams } from 'react-router-dom'

export default function OtherFeaturePlaceholder() {
  const nav = useNavigate()
  const { featureId } = useParams()

  return (
    <div className="container page">
      <div className="card grid">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>Feature {featureId}</div>
          <button className="btn secondary" onClick={() => nav('/other-features')}>Back</button>
        </div>
        <div style={{ color: 'var(--muted)' }}>This feature is coming soon.</div>
      </div>
    </div>
  )
}
