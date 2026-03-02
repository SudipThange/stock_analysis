import { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Area, Legend, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceDot } from 'recharts'

type Point = { time: string; value: number }
type Props = {
  price: Point[]
  overlays?: { [key: string]: Point[] }
  markers?: { time: string; color?: string; text?: string }[]
  title?: string
  height?: number
}

export default function ChartTV({ price, overlays, markers, title, height = 380 }: Props) {
  const rows = useMemo(() => {
    const map = new Map<string, any>()
    price.forEach(p => map.set(p.time, { time: p.time, close: p.value }))
    if (overlays) {
      Object.entries(overlays).forEach(([key, arr]) => {
        arr.forEach(p => {
          const row = map.get(p.time) || { time: p.time }
          row[key] = p.value
          map.set(p.time, row)
        })
      })
    }
    return Array.from(map.values())
  }, [price, overlays])
  const markerPoints = useMemo(() => {
    const closeByTime = new Map(rows.map((r: any) => [r.time, r.close]))
    return (markers || [])
      .map(m => ({ time: m.time, value: closeByTime.get(m.time), color: m.color || '#F59E0B' }))
      .filter(x => Number.isFinite(x.value))
  }, [markers, rows])
  if (!price || price.length < 2) {
    return (
      <div>
        {title && <div style={{fontWeight:700, marginBottom:8}}>{title}</div>}
        <div style={{color:'var(--muted)'}}>Not enough data</div>
      </div>
    )
  }
  const overlayColors = ['#10B981', '#F59E0B', '#22C55E', '#EF4444', '#60A5FA']
  const overlayKeys = overlays ? Object.keys(overlays) : []
  return (
    <div>
      {title && <div style={{fontWeight:700, marginBottom:8}}>{title}</div>}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1f2937" />
          <XAxis dataKey="time" stroke="#334155" tick={{ fill: '#cbd5e1' }} />
          <YAxis stroke="#334155" tick={{ fill: '#cbd5e1' }} tickFormatter={(v: number) => v.toFixed(0)} />
          <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #1f2937', borderRadius:10 }} />
          <Legend wrapperStyle={{ color:'#cbd5e1' }} />
          <Area type="monotone" dataKey="close" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.15} />
          <Line type="monotone" dataKey="close" stroke="#4F46E5" dot={false} strokeWidth={2} />
          {overlayKeys.map((k, idx) => (
            <Line key={k} type="monotone" dataKey={k} stroke={overlayColors[idx % overlayColors.length]} dot={false} strokeWidth={1} strokeDasharray="4 3" />
          ))}
          {markerPoints.map((m, i) => (
            <ReferenceDot key={i} x={m.time} y={m.value} r={4} fill={m.color} stroke="#0f172a" />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
