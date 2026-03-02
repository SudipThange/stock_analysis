export default function Features() {
  const items = [
    { title: 'JWT Auth', desc: 'Secure access for admin via login.' },
    { title: 'CRUD', desc: 'Create, edit, and delete portfolios and stocks.' },
    { title: 'Analysis', desc: 'Run 3‑month metrics and scores.' },
    { title: 'Charts', desc: 'Visualize price trends quickly.' }
  ]
  return (
    <div className="container" style={{paddingBottom:24}}>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))'}}>
        {items.map(x => (
          <div key={x.title} className="card">
            <div style={{fontWeight:600, marginBottom:6}}>{x.title}</div>
            <div style={{color:'var(--muted)'}}>{x.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
