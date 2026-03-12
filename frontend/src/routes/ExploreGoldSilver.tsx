import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../api/client'
import {
  CartesianGrid,
  Label,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type GrowthPoint = {
  date: string
  gold: number
  silver: number
}

type PairPoint = {
  x: number
  y: number
  date: string
}

type RegressionModel = {
  slope: number
  intercept: number
  r2: number
  equation: string
  line: Array<{ x: number; y: number }>
  points_count: number
} | null

type MetalsResponse = {
  from: string
  to: string
  growth_series: GrowthPoint[]
  normalization?: string
  gold_vs_silver: PairPoint[]
  silver_vs_gold: PairPoint[]
  regression_gold_to_silver: RegressionModel
  regression_silver_to_gold: RegressionModel
}

function fitStrength(r2: number) {
  if (!Number.isFinite(r2)) return { label: 'Confidence: Not enough data', className: '' }
  if (r2 >= 0.85) return { label: 'Confidence: Very high', className: 'bg-ok-soft' }
  if (r2 >= 0.6) return { label: 'Confidence: Medium', className: 'bg-warn-soft' }
  return { label: 'Confidence: Low', className: 'bg-danger-soft' }
}

function moveDirection(slope: number) {
  if (!Number.isFinite(slope)) return { label: 'Direction: Not clear', className: '' }
  if (slope > 0) return { label: 'Direction: Move together', className: 'bg-ok-soft' }
  if (slope < 0) return { label: 'Direction: Move opposite', className: 'bg-danger-soft' }
  return { label: 'Direction: Almost flat', className: 'bg-warn-soft' }
}

function relationSentence(inputMetal: 'Gold' | 'Silver', outputMetal: 'Gold' | 'Silver', slope: number) {
  if (!Number.isFinite(slope)) return `Not enough data to explain how ${outputMetal} reacts to ${inputMetal}.`
  const amount = Math.abs(slope).toFixed(2)
  if (slope >= 0) {
    return `If ${inputMetal} goes up by 1 standardized unit, ${outputMetal} usually moves up by about ${amount} units.`
  }
  return `If ${inputMetal} goes up by 1 standardized unit, ${outputMetal} usually moves down by about ${amount} units.`
}

export default function ExploreGoldSilver() {
  const { access } = useAuth()
  const [data, setData] = useState<MetalsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const goldColor = '#f59e0b'
  const silverColor = '#94a3b8'
  const chartTooltipStyle = {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--muted)',
    borderRadius: 10,
    color: 'var(--text)',
  }

  const renderGrowthTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null

    return (
      <div style={{ ...chartTooltipStyle, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Date: {String(label)}</div>
        {payload.map((entry: any) => {
          const lineLabel = String(entry?.name || '')
          const isGold = lineLabel.toLowerCase().includes('gold')
          const itemColor = isGold ? goldColor : silverColor
          return (
            <div key={lineLabel} style={{ color: itemColor, marginTop: 4 }}>
              {lineLabel}: {Number(entry?.value ?? 0).toFixed(2)}%
            </div>
          )
        })}
      </div>
    )
  }

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const res = await apiGet('/stock/metals/', access || undefined)
        setData(res)
        setError(null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load metals data')
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [access])

  return (
    <div className="container page">
      <div className="card grid metals-shell">
        <div style={{ fontSize: 24, fontWeight: 700 }}>Explore Gold & Silver</div>
        {loading && <div>Loading...</div>}
        {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

        {data && (
          <>
            <div style={{ color: 'var(--muted)' }}>
              Range: {data.from} to {data.to}
            </div>

            <div className="grid metals-regression-grid">
              {[
                {
                  key: 'gold-silver',
                  themeClass: 'gold-flow',
                  dotClass: 'gold',
                  title: 'Gold movement compared with Silver',
                  input: 'Gold' as const,
                  output: 'Silver' as const,
                  model: data.regression_gold_to_silver,
                },
                {
                  key: 'silver-gold',
                  themeClass: 'silver-flow',
                  dotClass: 'silver',
                  title: 'Silver movement compared with Gold',
                  input: 'Silver' as const,
                  output: 'Gold' as const,
                  model: data.regression_silver_to_gold,
                },
              ].map((card) => {
                const slope = Number(card.model?.slope ?? NaN)
                const r2 = Number(card.model?.r2 ?? NaN)
                const points = card.model?.points_count ?? 0
                const confidence = fitStrength(r2)
                const direction = moveDirection(slope)

                return (
                  <div key={card.key} className={`card regression-card ${card.themeClass}`}>
                    <div className="regression-header">
                      <span className={`regression-metal-dot ${card.dotClass}`} />
                      <div className="regression-title">{card.title}</div>
                    </div>

                    <div className="regression-axis-row">
                      <span className={`regression-axis-tag ${card.input.toLowerCase()}`}>Input: {card.input}</span>
                      <span className={`regression-axis-tag ${card.output.toLowerCase()}`}>Output: {card.output}</span>
                    </div>

                    <div className="regression-note">{relationSentence(card.input, card.output, slope)}</div>

                    <div className="regression-pill-row">
                      <span className={`pill ${confidence.className}`}>{confidence.label}</span>
                      <span className={`pill ${direction.className}`}>{direction.label}</span>
                      <span className="pill">Data points: {points}</span>
                      <span className="pill">Scaling: {data.normalization || 'standard'}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Price Increase (Last 1 Year)</div>
              <div className="metals-growth-chart">
                <ResponsiveContainer>
                  <LineChart data={data.growth_series}>
                    <CartesianGrid stroke="var(--muted)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--muted)' }}
                      minTickGap={60}
                      tickFormatter={(value: string) => String(value).slice(0, 7)}
                    >
                      <Label value="Date" offset={-2} position="insideBottom" fill="var(--muted)" />
                    </XAxis>
                    <YAxis unit="%" tick={{ fill: 'var(--muted)' }}>
                      <Label value="Increase %" angle={-90} position="insideLeft" fill="var(--muted)" />
                    </YAxis>
                    <Tooltip
                      content={renderGrowthTooltip}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="gold"
                      name="Gold % Increase"
                      stroke={goldColor}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="silver"
                      name="Silver % Increase"
                      stroke={silverColor}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid metals-correlation-grid">
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Correlation: Gold z-score (X) vs Silver z-score (Y)</div>
                <div className="metals-scatter-chart">
                  <ResponsiveContainer>
                    <ScatterChart>
                      <CartesianGrid stroke="var(--muted)" strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="x" name="Gold" tick={{ fill: 'var(--muted)' }}>
                        <Label value="Gold z-score" offset={-2} position="insideBottom" fill="var(--muted)" />
                      </XAxis>
                      <YAxis type="number" dataKey="y" name="Silver" tick={{ fill: 'var(--muted)' }}>
                        <Label value="Silver z-score" angle={-90} position="insideLeft" fill="var(--muted)" />
                      </YAxis>
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={chartTooltipStyle}
                        formatter={(value, name) => {
                          const label = String(name)
                          const itemColor = label.toLowerCase().includes('gold')
                            ? goldColor
                            : label.toLowerCase().includes('silver')
                              ? silverColor
                              : 'var(--text)'
                          return [
                            <span style={{ color: itemColor }}>{Number(value ?? 0).toFixed(2)}</span>,
                            <span style={{ color: itemColor }}>{label}</span>,
                          ]
                        }}
                        labelFormatter={() => ''}
                      />
                      <Legend />
                      <Scatter name="Gold VS Silver (z-score)" data={data.gold_vs_silver} fill={goldColor} />
                      {data.regression_gold_to_silver?.line?.length === 2 && (
                        <Scatter
                          name=""
                          legendType="none"
                          data={data.regression_gold_to_silver.line}
                          line={{ stroke: '#ffffff', strokeWidth: 3 }}
                          shape={() => null}
                          fill="transparent"
                        />
                      )}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Correlation: Silver z-score (X) vs Gold z-score (Y)</div>
                <div className="metals-scatter-chart">
                  <ResponsiveContainer>
                    <ScatterChart>
                      <CartesianGrid stroke="var(--muted)" strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="x" name="Silver" tick={{ fill: 'var(--muted)' }}>
                        <Label value="Silver z-score" offset={-2} position="insideBottom" fill="var(--muted)" />
                      </XAxis>
                      <YAxis type="number" dataKey="y" name="Gold" tick={{ fill: 'var(--muted)' }}>
                        <Label value="Gold z-score" angle={-90} position="insideLeft" fill="var(--muted)" />
                      </YAxis>
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={chartTooltipStyle}
                        formatter={(value, name) => {
                          const label = String(name)
                          const itemColor = label.toLowerCase().includes('gold')
                            ? goldColor
                            : label.toLowerCase().includes('silver')
                              ? silverColor
                              : 'var(--text)'
                          return [
                            <span style={{ color: itemColor }}>{Number(value ?? 0).toFixed(2)}</span>,
                            <span style={{ color: itemColor }}>{label}</span>,
                          ]
                        }}
                        labelFormatter={() => ''}
                      />
                      <Legend />
                      <Scatter name="Silver VS Gold (z-score)" data={data.silver_vs_gold} fill={silverColor} />
                      {data.regression_silver_to_gold?.line?.length === 2 && (
                        <Scatter
                          name=""
                          legendType="none"
                          data={data.regression_silver_to_gold.line}
                          line={{ stroke: '#ffffff', strokeWidth: 4 }}
                          shape={() => null}
                          fill="transparent"
                        />
                      )}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
