import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Save, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import TopSuccessPopup from '../components/TopSuccessPopup'
import StockAutocomplete from '../components/StockAutocomplete'
import { useAuth } from '../context/AuthContext'
import { apiGet, apiJson } from '../api/client'

type Portfolio = { id: number; title: string }
type Stock = {
  id: number
  portfolio: number
  title: string
  ticker: string
  min_price?: number | null
  max_price?: number | null
  today_open?: number | null
  today_close?: number | null
  avg_price_last_month?: number | null
  today_price?: number | null
  pe_ratio?: number | null
}

export default function Stocks() {
  const PAGE_SIZE = 10
  const { access } = useAuth()
  const navigate = useNavigate()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [items, setItems] = useState<Stock[]>([])
  const [form, setForm] = useState<{portfolio?: number; title: string; ticker: string}>({ title:'', ticker:'' })
  const [pickedSymbol, setPickedSymbol] = useState<string | null>(null)
  const [editing, setEditing] = useState<Stock | null>(null)
  const [portfolioFilter, setPortfolioFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [showSuccess, setShowSuccess] = useState<{open:boolean; text:string}>({open:false, text:''})

  const parseErrorMessage = (error: unknown) => {
    const fallback = 'Failed to create stock. Please verify Title and Ticker.'
    if (!(error instanceof Error) || !error.message) return fallback

    const raw = error.message.trim()
    try {
      const parsed = JSON.parse(raw)
      if (parsed?.ticker) {
        return Array.isArray(parsed.ticker) ? parsed.ticker[0] : String(parsed.ticker)
      }
      if (parsed?.portfolio) {
        return Array.isArray(parsed.portfolio) ? parsed.portfolio[0] : String(parsed.portfolio)
      }
      if (parsed?.detail) return String(parsed.detail)
      return fallback
    } catch {
      return raw || fallback
    }
  }

  const load = async () => {
    const ps = await apiGet('/portfolio/', access || undefined)
    const ss = await apiGet('/stock/', access || undefined)
    setPortfolios(ps); setItems(ss)
  }

  useEffect(() => { if (access) load() }, [access])

  useEffect(() => {
    setPickedSymbol(null)
    setForm(prev => ({ ...prev, title: '', ticker: '' }))
  }, [form.portfolio])

  const submit = async () => {
    if (!form.portfolio || !form.title || !form.ticker || !pickedSymbol) return
    try {
      await apiJson('/stock/', 'POST', { portfolio: form.portfolio, title: form.title, ticker: form.ticker }, access || undefined)
      setForm(prev => ({ ...prev, title:'', ticker:'' }))
      setPickedSymbol(null)
      setShowSuccess({ open:true, text:`Stock "${form.title}" added to portfolio.` })
      await load()
    } catch (e) {
      alert(parseErrorMessage(e))
    }
  }

  const saveEdit = async () => {
    if (!editing) return
    await apiJson(`/stock/${editing.id}/`, 'PUT', { portfolio: editing.portfolio, title: editing.title, ticker: editing.ticker }, access || undefined)
    setEditing(null)
    await load()
  }

  const del = async (id: number) => {
    await apiJson(`/stock/${id}/`, 'DELETE', {}, access || undefined)
    await load()
  }

  const filteredItems = portfolioFilter === 'all'
    ? items
    : items.filter(s => s.portfolio === Number(portfolioFilter))

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const pagedItems = filteredItems.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  useEffect(() => {
    setPage(0)
  }, [portfolioFilter, items.length])

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1))
    }
  }, [page, totalPages])

  const fmt = (value?: number | null) => value === null || value === undefined ? '—' : Number(value).toFixed(2)

  return (
    <div className="container page">
      <TopSuccessPopup
        open={showSuccess.open}
        title="Stock Added"
        message={showSuccess.text}
        onDone={() => setShowSuccess({open:false, text:''})}
      />
      <div className="grid stocks-stack-layout">
        <div className="card">
          <div style={{fontWeight:700, marginBottom:8}}>Create Stock</div>
          <div className="grid">
            <select className="select" value={form.portfolio || ''} onChange={e=>setForm({...form, portfolio: Number(e.target.value)})}>
              <option value="" disabled>Select portfolio</option>
              {portfolios.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <StockAutocomplete
              token={access || undefined}
              disabled={!form.portfolio}
              value={form.title}
              placeholder={form.portfolio ? 'Title' : 'Select portfolio first'}
              onChange={next => {
                setPickedSymbol(null)
                setForm(prev => ({ ...prev, title: next, ticker: '' }))
              }}
              onSelect={item => {
                setPickedSymbol(item.symbol)
                setForm(prev => ({ ...prev, title: item.company_name || item.symbol, ticker: item.symbol }))
              }}
            />
            <input className="input" placeholder="Ticker (auto-filled from suggestion)" value={form.ticker} readOnly />
            <button className="btn" onClick={submit} disabled={!form.portfolio || !pickedSymbol}>
              <Plus size={16} style={{marginRight: 6}} />
              Create
            </button>
          </div>
        </div>
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:8}}>
            <div style={{fontWeight:700}}>Stocks</div>
            <select className="select stock-filter-select" style={{maxWidth:260}} value={portfolioFilter} onChange={e=>setPortfolioFilter(e.target.value)}>
              <option value="all">All portfolios</option>
              {portfolios.map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
            </select>
          </div>
          <div className="stock-list">
            {filteredItems.length > 0 && (
              <>
                <div className="stock-analysis-hint">Double click to analyze the stock.</div>
                <div className="table-wrap stocks-table-wrap">
                <table className="table stocks-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Stock Name</th>
                      <th>Ticker</th>
                      <th>Open</th>
                      <th>Close</th>
                      <th>Min</th>
                      <th>Max</th>
                      <th>Mean (1M)</th>
                      <th>P/E Ratio</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedItems.map(s => (
                      <tr
                        key={s.id}
                        className={`${editing?.id === s.id ? '' : 'stock-click-row'} stock-table-row`}
                        onDoubleClick={() => {
                          if (editing?.id === s.id) return
                          navigate(`/stocks/${s.id}`)
                        }}
                        onKeyDown={(e) => {
                          if (editing?.id === s.id) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            navigate(`/stocks/${s.id}`)
                          }
                        }}
                        tabIndex={editing?.id === s.id ? -1 : 0}
                      >
                        <td>
                          {editing?.id === s.id ? (
                            <select
                              className="select"
                              value={editing.portfolio}
                              onChange={e => setEditing({ ...editing, portfolio: Number(e.target.value) })}
                            >
                              {portfolios.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                          ) : (portfolios.find(p => p.id === s.portfolio)?.title || s.portfolio)}
                        </td>
                        <td>
                          {editing?.id === s.id ? (
                            <input className="input" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
                          ) : s.title}
                        </td>
                        <td>
                          {editing?.id === s.id ? (
                            <input className="input" value={editing.ticker} onChange={e => setEditing({ ...editing, ticker: e.target.value.toUpperCase() })} />
                          ) : s.ticker}
                        </td>
                        <td>{fmt(s.today_open)}</td>
                        <td className={s.today_close != null && s.today_open != null ? (s.today_close >= s.today_open ? 'text-ok' : 'text-danger') : ''}>
                          {s.today_close != null && s.today_open != null && (s.today_close >= s.today_open ? '▲ ' : '▼ ')}
                          {fmt(s.today_close)}
                        </td>
                        <td>{fmt(s.min_price)}</td>
                        <td>{fmt(s.max_price)}</td>
                        <td>{fmt(s.avg_price_last_month)}</td>
                        <td>{fmt(s.pe_ratio)}</td>
                        <td className="stock-actions-cell">
                          <div className="stock-row-actions">
                            {editing?.id === s.id ? (
                              <>
                                <button className="btn" onClick={saveEdit}>
                                  <Save size={16} style={{marginRight: 6}} /> Save
                                </button>
                                <button className="btn secondary" onClick={(e) => { e.stopPropagation(); setEditing(null) }}>
                                  <X size={16} style={{marginRight: 6}} /> Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button className="btn" onClick={(e) => { e.stopPropagation(); setEditing(s) }}>
                                  <Edit2 size={16} style={{marginRight: 6}} /> Edit
                                </button>
                                <button className="btn secondary" onClick={(e) => { e.stopPropagation(); del(s.id) }}>
                                  <Trash2 size={16} style={{marginRight: 6}} /> Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}

            {filteredItems.length === 0 && (
              <div className="stock-empty">No stocks found for selected portfolio.</div>
            )}

            {filteredItems.length > 0 && (
              <div className="stock-pagination">
                <button className="btn secondary" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft size={16} style={{marginRight: 6}} /> Previous
                </button>
                <span>Page {page + 1} of {totalPages}</span>
                <button className="btn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  Next <ChevronRight size={16} style={{marginLeft: 6}} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
