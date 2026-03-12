import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Cell, AreaChart, Area } from 'recharts'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../api/client'

type Portfolio = { id: number; title: string }

type StockDetailData = {
  id: number
  portfolio: number
  title: string
  ticker: string
  today_open?: number | null
  today_close?: number | null
  min_price?: number | null
  max_price?: number | null
  avg_price_last_month?: number | null
  pe_ratio?: number | null
  market_cap?: number | null
  one_year_change_pct?: number | null
}

type PricePoint = { time: string; value: number }

type PriceChartPoint = {
  ts: number
  time: string
  value: number
}

type DashboardResponse = {
  series?: {
    price?: PricePoint[]
  }
}

type MonthlyGrowthPoint = {
  month: string
  close: number
  growth_pct: number
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-'
  return Number(value).toFixed(2)
}

function formatMarketCap(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-'
  const compact = new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(Number(value))
  return `Rs ${compact}`
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-'
  const v = Number(value)
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function toDateLabel(value: string) {
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  return dt.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}

function toMonthLabel(value: string) {
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  return dt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function toMonthKey(ts: number) {
  const dt = new Date(ts)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

function buildPriceChartData(series: PricePoint[]): PriceChartPoint[] {
  return [...series]
    .map((point) => ({
      ts: new Date(point.time).getTime(),
      time: point.time,
      value: Number(point.value),
    }))
    .filter((point) => Number.isFinite(point.ts) && Number.isFinite(point.value))
    .sort((a, b) => a.ts - b.ts)
}

function buildMonthlyTicks(points: PriceChartPoint[], monthStep = 2): number[] {
  if (!points.length) return []

  const monthOpenPoints: PriceChartPoint[] = []
  let lastMonth = ''

  points.forEach((point) => {
    const mk = toMonthKey(point.ts)
    if (mk !== lastMonth) {
      monthOpenPoints.push(point)
      lastMonth = mk
    }
  })

  const stride = Math.max(1, monthStep)
  return monthOpenPoints
    .filter((_, idx) => idx % stride === 0)
    .map((point) => point.ts)
}

function formatMonthTick(ts: number) {
  const dt = new Date(ts)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function GrowthTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null
  const point = payload[0]?.payload as PriceChartPoint | undefined
  if (!point) return null

  return (
    <div className="stock-growth-tooltip">
      <div className="stock-growth-tooltip-date">{toDateLabel(point.time)}</div>
      <div className="stock-growth-tooltip-price">Price: {Number(point.value).toFixed(2)}</div>
    </div>
  )
}

function buildMonthlyGrowth(series: PricePoint[]) {
  const sorted = [...series]
    .filter((p) => Number.isFinite(p.value) && !!p.time)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  const monthClose = new Map<string, PricePoint>()
  sorted.forEach((point) => {
    const dt = new Date(point.time)
    if (Number.isNaN(dt.getTime())) return
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    monthClose.set(key, point)
  })

  const closes = Array.from(monthClose.values())
  const growthData = closes.map((point, idx) => {
    if (idx === 0) {
      return {
        month: toMonthLabel(point.time),
        close: point.value,
        growth_pct: 0,
      }
    }

    const prev = closes[idx - 1].value
    const growth = prev === 0 ? 0 : ((point.value - prev) / prev) * 100
    return {
      month: toMonthLabel(point.time),
      close: point.value,
      growth_pct: Number(growth.toFixed(2)),
    }
  })

  // Drop the first element because its growth is 0 by definition (no previous month to compare)
  return growthData.slice(1)
}

export default function StockDetail() {
  const { stockId } = useParams()
  const nav = useNavigate()
  const { access } = useAuth()

  const [stock, setStock] = useState<StockDetailData | null>(null)
  const [portfolioName, setPortfolioName] = useState<string>('')
  const [priceSeries, setPriceSeries] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [chartError, setChartError] = useState('')

  const parseApiError = (value: any, fallback: string) => {
    const raw = String(value?.message || '').trim()
    if (!raw) return fallback

    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed?.error) return String(parsed.error)
        if (parsed?.detail) return String(parsed.detail)
      } catch {
        // ignore and fallback to text handlers below
      }
    }

    if (raw.startsWith('<!DOCTYPE') || raw.startsWith('<html')) {
      return fallback
    }

    return raw
  }

  useEffect(() => {
    const run = async () => {
      if (!access || !stockId) return
      setLoading(true)
      setError('')
      setChartError('')

      try {
        const detail = await apiGet(`/stock/${stockId}/`, access || undefined)
        setStock(detail)

        const portfolios = await apiGet('/portfolio/', access || undefined)
        const portfolioList = Array.isArray(portfolios) ? (portfolios as Portfolio[]) : []
        const foundPortfolio = portfolioList.find((p) => p.id === detail.portfolio)
        setPortfolioName(foundPortfolio?.title || String(detail.portfolio))

        try {
          const dashboard = await apiGet(`/dashboard/${encodeURIComponent(detail.ticker)}/`, access || undefined) as DashboardResponse
          const points = Array.isArray(dashboard?.series?.price) ? dashboard.series?.price || [] : []
          const cleanPoints = points.filter((p) => Number.isFinite(Number(p?.value)) && !!p?.time)
          setPriceSeries(cleanPoints)
          if (cleanPoints.length <= 1) {
            setChartError('Not enough historical data available to render graphs for this ticker yet.')
          }
        } catch (e: any) {
          setPriceSeries([])
          setChartError(parseApiError(e, 'Unable to load growth chart data for this stock.'))
        }
      } catch (e: any) {
        setStock(null)
        setPriceSeries([])
        setError(parseApiError(e, 'Unable to load stock details.'))
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [access, stockId])

  const monthlyGrowth = useMemo(() => buildMonthlyGrowth(priceSeries), [priceSeries])
  const priceChartData = useMemo(() => buildPriceChartData(priceSeries), [priceSeries])
  const xTicks = useMemo(() => buildMonthlyTicks(priceChartData, 2), [priceChartData])
  const yDomain = useMemo<[number, number]>(() => {
    if (!priceChartData.length) return [0, 1]
    const values = priceChartData.map((p) => p.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
    if (min === max) {
      const pad = Math.max(1, Math.abs(min) * 0.05)
      return [min - pad, max + pad]
    }
    const pad = (max - min) * 0.12
    return [min - pad, max + pad]
  }, [priceChartData])

  return (
    <div className="container page">
      <div className="card stock-detail-shell">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{stock?.title || 'Stock Details'}</div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>{stock?.ticker || ''}</div>
          </div>
          <button className="btn secondary" onClick={() => nav('/stocks')}>
            <ChevronLeft size={16} /> Back to Stocks
          </button>
        </div>

        {loading && <div>Loading stock details...</div>}
        {!!error && <div style={{ color: 'var(--danger)', fontWeight: 700 }}>{error}</div>}

        {!loading && !error && stock && (
          <>
            <div className="stock-detail-values-grid">
              <div className="stock-detail-value-card" style={{ borderLeft: '4px solid #8b5cf6' }}><span>Portfolio</span><strong>{portfolioName || stock.portfolio}</strong></div>
              <div className="stock-detail-value-card" style={{ borderLeft: '4px solid #3b82f6' }}><span>Open</span><strong>{formatNumber(stock.today_open)}</strong></div>
              <div className="stock-detail-value-card" style={{ borderLeft: '4px solid #06b6d4' }}><span>Close</span><strong>{formatNumber(stock.today_close)}</strong></div>
              <div className="stock-detail-value-card" style={{ borderLeft: '4px solid #ef4444' }}><span>Min</span><strong>{formatNumber(stock.min_price)}</strong></div>
              <div className="stock-detail-value-card" style={{ borderLeft: '4px solid #22c55e' }}><span>Max</span><strong>{formatNumber(stock.max_price)}</strong></div>
              <div className="stock-detail-value-card" style={{ borderLeft: '4px solid #f59e0b' }}><span>Mean (1M)</span><strong>{formatNumber(stock.avg_price_last_month)}</strong></div>
              <div className="stock-detail-value-card" style={{ borderLeft: '4px solid #ec4899' }}><span>P/E Ratio</span><strong>{formatNumber(stock.pe_ratio)}</strong></div>
              <div className="stock-detail-value-card" style={{ borderLeft: '4px solid #14b8a6' }}><span>Market Cap</span><strong>{formatMarketCap(stock.market_cap)}</strong></div>
              <div className="stock-detail-value-card" style={{ borderLeft: '4px solid #f97316' }}>
                <span>1Y Return</span>
                <strong style={{ color: Number(stock.one_year_change_pct) >= 0 ? '#34d399' : '#fb7185' }}>
                  {formatPercent(stock.one_year_change_pct)}
                </strong>
              </div>
            </div>

            <div className="card stock-growth-card" style={{ height: 420 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Growth Graph</div>
              {priceSeries.length > 1 ? (
                <div className="stock-growth-plot-area">
                  <ResponsiveContainer width="100%" height="100%" className="stock-growth-chart-wrap">
                    <AreaChart data={priceChartData} margin={{ top: 10, right: 10, left: 2, bottom: 16 }}>
                    <defs>
                      <linearGradient id="stockGrowthAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(148,163,184,0.18)" vertical={true} horizontal={true} />
                    <XAxis
                      type="number"
                      dataKey="ts"
                      scale="time"
                      domain={["dataMin", "dataMax"]}
                      ticks={xTicks}
                      height={42}
                      stroke="#93a8ba"
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(148,163,184,0.28)' }}
                      tickFormatter={(value) => formatMonthTick(Number(value))}
                      minTickGap={28}
                    />
                    <YAxis
                      stroke="#93a8ba"
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      domain={yDomain}
                      tickFormatter={(value) => Number(value).toFixed(0)}
                    />
                    <Tooltip
                      content={<GrowthTooltip />}
                      cursor={{ stroke: 'rgba(147,197,253,0.55)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2.6}
                      fill="url(#stockGrowthAreaFill)"
                      isAnimationActive={true}
                      animationDuration={550}
                      activeDot={{
                        r: 5,
                        stroke: '#bfdbfe',
                        strokeWidth: 2,
                        fill: '#1d4ed8',
                        style: { filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.85))' },
                      }}
                      style={{ filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.4))' }}
                    />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ color: 'var(--muted)' }}>{chartError || 'Not enough growth data to render chart.'}</div>
              )}
            </div>

            <div className="card" style={{ height: 420 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Monthly Growth (%)</div>
              {monthlyGrowth.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyGrowth} margin={{ top: 12, right: 18, left: 6, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      stroke="#94a3b8" 
                      tickFormatter={(val) => val.split(' ')[0]} 
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      tickFormatter={(value) => `${Number(value).toFixed(0)}%`} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const val = payload[0].value as number
                          const isPositive = val >= 0
                          const color = isPositive ? '#10b981' : '#f43f5e'
                          return (
                            <div style={{ background: '#0f172a', border: '1px solid #1f2937', borderRadius: 10, padding: '10px 12px', color: '#f8fafc' }}>
                              <div style={{ marginBottom: 4, fontWeight: 600 }}>{label}</div>
                              <div>Growth: <span style={{ color, fontWeight: 700 }}>{val.toFixed(2)}%</span></div>
                            </div>
                          )
                        }
                        return null
                      }}
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={2} />
                    <Bar
                      dataKey="growth_pct"
                      radius={[4, 4, 4, 4]}
                    >
                      {monthlyGrowth.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.growth_pct >= 0 ? '#10b981' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ color: 'var(--muted)' }}>{chartError || 'Not enough monthly points to render bar chart.'}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
