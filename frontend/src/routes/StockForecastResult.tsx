import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiGet } from '../api/client'
import { useAuth } from '../context/AuthContext'
import ChartTV from '../components/ChartTV'

interface ForecastRow {
  date: string
  lr: number
  lr_diff?: number
  lr_error?: number
  arima: number
  arima_diff?: number
  arima_error?: number
  rnn: number
  rnn_diff?: number
  rnn_error?: number
  actual: number
  is_predicted: boolean
}

interface HistoricalForecastRow {
  date: string
  lr: number | null
  lr_diff?: number | null
  lr_error?: number | null
  arima: number | null
  arima_diff?: number | null
  arima_error?: number | null
  rnn: number | null
  rnn_diff?: number | null
  rnn_error?: number | null
  actual: number
  is_predicted: boolean
}

interface ForecastResponse {
  title: string
  ticker: string
  actual_price: number
  dataset?: {
    requested_period?: string
    requested_interval?: string
    used_interval?: string
    rows?: number
    from?: string
    to?: string
  }
  data: {
    table: ForecastRow[]
    historical_table?: HistoricalForecastRow[]
    next_prediction?: ForecastRow
    charts: {
      history: { time: string, value: number }[]
      lr: { time: string, value: number }[]
      arima: { time: string, value: number }[]
      rnn: { time: string, value: number }[]
    }
    feature_columns?: string[]
    normalization?: string
    eda?: {
      rows?: number
      start?: string
      end?: string
      missing_close?: number
      close_mean?: number
      close_std?: number
      close_min?: number
      close_max?: number
    }
  }
}

const ASSET_META: Record<string, { label: string; ticker: string }> = {
  btc: { label: 'BTC-USD Forecast', ticker: 'BTC-USD' },
  gold: { label: 'Gold Forecast', ticker: 'GC=F' },
  silver: { label: 'Silver Forecast', ticker: 'SI=F' },
}

