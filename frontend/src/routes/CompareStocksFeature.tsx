import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChevronLeft, GitCompare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../api/client'

type Portfolio = { id: number; title: string }
type Stock = { id: number; portfolio: number; title: string; ticker: string }

type CompareResult = {
  from: string
  to: string
  growth_series: Array<{ date: string; stock1_growth: number | null; stock2_growth: number | null }>
  stock1: {
    id: number
    title: string
    ticker: string
    today_price: number | null
    regression: {
      prediction_next_day: number | null
      equation: string
      r2: number | null
    } | null
  }
  stock2: {
    id: number
    title: string
    ticker: string
    today_price: number | null
    regression: {
      prediction_next_day: number | null
      equation: string
      r2: number | null
    } | null
  }
}

export default function CompareStocksFeature() {
  const { access } = useAuth()
  const nav = useNavigate()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])
  const [portfolioId, setPortfolioId] = useState<number | ''>('' as any)
  const [stock1Id, setStock1Id] = useState<number | ''>('' as any)
  const [stock2Id, setStock2Id] = useState<number | ''>('' as any)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CompareResult | null>(null)

  useEffect(() => {
    const loadPortfolios = async () => {
      const data = await apiGet('/portfolio/', access || undefined)
      setPortfolios(data)
    }
    if (access) loadPortfolios()
  }, [access])

  useEffect(() => {
    const loadStocks = async () => {
      if (!portfolioId) {
        setStocks([])
        setStock1Id('' as any)
        setStock2Id('' as any)
        return
      }
      const data = await apiGet(`/stock/?portfolio_id=${portfolioId}`, access || undefined)
      setStocks(data)
      setStock1Id('' as any)
      setStock2Id('' as any)
      setResult(null)
      setError('')
    }
    if (access) loadStocks()
  }, [access, portfolioId])

  const stockOptions = useMemo(() => stocks, [stocks])

  const compare = async () => {
    if (!portfolioId || !stock1Id || !stock2Id) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await apiGet(
        `/stock/compare/?portfolio_id=${portfolioId}&stock1_id=${stock1Id}&stock2_id=${stock2Id}`,
        access || undefined
      )
      setResult(data)
    } catch (e: any) {
      setError(e?.message || 'Failed to compare stocks.')
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v?: number | null) => (v === null || v === undefined ? '—' : Number(v).toFixed(2))
  const growthPct = (today?: number | null, next?: number | null) => {
    if (today === null || today === undefined || next === null || next === undefined || today === 0) return null
    return Number((((next - today) / today) * 100).toFixed(2))
  }

  const growthTone = (v: number | null) => {
    if (v === null) return 'neutral'
    if (v > 0) return 'up'
    if (v < 0) return 'down'
    return 'neutral'
  }

  const fmtGrowth = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`)
  const stock1Growth = growthPct(result?.stock1.today_price, result?.stock1.regression?.prediction_next_day)
  const stock2Growth = growthPct(result?.stock2.today_price, result?.stock2.regression?.prediction_next_day)

  return (
    <div className="container page">
      <div className="card grid">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>Compare Stocks</div>
          <button className="btn secondary" onClick={() => nav('/other-features')}>
            <ChevronLeft size={16} /> Back
          </button>
        </div>

        <div className="row">
          <select className="select" value={portfolioId || ''} onChange={e => setPortfolioId(Number(e.target.value))}>
            <option value="" disabled>Select portfolio</option>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <select className="select" value={stock1Id || ''} onChange={e => setStock1Id(Number(e.target.value))} disabled={!portfolioId}>
            <option value="" disabled>Select stock 1</option>
            {stockOptions.map(s => <option key={s.id} value={s.id}>{s.title} ({s.ticker})</option>)}
          </select>
          <select className="select" value={stock2Id || ''} onChange={e => setStock2Id(Number(e.target.value))} disabled={!portfolioId}>
            <option value="" disabled>Select stock 2</option>
            {stockOptions.map(s => <option key={s.id} value={s.id}>{s.title} ({s.ticker})</option>)}
          </select>
          <button className="btn" onClick={compare} disabled={!portfolioId || !stock1Id || !stock2Id || stock1Id === stock2Id || loading}>
            <GitCompare size={16} style={{marginRight: 6}} />
            {loading ? 'Comparing...' : 'Compare'}
          </button>
        </div>

        {error && <div style={{ color: '#ef4444', fontWeight: 600 }}>{error}</div>}

        {result && (
          <>
            <div style={{ color: 'var(--muted)' }}>
              Period: {result.from} to {result.to}
            </div>

            <div className="other-prediction-grid">
              <div className="card compare-stock-card">
                <div className="compare-stock-title">{result.stock1.title} ({result.stock1.ticker})</div>
                <div className="compare-metric-grid">
                  <div className="compare-metric-card today">
                    <span>Today's Price</span>
                    <strong>{fmt(result.stock1.today_price)}</strong>
                  </div>
                  <div className="compare-metric-card prediction">
                    <span>Next Day Prediction</span>
                    <strong>{fmt(result.stock1.regression?.prediction_next_day)}</strong>
                  </div>
                  <div className={`compare-growth-pill ${growthTone(stock1Growth)}`}>
                    <span>Growth %</span>
                    <strong>{fmtGrowth(stock1Growth)}</strong>
                  </div>
                </div>
                <div className="compare-r2">Prediction Reliability: {fmt(result.stock1.regression?.r2)}</div>
              </div>
              <div className="card compare-stock-card">
                <div className="compare-stock-title">{result.stock2.title} ({result.stock2.ticker})</div>
                <div className="compare-metric-grid">
                  <div className="compare-metric-card today">
                    <span>Today's Price</span>
                    <strong>{fmt(result.stock2.today_price)}</strong>
                  </div>
                  <div className="compare-metric-card prediction">
                    <span>Next Day Prediction</span>
                    <strong>{fmt(result.stock2.regression?.prediction_next_day)}</strong>
                  </div>
                  <div className={`compare-growth-pill ${growthTone(stock2Growth)}`}>
                    <span>Growth %</span>
                    <strong>{fmtGrowth(stock2Growth)}</strong>
                  </div>
                </div>
                <div className="compare-r2">Prediction Reliability: {fmt(result.stock2.regression?.r2)}</div>
              </div>
            </div>

            <div className="card" style={{ height: 360 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>1-Year Growth Comparison (%)</div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.growth_series} margin={{ top: 5, right: 20, left: 10, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
                  <XAxis dataKey="date" minTickGap={20} stroke="#475569" tick={{ fill: '#64748b', fontSize: 12 }} tickMargin={10} />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 12 }} tickMargin={10} />
                  <Tooltip 
                    cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      borderColor: '#1e293b', 
                      borderRadius: '8px', 
                      padding: '8px 12px', 
                      color: '#f8fafc',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                      fontSize: '13px'
                    }}
                    itemStyle={{ paddingBottom: '2px', paddingTop: '2px' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '6px', fontWeight: 600, fontSize: '12px' }}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 20, fontSize: '13px' }} iconType="circle" />
                  <Line 
                    type="monotone" 
                    dataKey="stock1_growth" 
                    name={`${result.stock1.ticker} Growth %`} 
                    stroke="#10b981" 
                    dot={false} 
                    strokeWidth={2.5} 
                    activeDot={{ r: 5, strokeWidth: 2, fill: '#0f172a', stroke: '#10b981' }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="stock2_growth" 
                    name={`${result.stock2.ticker} Growth %`} 
                    stroke="#0ea5e9" 
                    dot={false} 
                    strokeWidth={2.5} 
                    activeDot={{ r: 5, strokeWidth: 2, fill: '#0f172a', stroke: '#0ea5e9' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
