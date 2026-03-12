import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Filter, Search, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../api/client'

type Portfolio = { id: number; title: string }
type RiskStock = {
  name: string
  ticker_id: string
  closing_price: number | null
  investment_risk_status: 'low' | 'mid' | 'high' | string
}

export default function RiskCategorizationFeature() {
  const { access } = useAuth()
  const nav = useNavigate()

  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [portfoliosLoaded, setPortfoliosLoaded] = useState(false)
  const [portfolioId, setPortfolioId] = useState<number | ''>('' as any)

  const [allStocks, setAllStocks] = useState<RiskStock[]>([])
  const [stocks, setStocks] = useState<RiskStock[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<RiskStock[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const PAGE_SIZE = 5

  const loadPortfolios = async () => {
    if (portfoliosLoaded || !access) return
    const data = await apiGet('/portfolio/', access || undefined)
    setPortfolios(data)
    setPortfoliosLoaded(true)
  }

  const categorize = async () => {
    if (!portfolioId) return
    setLoading(true)
    setError('')
    try {
      const data = await apiGet(`/stock/risk-categorization/?portfolio_id=${portfolioId}`, access || undefined)
      const nextItems = Array.isArray(data?.results) ? data.results : []
      setAllStocks(nextItems)
      setStocks(nextItems)
      setSuggestions([])
      setShowSuggestions(false)
      setPage(0)
    } catch (e: any) {
      setError(e?.message || 'Failed to categorize stocks.')
      setAllStocks([])
      setStocks([])
      setSuggestions([])
      setShowSuggestions(false)
      setPage(0)
    } finally {
      setLoading(false)
    }
  }

  const buildSuggestions = (query: string, source: RiskStock[]) => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return source
      .filter(item => `${item.name} ${item.ticker_id}`.toLowerCase().includes(q))
      .slice(0, 8)
  }

  const applySearch = (query: string) => {
    const q = query.trim().toLowerCase()
    if (!q) {
      setStocks(allStocks)
      setPage(0)
      return
    }

    const filtered = allStocks.filter(item => `${item.name} ${item.ticker_id}`.toLowerCase().includes(q))
    setStocks(filtered)
    setPage(0)
  }

  const statusClass = (value: string) => {
    const normalized = (value || '').toLowerCase()
    if (normalized.includes('low')) return 'low'
    if (normalized.includes('high')) return 'high'
    if (normalized.includes('mid') || normalized.includes('medium')) return 'mid'
    return 'mid'
  }

  useEffect(() => {
    setAllStocks([])
    setStocks([])
    setSearchTerm('')
    setSuggestions([])
    setShowSuggestions(false)
    setPage(0)
  }, [portfolioId])

  const visible = stocks.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const hasPrev = page > 0
  const hasNext = (page + 1) * PAGE_SIZE < stocks.length

  const fmt = (v?: number | null) => (v === null || v === undefined ? '—' : Number(v).toFixed(2))
  return (
    <div className="container page">
      <div className="card grid risk-feature-shell">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>Risk Categorization</div>
          <button className="btn secondary" onClick={() => nav('/other-features')}>
            <ChevronLeft size={16} /> Back
          </button>
        </div>

        <div className="row risk-controls-row">
          <select
            className="select"
            value={portfolioId || ''}
            onFocus={loadPortfolios}
            onChange={e => setPortfolioId(Number(e.target.value))}
          >
            <option value="" disabled>Select portfolio</option>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>

          <button
            className="btn"
            onClick={categorize}
            disabled={!portfolioId || loading}
          >
            <Filter size={16} style={{marginRight: 6}} />
            {loading ? 'Categorizing...' : 'Categorize'}
          </button>

          <div className="risk-search-wrap">
            <input
              className="input"
              placeholder="Search by stock name or ticker id"
              value={searchTerm}
              onChange={e => {
                const value = e.target.value
                setSearchTerm(value)
                const next = buildSuggestions(value, allStocks)
                setSuggestions(next)
                setShowSuggestions(value.trim().length > 0)
              }}
              onKeyUp={e => {
                const value = (e.target as HTMLInputElement).value
                const next = buildSuggestions(value, allStocks)
                setSuggestions(next)
                setShowSuggestions(value.trim().length > 0)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  applySearch(searchTerm)
                  setShowSuggestions(false)
                }
              }}
              onFocus={() => setShowSuggestions(searchTerm.trim().length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 140)}
              disabled={!portfolioId || loading}
            />

            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestion-menu risk-suggestion-menu">
                {suggestions.map(item => (
                  <div
                    key={`${item.ticker_id}-${item.name}`}
                    className="suggestion-item risk-suggestion-item"
                    onMouseDown={() => {
                      const token = item.ticker_id
                      setSearchTerm(token)
                      applySearch(token)
                      setShowSuggestions(false)
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{item.name}</span>
                      <span className="pill">{item.ticker_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn secondary"
            onClick={() => {
              applySearch(searchTerm)
              setShowSuggestions(false)
            }}
            disabled={!portfolioId || loading || allStocks.length === 0}
          >
            <Search size={16} style={{marginRight: 6}} /> Search
          </button>
        </div>

        {error && <div style={{ color: '#ef4444', fontWeight: 600 }}>{error}</div>}

        <div className="risk-card-grid">
          {visible.map((item, index) => (
            <div className="card risk-stock-card" key={`${item.ticker_id}-${index}`}>
              <div className="risk-stock-field">
                <div className="stock-label">Name</div>
                <div className="risk-stock-value">{item.name}</div>
              </div>
              <div className="risk-stock-field">
                <div className="stock-label">Ticker ID</div>
                <div className="risk-stock-value">{item.ticker_id}</div>
              </div>
              <div className="risk-stock-field">
                <div className="stock-label">Closing Price</div>
                <div className="risk-stock-value">{fmt(item.closing_price)}</div>
              </div>
              <div className="risk-stock-field">
                <div className="stock-label">Investment Risk Status</div>
                <div className={`risk-stock-value risk-status-pill risk-status-${statusClass(item.investment_risk_status)}`}>
                  {item.investment_risk_status}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && stocks.length === 0 && (
          <div className="stock-empty">No stocks found.</div>
        )}

        {stocks.length > 0 && (
          <div className="stock-pagination" style={{ justifyContent: 'space-between' }}>
            <span>Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, stocks.length)} of {stocks.length}</span>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn secondary"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={!hasPrev}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button className="btn" onClick={() => setPage(p => p + 1)} disabled={!hasNext}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}