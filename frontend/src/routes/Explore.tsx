import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../api/client'

type Portfolio = { id: number; title: string }
type Stock = { id: number; portfolio: number; title: string; ticker: string }

export default function Explore() {
  const { access } = useAuth()
  const nav = useNavigate()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])
  const [portfolioId, setPortfolioId] = useState<number | ''>('' as any)

  const stocksForPortfolio = useMemo(() => {
    if (!portfolioId) return []
    return stocks.filter(s => s.portfolio === portfolioId)
  }, [stocks, portfolioId])

  const load = async () => {
    const ps = await apiGet('/portfolio/', access || undefined)
    const ss = await apiGet('/stock/', access || undefined)
    setPortfolios(ps); setStocks(ss)
  }

  useEffect(() => { if (access) load() }, [access])

  return (
    <div className="container" style={{padding:'24px 0'}}>
      <div className="card grid">
        <div style={{fontWeight:700}}>Explore Dashboard</div>
        <div className="row">
          <select className="select" value={portfolioId || ''} onChange={e=>{setPortfolioId(Number(e.target.value))}}>
            <option value="" disabled>Select portfolio</option>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        {portfolioId && (
          <div className="grid" style={{marginTop:12, gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))'}}>
            {stocksForPortfolio.map(s => (
              <div key={s.id} className="card" style={{cursor:'pointer'}} onClick={()=>nav(`/dashboard/${s.ticker}`)}>
                <div style={{fontWeight:600}}>{s.title}</div>
                <div style={{color:'var(--muted)'}}>{s.ticker}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
