import { useEffect, useMemo, useState } from 'react'
import Popup from '../components/Popup'
import { useAuth } from '../context/AuthContext'
import { apiGet, apiJson } from '../api/client'

type Portfolio = { id: number; title: string }
type Stock = { id: number; portfolio: number; title: string; ticker: string }
type Suggest = { name: string; symbol: string; exchange: string; region: string }

export default function Stocks() {
  const { access } = useAuth()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [items, setItems] = useState<Stock[]>([])
  const [form, setForm] = useState<{portfolio?: number; title: string; ticker: string}>({ title:'', ticker:'' })
  const [editing, setEditing] = useState<Stock | null>(null)
  const [suggestions, setSuggestions] = useState<Suggest[]>([])
  const [showSug, setShowSug] = useState(false)
  const [showSuccess, setShowSuccess] = useState<{open:boolean; text:string}>({open:false, text:''})

  const load = async () => {
    const ps = await apiGet('/portfolio/', access || undefined)
    const ss = await apiGet('/stock/', access || undefined)
    setPortfolios(ps); setItems(ss)
  }

  useEffect(() => { if (access) load() }, [access])

  useEffect(() => {
    const q = form.title.trim()
    if (!q) { setSuggestions([]); return }
    const id = setTimeout(async () => {
      try {
        const data = await apiGet(`/stock/search/?q=${encodeURIComponent(q)}`, access || undefined)
        setSuggestions(data.results || [])
        setShowSug(true)
      } catch {}
    }, 300)
    return () => clearTimeout(id)
  }, [form.title, access])

  const submit = async () => {
    if (!form.portfolio || !form.title || !form.ticker) return
    try {
      await apiJson('/stock/', 'POST', { portfolio: form.portfolio, title: form.title, ticker: form.ticker }, access || undefined)
      setForm({ title:'', ticker:'' })
      setShowSuccess({ open:true, text:`Stock “${form.title}” added to portfolio.` })
      await load()
    } catch (e) {
      alert('Failed to create stock. Please verify Title and Ticker.')
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

  return (
    <div className="container" style={{padding:'24px 0'}}>
      <div className="grid" style={{gridTemplateColumns:'1fr 2fr'}}>
        <div className="card">
          <div style={{fontWeight:700, marginBottom:8}}>Create Stock</div>
          <div className="grid">
            <select className="select" value={form.portfolio || ''} onChange={e=>setForm({...form, portfolio: Number(e.target.value)})}>
              <option value="" disabled>Select portfolio</option>
              {portfolios.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <div style={{position:'relative'}}>
              <input className="input" placeholder="Title" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} onFocus={()=>setShowSug(true)} onBlur={()=>setTimeout(()=>setShowSug(false),150)} />
              {showSug && suggestions.length>0 && (
                <div className="card" style={{position:'absolute', top:'100%', left:0, right:0, zIndex:10, maxHeight:200, overflow:'auto'}}>
                  {suggestions.slice(0,10).map(s => (
                    <div key={s.symbol} style={{padding:'8px', cursor:'pointer'}} onMouseDown={()=>{
                      setForm({ ...form, title: s.name || s.symbol, ticker: s.symbol.toUpperCase() })
                      setShowSug(false)
                    }}>
                      <div style={{display:'flex', justifyContent:'space-between'}}>
                        <span>{s.name}</span>
                        <span className="pill">{s.symbol}</span>
                      </div>
                      <div style={{color:'var(--muted)', fontSize:12}}>{s.exchange} • {s.region}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input className="input" placeholder="Ticker (e.g., AAPL)" value={form.ticker} onChange={e=>setForm({...form, ticker: e.target.value.toUpperCase()})} />
            <button className="btn" onClick={submit}>Create</button>
          </div>
        </div>
        <div className="card">
          <div style={{fontWeight:700, marginBottom:8}}>Stocks</div>
          <table className="table">
            <thead><tr><th>Portfolio</th><th>Title</th><th>Ticker</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id}>
                  <td>
                    {editing?.id===s.id ? (
                      <select className="select" value={editing.portfolio} onChange={e=>setEditing({...editing, portfolio: Number(e.target.value)})}>
                        {portfolios.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    ) : portfolios.find(p=>p.id===s.portfolio)?.title || s.portfolio}
                  </td>
                  <td>
                    {editing?.id===s.id ? (
                      <input className="input" value={editing.title} onChange={e=>setEditing({...editing, title:e.target.value})} />
                    ) : s.title}
                  </td>
                  <td>
                    {editing?.id===s.id ? (
                      <input className="input" value={editing.ticker} onChange={e=>setEditing({...editing, ticker:e.target.value.toUpperCase()})} />
                    ) : s.ticker}
                  </td>
                  <td className="row">
                    {editing?.id===s.id ? (
                      <>
                        <button className="btn" onClick={saveEdit}>Save</button>
                        <button className="btn secondary" onClick={()=>setEditing(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn" onClick={()=>setEditing(s)}>Edit</button>
                        <button className="btn secondary" onClick={()=>del(s.id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Popup
        open={showSuccess.open}
        title="Stock Added"
        message={showSuccess.text}
        onClose={()=>setShowSuccess({open:false, text:''})}
      />
    </div>
  )
}
