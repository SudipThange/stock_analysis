import React, { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LineChart } from 'lucide-react'

export default function StockForecastFeature() {
  const { access: token } = useAuth()
  const nav = useNavigate()
  const [ticker, setTicker] = useState('')
  const [horizon, setHorizon] = useState('7')
  const [error, setError] = useState('')
  const [stocks, setStocks] = useState<any[]>([])

  useEffect(() => {
    apiGet('/stock/', token || undefined).then(data => {
      if (data && Array.isArray(data)) setStocks(data)
    }).catch(() => { })
  }, [token])

  const stockOption = useMemo(() => stocks.find((s) => s.ticker === ticker), [stocks, ticker])

  const openForecast = (asset: 'stocks' | 'btc' | 'gold' | 'silver') => {
    if (asset === 'stocks' && !ticker) {
      setError('Please select a stock before opening stock forecast.')
      return
    }
    setError('')

    const params = new URLSearchParams()
    params.set('asset', asset)
    params.set('horizon', horizon)
    if (asset === 'stocks' && ticker) {
      params.set('ticker', ticker)
      if (stockOption?.title) {
        params.set('title', stockOption.title)
      }
    }
    nav(`/other-features/stock-forecast/result?${params.toString()}`)
  }

  return (
    <div className="container page">
      <div className="card grid risk-feature-shell">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 24 }}>Stock Forecast</div>
          <button className="btn secondary" onClick={() => nav('/other-features')}>
            <ChevronLeft size={16} /> Back
          </button>
        </div>

        <div className="section-sub" style={{ marginTop: -4 }}>
          Configure horizon and choose what to forecast. Result pages include graph + prediction table.
        </div>

        <div className="cluster-controls-row forecast-controls-row">
          <select value={ticker} onChange={(e) => setTicker(e.target.value)} className="select">
            <option value="">Select a stock</option>
            {stocks.map((s) => <option key={s.id} value={s.ticker}>{s.title} ({s.ticker})</option>)}
          </select>

          <select value={horizon} onChange={(e) => setHorizon(e.target.value)} className="select forecast-duration-select">
            <option value="7">7 Days</option>
            <option value="15">15 Days</option>
            <option value="30">30 Days</option>
            <option value="90">90 Days</option>
          </select>

          <button onClick={() => openForecast('stocks')} className="btn">
            <LineChart size={16} style={{marginRight: 6}} />
            Open Stock Forecast
          </button>
        </div>

        {error && <div style={{ color: '#ef4444', fontWeight: 600 }}>{error}</div>}

        <div className="forecast-asset-grid">
          <button className="card discover-card forecast-asset-card" onClick={() => openForecast('btc')}>
            <div className="forecast-asset-title">BTC-USD Forecasting</div>
            <div className="forecast-asset-desc">Bitcoin market forecast with LR, ARIMA, and RNN models.</div>
          </button>

          <button className="card discover-card forecast-asset-card" onClick={() => openForecast('gold')}>
            <div className="forecast-asset-title">Gold Forecasting</div>
            <div className="forecast-asset-desc">Forecast GC=F with trend graph and model-wise prediction table.</div>
          </button>

          <button className="card discover-card forecast-asset-card" onClick={() => openForecast('silver')}>
            <div className="forecast-asset-title">Silver Forecasting</div>
            <div className="forecast-asset-desc">Forecast SI=F and compare model errors in one table.</div>
          </button>

          <button className="card discover-card forecast-asset-card" onClick={() => openForecast('stocks')}>
            <div className="forecast-asset-title">Stocks Forecasting</div>
            <div className="forecast-asset-desc">Use the selected stock and open the existing full forecast view.</div>
          </button>
        </div>
      </div>
    </div>
  )
}
