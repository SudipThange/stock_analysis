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
  gold_vs_silver: PairPoint[]
  silver_vs_gold: PairPoint[]
  regression_gold_to_silver: RegressionModel
  regression_silver_to_gold: RegressionModel
}

export default function ExploreGoldSilver() {
  const { access } = useAuth()
  const [data, setData] = useState<MetalsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chartTooltipStyle = {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--muted)',
    borderRadius: 10,
    color: 'var(--text)',
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
    <div className="container" style={{ padding: '24px 0' }}>
      <div className="card grid">
        <div style={{ fontSize: 24, fontWeight: 700 }}>Explore Gold & Silver</div>
        {loading && <div>Loading...</div>}
        {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

        {data && (
          <>
            <div style={{ color: 'var(--muted)' }}>
              Range: {data.from} to {data.to}
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Gold → Silver Linear Regression</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
                  X = Gold price points (5Y), Y = Silver price points (5Y)
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className="pill">R²: {Number(data.regression_gold_to_silver?.r2 ?? NaN).toFixed(4)}</span>
                  <span className="pill">Points: {data.regression_gold_to_silver?.points_count ?? 0}</span>
                </div>
                <div style={{ color: 'var(--text)', fontSize: 13 }}>{data.regression_gold_to_silver?.equation || '—'}</div>
              </div>

              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Silver → Gold Linear Regression</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
                  X = Silver price points (5Y), Y = Gold price points (5Y)
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className="pill">R²: {Number(data.regression_silver_to_gold?.r2 ?? NaN).toFixed(4)}</span>
                  <span className="pill">Points: {data.regression_silver_to_gold?.points_count ?? 0}</span>
                </div>
                <div style={{ color: 'var(--text)', fontSize: 13 }}>{data.regression_silver_to_gold?.equation || '—'}</div>
              </div>
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Price Increase (Last 5 Years)</div>
              <div style={{ width: '100%', height: 420 }}>
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
                      contentStyle={chartTooltipStyle}
                      labelFormatter={(label) => `Date: ${String(label)}`}
                      formatter={(value, name) => [`${Number(value ?? 0).toFixed(2)}%`, String(name)]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="gold"
                      name="Gold % Increase"
                      stroke="var(--accent)"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="silver"
                      name="Silver % Increase"
                      stroke="var(--accent-2)"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(480px,1fr))' }}>
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Correlation: Gold (X) vs Silver (Y)</div>
                <div style={{ width: '100%', height: 380 }}>
                  <ResponsiveContainer>
                    <ScatterChart>
                      <CartesianGrid stroke="var(--muted)" strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="x" name="Gold" tick={{ fill: 'var(--muted)' }}>
                        <Label value="Gold Price" offset={-2} position="insideBottom" fill="var(--muted)" />
                      </XAxis>
                      <YAxis type="number" dataKey="y" name="Silver" tick={{ fill: 'var(--muted)' }}>
                        <Label value="Silver Price" angle={-90} position="insideLeft" fill="var(--muted)" />
                      </YAxis>
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={chartTooltipStyle}
                        formatter={(value, name) => [Number(value ?? 0).toFixed(2), String(name)]}
                        labelFormatter={() => ''}
                      />
                      <Legend />
                      <Scatter name="Gold VS Silver" data={data.gold_vs_silver} fill="var(--accent)" />
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
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Correlation: Silver (X) vs Gold (Y)</div>
                <div style={{ width: '100%', height: 380 }}>
                  <ResponsiveContainer>
                    <ScatterChart>
                      <CartesianGrid stroke="var(--muted)" strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="x" name="Silver" tick={{ fill: 'var(--muted)' }}>
                        <Label value="Silver Price" offset={-2} position="insideBottom" fill="var(--muted)" />
                      </XAxis>
                      <YAxis type="number" dataKey="y" name="Gold" tick={{ fill: 'var(--muted)' }}>
                        <Label value="Gold Price" angle={-90} position="insideLeft" fill="var(--muted)" />
                      </YAxis>
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={chartTooltipStyle}
                        formatter={(value, name) => [Number(value ?? 0).toFixed(2), String(name)]}
                        labelFormatter={() => ''}
                      />
                      <Legend />
                      <Scatter name="Silver VS Gold" data={data.silver_vs_gold} fill="var(--accent-2)" />
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
