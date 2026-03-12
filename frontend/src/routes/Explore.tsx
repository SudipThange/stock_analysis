import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../api/client'

type Portfolio = { id: number; title: string }
type Stock = { id: number; portfolio: number; title: string; ticker: string }
const PAGE_SIZE = 10

export default function Explore() {
  const { access } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const navState = (location.state || {}) as { portfolioId?: number; page?: number; scrollY?: number }
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])
  const [portfolioId, setPortfolioId] = useState<number | ''>(
    Number.isFinite(navState.portfolioId as number) ? (navState.portfolioId as number) : ('' as any)
  )
  const [page, setPage] = useState(Number.isFinite(navState.page as number) ? (navState.page as number) : 1)

  const stocksForPortfolio = useMemo(() => {
    if (!portfolioId) return []
    return stocks.filter(s => s.portfolio === portfolioId)
  }, [stocks, portfolioId])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(stocksForPortfolio.length / PAGE_SIZE))
  }, [stocksForPortfolio.length])

  const visibleStocks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return stocksForPortfolio.slice(start, start + PAGE_SIZE)
  }, [stocksForPortfolio, page])

  const load = async () => {
    const ps = await apiGet('/portfolio/', access || undefined)
    const ss = await apiGet('/stock/', access || undefined)
    setPortfolios(ps); setStocks(ss)
  }

  useEffect(() => { if (access) load() }, [access])

  useEffect(() => {
    setPage(prev => Math.min(prev, totalPages))
  }, [totalPages])

  useEffect(() => {
    if (Number.isFinite(navState.scrollY as number)) {
      // Restore prior Explore scroll after navigating back from Dashboard.
      setTimeout(() => {
        window.scrollTo({ top: Number(navState.scrollY), behavior: 'auto' })
      }, 0)
    }
  }, [navState.scrollY, stocksForPortfolio.length])

  return (
    <div className="container page">
      <div className="card grid">
        <div style={{fontWeight:700}}>Explore Dashboard</div>
        <div className="card discover-card" onClick={()=>nav('/explore-gold-silver')}>
          <div style={{fontWeight:600}}>Explore Gold & Silver</div>
          <div style={{color:'var(--muted)'}}>View 5-year price increase and correlation graphs.</div>
        </div>
        <div className="row">
          <select
            className="select"
            value={portfolioId || ''}
            onChange={e => {
              setPortfolioId(Number(e.target.value))
              setPage(1)
            }}
          >
            <option value="" disabled>Select portfolio</option>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        {portfolioId && (
          <>
          <div className="grid" style={{marginTop:12, gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))'}}>
            {visibleStocks.map(s => (
              <div
                key={s.id}
                className="card explore-stock-card"
                onClick={() =>
                  nav(`/dashboard/${s.ticker}`, {
                    state: {
                      portfolioId: Number(portfolioId),
                      stockTitle: s.title,
                      page,
                      scrollY: window.scrollY,
                    },
                  })
                }
              >
                <div className="explore-stock-title" style={{fontWeight:600}}>{s.title}</div>
                <div className="explore-stock-ticker" style={{color:'var(--muted)'}}>{s.ticker}</div>
              </div>
            ))}
          </div>
          <div className="row" style={{marginTop:12, justifyContent:'space-between', alignItems:'center'}}>
            <div style={{color:'var(--muted)'}}>Page {page} of {totalPages}</div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft size={16} /> Prev
              </button>
              <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
