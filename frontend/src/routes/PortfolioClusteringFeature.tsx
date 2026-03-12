import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Activity, ChevronRight } from 'lucide-react'
import { CartesianGrid, LabelList, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../api/client'

type Portfolio = { id: number; title: string }

type ClusterPoint = {
  stock_id: number
  name: string
  ticker_id: string
  cluster_id: number
  cluster_label: string
  x: number | null
  y: number | null
}

type ClusterResponse = {
  portfolio_id: number
  portfolio_title: string
  selected_columns: string[]
  cluster_count: number
  optimal_k?: number
  projection?: {
    pca_dimensions: number
    umap_dimensions: number
    umap_engine: string
  }
  points: ClusterPoint[]
}

const CLUSTER_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#14b8a6', '#a855f7']

function groupPoints(points: ClusterPoint[]) {
  const groups = new Map<number, ClusterPoint[]>()

  points.forEach((point) => {
    const x = Number(point.x)
    const y = Number(point.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return

    const list = groups.get(point.cluster_id) || []
    list.push({ ...point, x, y })
    groups.set(point.cluster_id, list)
  })

  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([clusterId, pointsInCluster]) => ({
      clusterId,
      clusterLabel: pointsInCluster[0]?.cluster_label || `Cluster ${clusterId + 1}`,
      points: pointsInCluster,
    }))
}

function getAxisDomain(groups: Array<{ clusterId: number; clusterLabel: string; points: ClusterPoint[] }>) {
  const allPoints = groups.flatMap(group => group.points)
  if (allPoints.length === 0) {
    return {
      x: [-1, 1] as [number, number],
      y: [-1, 1] as [number, number],
    }
  }

  const xs = allPoints.map(p => Number(p.x)).filter(v => Number.isFinite(v))
  const ys = allPoints.map(p => Number(p.y)).filter(v => Number.isFinite(v))

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const xPad = Math.max(0.25, (maxX - minX) * 0.12)
  const yPad = Math.max(0.25, (maxY - minY) * 0.12)

  return {
    x: [minX - xPad, maxX + xPad] as [number, number],
    y: [minY - yPad, maxY + yPad] as [number, number],
  }
}


export default function PortfolioClusteringFeature() {
  const { access } = useAuth()
  const nav = useNavigate()

  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [portfolioId, setPortfolioId] = useState<number | ''>('' as any)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ClusterResponse | null>(null)
  
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null)
  const [tablePage, setTablePage] = useState(0)
  const TABLE_PAGE_SIZE = 5

  useEffect(() => {
    const loadPortfolios = async () => {
      if (!access) return
      const data = await apiGet('/portfolio/', access || undefined)
      setPortfolios(Array.isArray(data) ? data : [])
    }
    loadPortfolios()
  }, [access])

  const runClustering = async () => {
    if (!portfolioId) return

    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await apiGet(`/stock/portfolio-cluster/?portfolio_id=${portfolioId}`, access || undefined)
      setResult(data)
      if (data?.points?.length > 0) {
        const firstCluster = Math.min(...data.points.map((p: ClusterPoint) => p.cluster_id))
        setSelectedClusterId(firstCluster)
      }
      setTablePage(0)
    } catch (e: any) {
      setError(e?.message || 'Failed to cluster selected portfolio.')
    } finally {
      setLoading(false)
    }
  }

  const grouped = useMemo(() => {
    const points = Array.isArray(result?.points) ? result!.points : []
    return groupPoints(points)
  }, [result])

  const axisDomain = useMemo(() => {
    return getAxisDomain(grouped)
  }, [grouped])

  const filteredTablePoints = useMemo(() => {
    if (!result?.points) return []
    if (selectedClusterId === null) return result.points
    return result.points.filter(p => p.cluster_id === selectedClusterId)
  }, [result, selectedClusterId])

  const totalTablePages = Math.max(1, Math.ceil(filteredTablePoints.length / TABLE_PAGE_SIZE))
  const pagedTablePoints = filteredTablePoints.slice(tablePage * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE)

  useEffect(() => {
    setTablePage(0)
  }, [selectedClusterId])

  return (
    <div className="container page">
      <div className="card grid risk-feature-shell">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>Portfolio Clustering</div>
          <button className="btn secondary" onClick={() => nav('/other-features')}>
            <ChevronLeft size={16} /> Back
          </button>
        </div>

        <div className="cluster-controls-row">
          <select
            className="select"
            value={portfolioId || ''}
            onChange={e => setPortfolioId(Number(e.target.value))}
          >
            <option value="" disabled>Select portfolio</option>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>

          <button className="btn" onClick={runClustering} disabled={!portfolioId || loading}>
            <Activity size={16} style={{marginRight: 6}} />
            {loading ? 'Clustering...' : 'Cluster Portfolio'}
          </button>
        </div>

        {error && <div style={{ color: '#ef4444', fontWeight: 600 }}>{error}</div>}

        {result && (
          <>
            <div style={{ color: 'var(--muted)' }}>
              Metrics Analyzed: {(result.selected_columns || []).join(', ') || '—'}
            </div>
            <div style={{ color: 'var(--muted)', marginBottom: 12 }}>
              Analysis Engine: {result.projection?.umap_engine || 'pca_fallback'} | Portions Identified: {result.cluster_count ?? 0}
            </div>

            <div className="card" style={{ height: 440 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Portfolio Cluster Graph</div>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="UMAP-X" domain={axisDomain.x} />
                  <YAxis type="number" dataKey="y" name="UMAP-Y" domain={axisDomain.y} />
                  <Tooltip
                    cursor={false}
                    formatter={(value: any, key: any) => [Number(value).toFixed(3), key]}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null
                      const point = payload[0]?.payload as ClusterPoint | undefined
                      if (!point) return null
                      return (
                        <div style={{ background:'#0f172a', border:'1px solid #1f2937', borderRadius:10, padding:'10px 12px' }}>
                          <div style={{ fontWeight: 700 }}>{point.name}</div>
                          <div style={{ color: 'var(--muted)' }}>{point.ticker_id}</div>
                          <div style={{ color: 'var(--muted)', marginTop: 4 }}>{point.cluster_label}</div>
                          <div style={{ color: 'var(--muted)', marginTop: 4 }}>X: {Number(point.x).toFixed(3)} | Y: {Number(point.y).toFixed(3)}</div>
                        </div>
                      )
                    }}
                    contentStyle={{ background:'#0f172a', border:'1px solid #1f2937', borderRadius:10 }}
                    labelFormatter={() => ''}
                  />
                  <Legend />
                  {grouped.map((cluster, index) => (
                    <Scatter
                      key={cluster.clusterId}
                      name={cluster.clusterLabel}
                      data={cluster.points}
                      fill={CLUSTER_COLORS[index % CLUSTER_COLORS.length]}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14 }}>Cluster Assignments</div>
              
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {grouped.map((g, i) => {
                  const color = CLUSTER_COLORS[g.clusterId % CLUSTER_COLORS.length]
                  const isActive = selectedClusterId === g.clusterId
                  return (
                    <button
                      key={g.clusterId}
                      className="btn"
                      style={{
                        background: isActive ? color : 'rgba(5, 18, 28, 0.6)',
                        borderColor: isActive ? color : 'var(--border-soft)',
                        color: isActive ? '#fff' : color,
                      }}
                      onClick={() => setSelectedClusterId(g.clusterId)}
                    >
                      {g.clusterLabel} ({g.points.length})
                    </button>
                  )
                })}
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Stock Name</th>
                      <th>Cluster</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTablePoints.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>
                          No stocks in this cluster.
                        </td>
                      </tr>
                    ) : (
                      pagedTablePoints.map((pt, i) => (
                        <tr key={`${pt.ticker_id}-${i}`}>
                          <td style={{ fontWeight: 700, color: '#cbd5e1' }}>{pt.ticker_id}</td>
                          <td>{pt.name}</td>
                          <td>
                            <span className="pill" style={{ 
                              borderColor: CLUSTER_COLORS[pt.cluster_id % CLUSTER_COLORS.length], 
                              color: CLUSTER_COLORS[pt.cluster_id % CLUSTER_COLORS.length],
                              background: 'rgba(5, 18, 28, 0.4)'
                            }}>
                              {pt.cluster_label}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {filteredTablePoints.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 14, color: 'var(--muted)' }}>
                  <button 
                    className="btn secondary" 
                    onClick={() => setTablePage(p => Math.max(0, p - 1))} 
                    disabled={tablePage === 0}
                    style={{ padding: '6px 12px' }}
                  >
                    <ChevronLeft size={16} style={{marginRight: 6}} /> Prev
                  </button>
                  <span style={{ fontSize: 13 }}>Page {tablePage + 1} of {totalTablePages}</span>
                  <button 
                    className="btn secondary" 
                    onClick={() => setTablePage(p => Math.min(totalTablePages - 1, p + 1))} 
                    disabled={tablePage >= totalTablePages - 1}
                    style={{ padding: '6px 12px' }}
                  >
                    Next <ChevronRight size={16} style={{marginLeft: 6}} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