export default function StockForecastResult() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const { access: token } = useAuth()

  const asset = (searchParams.get('asset') || 'stocks').toLowerCase()
  const stockTicker = (searchParams.get('ticker') || '').toUpperCase()
  const horizon = searchParams.get('horizon') || '7'
  const stockTitle = searchParams.get('title') || 'Selected Stock'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<ForecastResponse | null>(null)
  const [activeModel, setActiveModel] = useState<'all' | 'lr' | 'arima' | 'rnn'>('all')
  const isCommodityOrCrypto = asset === 'btc' || asset === 'gold' || asset === 'silver'
  const effectiveHorizon = isCommodityOrCrypto ? '1' : horizon


  const resolvedTicker = useMemo(() => {
    if (asset === 'stocks') return stockTicker
    return ASSET_META[asset]?.ticker || ''
  }, [asset, stockTicker])

  const resolvedTitle = useMemo(() => {
    if (asset === 'stocks') return `${stockTitle} (${stockTicker})`
    return ASSET_META[asset]?.label || 'Forecast'
  }, [asset, stockTicker, stockTitle])

  useEffect(() => {
    const run = async () => {
      if (!resolvedTicker) {
        setError('Ticker not found. Please select a stock again.')
        return
      }
      setLoading(true)
      setError('')
      try {
        const resp: ForecastResponse = await apiGet(
          `/stock/forecast/?ticker=${encodeURIComponent(resolvedTicker)}&horizon=${encodeURIComponent(effectiveHorizon)}`,
          token || undefined,
        )
        setData(resp)
      } catch (err: any) {
        setError(err.message || 'Forecast failed')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [resolvedTicker, effectiveHorizon, token])

  const renderMetric = (diff?: number | null, err?: number | null) => {
    if (diff === undefined || diff === null || err === undefined || err === null) return <span>-</span>
    const color = err < 2 ? '#22c55e' : err < 5 ? '#f59e0b' : '#ef4444'
    return (
      <div className="metric-cell">
        <span style={{ color }}>
          {diff > 0 ? '+' : ''}
          {diff.toFixed(2)} ({err.toFixed(1)}%)
        </span>
      </div>
    )
  }

  const modelOverlays: Record<string, { time: string; value: number }[]> | undefined = !data
    ? undefined
    : activeModel === 'all'
      ? {
          LR: data.data.charts.lr,
          ARIMA: data.data.charts.arima,
          RNN: data.data.charts.rnn,
        }
      : activeModel === 'lr'
        ? { LR: data.data.charts.lr }
        : activeModel === 'arima'
          ? { ARIMA: data.data.charts.arima }
          : { RNN: data.data.charts.rnn }

  const horizonDays = Number.parseInt(effectiveHorizon, 10) || 7
  const targetDate = new Date()
  if (isCommodityOrCrypto) {
    targetDate.setHours(targetDate.getHours() + 1)
  } else {
    targetDate.setDate(targetDate.getDate() + horizonDays)
  }
  const targetDateText = isCommodityOrCrypto
    ? targetDate.toISOString().slice(0, 16).replace('T', ' ')
    : targetDate.toISOString().slice(0, 10)

  const forecastRows = data?.data.table || []
  const selectedIndex = Math.max(0, Math.min(horizonDays - 1, Math.max(0, forecastRows.length - 1)))
  const selectedRow = forecastRows[selectedIndex]
  const historicalRows = data?.data.historical_table || []

  const previousHourRows = useMemo(() => {
    if (!data || !isCommodityOrCrypto) return [] as HistoricalForecastRow[]
    return data.data.historical_table || []
  }, [data, isCommodityOrCrypto])

  return (
    <div className="container page">
      <div className="card grid risk-feature-shell">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 24 }}>{resolvedTitle}</div>
          <button className="btn secondary" onClick={() => nav('/other-features/stock-forecast')}>Back</button>
        </div>

        <div className="section-sub" style={{ marginTop: -4 }}>
          {data
            ? `${data.title} (${data.ticker}) | Current Price: $${data.actual_price.toFixed(2)}`
            : 'Loading forecast details...'}
        </div>

        {loading && <div>Forecasting...</div>}
        {error && <div style={{ color: '#ef4444', fontWeight: 600 }}>{error}</div>}

        {data && (
          <>
            <div className="forecast-model-switch">
              <button className={`forecast-switch-btn ${activeModel === 'all' ? 'active' : ''}`} onClick={() => setActiveModel('all')}>All Models</button>
              <button className={`forecast-switch-btn ${activeModel === 'lr' ? 'active lr-active' : ''}`} onClick={() => setActiveModel('lr')}>Linear Regression</button>
              <button className={`forecast-switch-btn ${activeModel === 'arima' ? 'active arima-active' : ''}`} onClick={() => setActiveModel('arima')}>ARIMA</button>
              <button className={`forecast-switch-btn ${activeModel === 'rnn' ? 'active rnn-active' : ''}`} onClick={() => setActiveModel('rnn')}>RNN (LSTM)</button>
            </div>

            <div className="card" style={{ minHeight: 430 }}>
              <ChartTV
                title="Forecast Line Chart"
                price={data.data.charts.history}
                overlays={modelOverlays}
                height={380}
              />
            </div>

            <div className="table-responsive">
              <table className="forecast-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Actual</th>
                    <th className="lr-col">LR Forecast</th>
                    <th className="lr-col">Diff/Error</th>
                    <th className="arima-col">ARIMA Forecast</th>
                    <th className="arima-col">Diff/Error</th>
                    <th className="rnn-col">RNN Forecast</th>
                    <th className="rnn-col">Diff/Error</th>
                  </tr>
                </thead>
                <tbody>
                  {isCommodityOrCrypto ? (
                    <>
                      {selectedRow && (
                        <tr className="highlighted-row">
                          <td style={{ fontWeight: 800 }}>{`Prediction row [Next Hour Pred] -> ${targetDateText}`}</td>
                          <td style={{ color: 'var(--muted)' }}>${selectedRow.actual.toFixed(2)}</td>
                          <td className="lr-val">${selectedRow.lr.toFixed(2)}</td>
                          <td>{renderMetric(selectedRow.lr_diff, selectedRow.lr_error)}</td>
                          <td className="arima-val">${selectedRow.arima.toFixed(2)}</td>
                          <td>{renderMetric(selectedRow.arima_diff, selectedRow.arima_error)}</td>
                          <td className="rnn-val">${selectedRow.rnn.toFixed(2)}</td>
                          <td>{renderMetric(selectedRow.rnn_diff, selectedRow.rnn_error)}</td>
                        </tr>
                      )}

                      {previousHourRows.map((row, idx) => (
                        <tr key={`${row.date}-${idx}`}>
                          <td style={{ fontWeight: 600 }}>{row.date}</td>
                          <td style={{ color: 'var(--muted)' }}>${row.actual.toFixed(2)}</td>
                          <td className="lr-val">{row.lr === null ? '-' : `$${row.lr.toFixed(2)}`}</td>
                          <td>{renderMetric(row.lr_diff, row.lr_error)}</td>
                          <td className="arima-val">{row.arima === null ? '-' : `$${row.arima.toFixed(2)}`}</td>
                          <td>{renderMetric(row.arima_diff, row.arima_error)}</td>
                          <td className="rnn-val">{row.rnn === null ? '-' : `$${row.rnn.toFixed(2)}`}</td>
                          <td>{renderMetric(row.rnn_diff, row.rnn_error)}</td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <>
                      {selectedRow && (
                        <tr className="highlighted-row">
                          <td style={{ fontWeight: 800 }}>{`Next Prediction (${horizonDays} Days) -> ${targetDateText}`}</td>
                          <td style={{ color: 'var(--muted)' }}>${selectedRow.actual.toFixed(2)}</td>
                          <td className="lr-val">${selectedRow.lr.toFixed(2)}</td>
                          <td>{renderMetric(selectedRow.lr_diff, selectedRow.lr_error)}</td>
                          <td className="arima-val">${selectedRow.arima.toFixed(2)}</td>
                          <td>{renderMetric(selectedRow.arima_diff, selectedRow.arima_error)}</td>
                          <td className="rnn-val">${selectedRow.rnn.toFixed(2)}</td>
                          <td>{renderMetric(selectedRow.rnn_diff, selectedRow.rnn_error)}</td>
                        </tr>
                      )}

                      {historicalRows.map((row, idx) => (
                        <tr key={`${row.date}-${idx}`}>
                          <td style={{ fontWeight: 600 }}>{row.date}</td>
                          <td style={{ color: 'var(--muted)' }}>${row.actual.toFixed(2)}</td>
                          <td className="lr-val">{row.lr === null ? '-' : `$${row.lr.toFixed(2)}`}</td>
                          <td>{renderMetric(row.lr_diff, row.lr_error)}</td>
                          <td className="arima-val">{row.arima === null ? '-' : `$${row.arima.toFixed(2)}`}</td>
                          <td>{renderMetric(row.arima_diff, row.arima_error)}</td>
                          <td className="rnn-val">{row.rnn === null ? '-' : `$${row.rnn.toFixed(2)}`}</td>
                          <td>{renderMetric(row.rnn_diff, row.rnn_error)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Data & EDA Summary</div>
              <div className="table-responsive">
                <table className="table">
                  <tbody>
                    <tr>
                      <td>Requested Period / Interval</td>
                      <td>{data.dataset?.requested_period || '-'} / {data.dataset?.requested_interval || '-'}</td>
                      <td>Used Interval</td>
                      <td>{data.dataset?.used_interval || '-'}</td>
                    </tr>
                    <tr>
                      <td>Rows</td>
                      <td>{data.dataset?.rows ?? data.data.eda?.rows ?? '-'}</td>
                      <td>Range</td>
                      <td>{data.dataset?.from || data.data.eda?.start || '-'} to {data.dataset?.to || data.data.eda?.end || '-'}</td>
                    </tr>
                    <tr>
                      <td>Close Mean/Std</td>
                      <td>{data.data.eda?.close_mean?.toFixed(2) ?? '-'} / {data.data.eda?.close_std?.toFixed(2) ?? '-'}</td>
                      <td>Close Min/Max</td>
                      <td>{data.data.eda?.close_min?.toFixed(2) ?? '-'} / {data.data.eda?.close_max?.toFixed(2) ?? '-'}</td>
                    </tr>
                    <tr>
                      <td>Missing Close</td>
                      <td>{data.data.eda?.missing_close ?? '-'}</td>
                      <td>Normalization</td>
                      <td>{data.data.normalization || '-'}</td>
                    </tr>
                    <tr>
                      <td>Features</td>
                      <td colSpan={3}>{(data.data.feature_columns || []).join(', ') || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
