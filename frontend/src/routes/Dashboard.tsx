import { useEffect, useState, Component, ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../api/client'
import ChartTV from '../components/ChartTV'

export default function Dashboard() {
  const { ticker } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const fromExplore = (location.state || {}) as {
    portfolioId?: number
    page?: number
    scrollY?: number
    stockTitle?: string
  }
  const { access } = useAuth()
  const [data, setData] = useState<{
    data_head: any[]
    pe_ratio: number
    opportunity_score?: number | null
    discount_score?: number | null
    fig_urls: any
    series: any
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      if (!ticker) return
      setLoading(true)
      try {
        const res = await apiGet(`/dashboard/${encodeURIComponent(ticker)}/`, access || undefined)
        setData(res)
        setError(null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load dashboard data')
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [ticker, access])

  const getPeProps = (val: number | null | undefined) => {
    if (!Number.isFinite(val)) return { className: '', icon: null }
    const v = val as number
    if (v < 20) return { className: 'bg-ok-soft', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> }
    return { className: 'bg-warn-soft', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> }
  }

  const getOppProps = (val: number | null | undefined) => {
    if (!Number.isFinite(val)) return { className: '', icon: null }
    const v = val as number
    if (v > 50) return { className: 'bg-ok-soft', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg> }
    return { className: 'bg-danger-soft', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg> }
  }

  const getDiscProps = (val: number | null | undefined) => {
    if (!Number.isFinite(val)) return { className: '', icon: null }
    const v = val as number
    if (v > 0) return {
      className: 'bg-ok-soft',
      icon: (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.2,
            background: 'rgba(16,185,129,.2)',
            color: '#34D399',
          }}
        >
          Rs
        </span>
      ),
    }
    return { className: 'bg-danger-soft', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> }
  }

  const peProps = getPeProps(data?.pe_ratio)
  const oppProps = getOppProps(data?.opportunity_score)
  const discProps = getDiscProps(data?.discount_score)
  const displayTicker = (ticker || '').toUpperCase()
  const fallbackName = displayTicker.split('.')[0] || 'Stock'
  const stockName = (fromExplore.stockTitle || fallbackName).trim()
  const latestPrice = Array.isArray(data?.series?.price) && data?.series?.price.length
    ? Number(data.series.price[data.series.price.length - 1]?.value)
    : NaN

  const goBackToDashboards = () => {
    navigate('/explore', {
      state: {
        portfolioId: fromExplore.portfolioId,
        page: fromExplore.page,
        scrollY: fromExplore.scrollY,
      },
    })
  }

  return (
    <div className="container page">
      <div className="card dashboard-shell">
        <div className="dashboard-header-row">
          <div className="dashboard-title">Dashboard</div>
          <button className="btn secondary" onClick={goBackToDashboards}>
            Back to Dashboards
          </button>
        </div>
        <div className="dashboard-stock-row">
          <div className="dashboard-stock-name">{stockName}</div>
          <div
            style={{
              fontSize:12,
              fontWeight:700,
              letterSpacing: 0.5,
              textTransform:'uppercase',
              color:'#93C5FD',
              background:'rgba(59,130,246,.15)',
              border:'1px solid rgba(59,130,246,.35)',
              borderRadius:999,
              padding:'4px 10px',
            }}
          >
            {displayTicker}
          </div>
          <div
            style={{
              fontSize:12,
              fontWeight:700,
              color: Number.isFinite(latestPrice) ? '#34D399' : 'var(--muted)',
              background: Number.isFinite(latestPrice) ? 'rgba(16,185,129,.16)' : 'rgba(148,163,184,.14)',
              border: Number.isFinite(latestPrice) ? '1px solid rgba(16,185,129,.35)' : '1px solid rgba(148,163,184,.35)',
              borderRadius:999,
              padding:'4px 10px',
            }}
          >
            {Number.isFinite(latestPrice) ? `Rs ${latestPrice.toFixed(2)}` : 'Price N/A'}
          </div>
        </div>
        {loading && <div>Loading...</div>}
        {error && <div style={{color:'var(--danger)', marginBottom:8}}>{error}</div>}
        {data && (
          <div className="grid dashboard-grid">
            <div className="grid dashboard-score-grid">
              <div className="card" style={{padding:14}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                  <div style={{fontWeight:700}}>P/E Ratio</div>
                  <div className={`pill ${peProps.className}`}>
                    {peProps.icon}
                    {Number.isFinite(data.pe_ratio) ? data.pe_ratio.toFixed(2) : '—'}
                  </div>
                </div>
                <div style={{color:'var(--muted)', fontSize:13}}>Price relative to earnings baseline; lower may indicate cheaper valuation.</div>
              </div>
              <div className="card" style={{padding:14}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                  <div style={{fontWeight:700}}>Opportunity Score</div>
                  <div className={`pill ${oppProps.className}`}>
                    {oppProps.icon}
                    {Number.isFinite(data.opportunity_score as number) ? (data.opportunity_score as number).toFixed(2) : '—'}
                  </div>
                </div>
                <div style={{color:'var(--muted)', fontSize:13}}>Trend-strength score from MA20 vs MA50 crossover momentum (0–100).</div>
              </div>
              <div className="card" style={{padding:14}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                  <div style={{fontWeight:700}}>Discount Score</div>
                  <div className={`pill ${discProps.className}`}>
                    {discProps.icon}
                    {Number.isFinite(data.discount_score as number) ? (data.discount_score as number).toFixed(2) : '—'}
                  </div>
                </div>
                <div style={{color:'var(--muted)', fontSize:13}}>How far price is below 30-day mean vs volatility; higher means more discounted.</div>
              </div>
            </div>
            <div className="card">
              <div style={{fontWeight:700, marginBottom:8}}>Top 10 Rows</div>
              <div className="table-responsive">
                <table style={{width:'100%'}}>
                  <thead>
                    <tr>
                      <th style={{textAlign:'left', padding:'6px'}}>Date</th>
                      <th style={{textAlign:'right', padding:'6px'}}>Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data_head.map((r, i) => (
                      <tr key={i}>
                        <td style={{padding:'6px'}}>{r.Date}</td>
                        <td style={{padding:'6px', textAlign:'right'}}>{Number(r.Close).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="grid dashboard-charts-grid">
              <div className="card">
                <ErrorBoundary fallback={<div style={{color:'var(--danger)'}}>Chart render failed.</div>}>
                  <ChartTV
                    title="Price vs 60-day Average"
                    price={data.series.price}
                    overlays={{ ma60: data.series.ma60 }}
                  />
                </ErrorBoundary>
              </div>
              <div className="card">
                <ErrorBoundary fallback={<div style={{color:'var(--danger)'}}>Chart render failed.</div>}>
                  <ChartTV
                    title="Opportunity Signals (MA20/MA50)"
                    price={data.series.price}
                    overlays={{ ma20: data.series.ma20, ma50: data.series.ma50 }}
                    markers={data.series.buy_sell_markers}
                  />
                </ErrorBoundary>
              </div>
              <div className="card dashboard-chart-full">
                <ErrorBoundary fallback={<div style={{color:'var(--danger)'}}>Chart render failed.</div>}>
                  <ChartTV
                    title="Discount Zones vs Mean30"
                    price={data.series.price}
                    overlays={{ mean30: data.series.mean30 }}
                    markers={data.series.undervalued_markers}
                    height={480}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(_: any) {
    return { hasError: true }
  }
  componentDidCatch(_: any) {}
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
