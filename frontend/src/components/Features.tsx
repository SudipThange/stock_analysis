export default function Features() {
  const items = [
    { title: 'Secure Access', desc: 'JWT-based authentication protects every dashboard and portfolio action.', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>, colorClass: 'text-ok' },
    { title: 'Portfolio Control', desc: 'Create, update, and organize portfolios and stocks in one workflow.', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>, colorClass: 'text-warn' },
    { title: 'Market Analytics', desc: 'Track trend behavior, moving averages, and opportunity signals quickly.', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>, colorClass: 'text-ok' },
    { title: 'Visual Insights', desc: 'Use interactive charts for stocks, gold/silver growth, and correlations.', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>, colorClass: 'text-warn' }
  ]
  return (
    <div className="container features-section">
      <div className="features-header">
        <div className="features-title">Everything you need in one dashboard</div>
        <div className="features-subtitle">Built for faster market monitoring with clean, production-ready UI.</div>
      </div>
      <div className="grid features-grid">
        {items.map(x => (
          <div key={x.title} className="card feature-card">
            <div style={{ marginBottom: 16 }}>
              <div className={x.colorClass} style={{ display: 'inline-flex', padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
                {x.icon}
              </div>
            </div>
            <div className="feature-card-title">{x.title}</div>
            <div className="feature-card-desc">{x.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
