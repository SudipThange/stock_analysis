import { useEffect, useState, Component, ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../api/client'
import ChartTV from '../components/ChartTV'

export default function Dashboard() {
  const { ticker } = useParams()
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

  return (
    <div className="container" style={{padding:'24px 0'}}>
      <div className="card">
        <div style={{fontSize:24, fontWeight:700, marginBottom:8}}>Dashboard</div>
        <div style={{color:'var(--muted)', marginBottom:12}}>{ticker}</div>
        {loading && <div>Loading...</div>}
        {error && <div style={{color:'var(--danger)', marginBottom:8}}>{error}</div>}
        {data && (
          <div className="grid" style={{gridTemplateColumns:'1fr', gap:16}}>
            <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12}}>
              <div className="card" style={{padding:14}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                  <div style={{fontWeight:700}}>P/E Ratio</div>
                  <div className="pill">{Number.isFinite(data.pe_ratio) ? data.pe_ratio.toFixed(2) : '—'}</div>
                </div>
                <div style={{color:'var(--muted)', fontSize:13}}>Price relative to earnings baseline; lower may indicate cheaper valuation.</div>
              </div>
              <div className="card" style={{padding:14}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                  <div style={{fontWeight:700}}>Opportunity Score</div>
                  <div className="pill">{Number.isFinite(data.opportunity_score as number) ? (data.opportunity_score as number).toFixed(2) : '—'}</div>
                </div>
                <div style={{color:'var(--muted)', fontSize:13}}>Trend-strength score from MA20 vs MA50 crossover momentum (0–100).</div>
              </div>
              <div className="card" style={{padding:14}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                  <div style={{fontWeight:700}}>Discount Score</div>
                  <div className="pill">{Number.isFinite(data.discount_score as number) ? (data.discount_score as number).toFixed(2) : '—'}</div>
                </div>
                <div style={{color:'var(--muted)', fontSize:13}}>How far price is below 30-day mean vs volatility; higher means more discounted.</div>
              </div>
            </div>
            <div className="card">
              <div style={{fontWeight:700, marginBottom:8}}>Top 10 Rows</div>
              <div style={{overflowX:'auto'}}>
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
            <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(420px,1fr))'}}>
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
              <div className="card" style={{gridColumn:'1 / -1'}}>
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
