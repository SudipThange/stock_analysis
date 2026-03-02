export default function Features() {
  const items = [
    { title: 'Secure Access', desc: 'JWT-based authentication protects every dashboard and portfolio action.' },
    { title: 'Portfolio Control', desc: 'Create, update, and organize portfolios and stocks in one workflow.' },
    { title: 'Market Analytics', desc: 'Track trend behavior, moving averages, and opportunity signals quickly.' },
    { title: 'Visual Insights', desc: 'Use interactive charts for stocks, gold/silver growth, and correlations.' }
  ]
  return (
    <div className="container" style={{paddingBottom:40}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:24, fontWeight:700, marginBottom:6}}>Everything you need in one dashboard</div>
        <div style={{color:'var(--muted)'}}>Built for faster market monitoring with clean, production-ready UI.</div>
      </div>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))'}}>
        {items.map(x => (
          <div key={x.title} className="card feature-card">
            <div style={{fontWeight:600, marginBottom:6}}>{x.title}</div>
            <div style={{color:'var(--muted)'}}>{x.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
