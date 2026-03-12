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

type SignalKey = 'buy' | 'sell' | 'discount'

const priceColor = '#3b82f6'
const signalStyle: Record<SignalKey, { label: string; color: string; glow: string }> = {
  buy: { label: 'Buy Signal', color: '#22c55e', glow: 'rgba(34,197,94,.65)' },
  sell: { label: 'Sell Signal', color: '#ef4444', glow: 'rgba(239,68,68,.65)' },
  discount: { label: 'Discount Zone', color: '#f59e0b', glow: 'rgba(245,158,11,.65)' },
}

function inferSignalKey(text?: string, fallbackColor?: string): SignalKey {
  const t = String(text || '').toLowerCase()
  if (t.includes('buy')) return 'buy'
  if (t.includes('sell')) return 'sell'
  if (t.includes('discount') || t.includes('undervalue')) return 'discount'

  const c = String(fallbackColor || '').toLowerCase()
  if (c.includes('ef4444') || c.includes('red')) return 'sell'
  if (c.includes('22c55e') || c.includes('10b981') || c.includes('green')) return 'buy'
  return 'discount'
}

export default function ChartTV({ price, overlays, markers, title, height = 380 }: Props) {
  const overlayMeta = useMemo(
    () => ({
      ma60: { label: '60-day Average', color: '#14b8a6', dash: '6 4' },
      ma20: { label: 'MA20', color: '#22c55e', dash: '6 4' },
      ma50: { label: 'MA50', color: '#f59e0b', dash: '6 4' },
      mean30: { label: 'Mean30', color: '#10b981', dash: '6 4' },
    }),
    []
  )

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

  const markerByTime = useMemo(() => {
    const byTime = new Map<string, SignalKey[]>()
    ;(markers || []).forEach(m => {
      const key = inferSignalKey(m.text, m.color)
      const existing = byTime.get(m.time) || []
      if (!existing.includes(key)) existing.push(key)
      byTime.set(m.time, existing)
    })
    return byTime
  }, [markers])

  const markerPoints = useMemo(() => {
    const rowByTime = new Map(rows.map((r: any) => [r.time, r]))
    return (markers || [])
      .map(m => {
        const signal = inferSignalKey(m.text, m.color)
        const row = rowByTime.get(m.time) || {}
        const closeValue = Number(row.close)
        const ma20Value = Number(row.ma20)
        const ma50Value = Number(row.ma50)

        // For crossover signals, anchor marker to MA zone (not price) to reflect true trigger source.
        let markerValue = closeValue
        if ((signal === 'buy' || signal === 'sell') && Number.isFinite(ma20Value) && Number.isFinite(ma50Value)) {
          markerValue = (ma20Value + ma50Value) / 2
        }

        return {
          time: m.time,
          value: markerValue,
          signal,
          color: signalStyle[signal].color,
          glow: signalStyle[signal].glow,
        }
      })
      .filter(x => Number.isFinite(x.value))
  }, [markers, rows])

  const overlayKeys = overlays ? Object.keys(overlays) : []
  const markerKinds = useMemo(() => new Set(markerPoints.map(m => m.signal)), [markerPoints])

  const renderLegend = (props: any) => {
    const rawItems = Array.isArray(props?.payload) ? props.payload : []
    const seen = new Set<string>()
    const uniqueItems = rawItems.filter((item: any) => {
      const key = String(item?.value || item?.dataKey || '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingTop: 10, alignItems: 'center' }}>
        {uniqueItems.map((item: any) => (
          <div key={String(item?.value)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#cbd5e1', fontSize: 12 }}>
            <span
              style={{
                width: 10,
                height: 2,
                borderRadius: 2,
                background: item?.color || '#cbd5e1',
                display: 'inline-block',
              }}
            />
            <span>{String(item?.value || '')}</span>
          </div>
        ))}
        {(['buy', 'sell', 'discount'] as SignalKey[]).map(kind => {
          if (!markerKinds.has(kind)) return null
          return (
            <div key={`legend-${kind}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#cbd5e1', fontSize: 12 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: signalStyle[kind].color,
                  boxShadow: `0 0 6px ${signalStyle[kind].glow}`,
                  display: 'inline-block',
                }}
              />
              <span>{signalStyle[kind].label}</span>
            </div>
          )
        })}
      </div>
    )
  }

  const renderTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null

    const values = new Map<string, number>()
    payload.forEach((p: any) => {
      if (p && typeof p.dataKey === 'string' && Number.isFinite(p.value)) {
        values.set(p.dataKey, Number(p.value))
      }
    })

    return (
      <div
        style={{
          background: 'rgba(12, 25, 40, .96)',
          border: '1px solid rgba(148, 163, 184, .45)',
          borderRadius: 10,
          color: '#e6edf6',
          padding: '10px 12px',
          minWidth: 220,
          boxShadow: '0 10px 24px rgba(2, 6, 23, .45)',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Date: {String(label)}</div>
        <div style={{ color: priceColor, marginBottom: 4 }}>
          Price: {Number(values.get('close') ?? 0).toFixed(2)}
        </div>
        {overlayKeys.map((k: string) => {
          const meta = overlayMeta[k as keyof typeof overlayMeta]
          const v = values.get(k)
          if (!Number.isFinite(v)) return null
          return (
            <div key={k} style={{ color: meta?.color || '#cbd5e1', marginBottom: 4 }}>
              {meta?.label || k.toUpperCase()}: {Number(v).toFixed(2)}
            </div>
          )
        })}
        {markerByTime.get(String(label))?.length ? (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(148, 163, 184, .25)' }}>
            {markerByTime.get(String(label))?.map((k: SignalKey) => (
              <div key={k} style={{ color: signalStyle[k].color, marginBottom: 2 }}>
                Signal: {signalStyle[k].label}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  if (!price || price.length < 2) {
    return (
      <div>
        {title && <div style={{fontWeight:700, marginBottom:8}}>{title}</div>}
        <div style={{color:'var(--muted)'}}>Not enough data</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 4px 2px' }}>
      {title && <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 8, right: 20, bottom: 8, left: 2 }}>
          <defs>
            <linearGradient id="priceAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={priceColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={priceColor} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,.22)" strokeDasharray="4 4" />
          <XAxis
            dataKey="time"
            stroke="#64748b"
            tick={{ fill: '#cbd5e1', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148,163,184,.35)' }}
            minTickGap={28}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#cbd5e1', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148,163,184,.35)' }}
            tickFormatter={(v: number) => v.toFixed(0)}
            width={44}
          />
          <Tooltip content={renderTooltip} cursor={{ stroke: 'rgba(148,163,184,.45)', strokeWidth: 1 }} />
          <Legend content={renderLegend} />
          <Area type="monotone" dataKey="close" name="Price" stroke="none" fill="url(#priceAreaFill)" legendType="none" />
          <Line
            type="monotone"
            dataKey="close"
            name="Price"
            stroke={priceColor}
            dot={false}
            strokeWidth={2.4}
            activeDot={{ r: 5, fill: priceColor, stroke: '#dbeafe', strokeWidth: 1.5 }}
            connectNulls
          />
          {overlayKeys.map((k, idx) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              name={overlayMeta[k as keyof typeof overlayMeta]?.label || k.toUpperCase()}
              stroke={overlayMeta[k as keyof typeof overlayMeta]?.color || ['#14b8a6', '#f59e0b', '#22c55e', '#ef4444', '#60a5fa'][idx % 5]}
              dot={false}
              strokeWidth={1.8}
              strokeDasharray={overlayMeta[k as keyof typeof overlayMeta]?.dash || '6 4'}
              activeDot={false}
              connectNulls
            />
          ))}
          {markerPoints.map((m, i) => (
            <ReferenceDot
              key={i}
              x={m.time}
              y={m.value}
              r={5.5}
              fill={m.color}
              stroke="#e2e8f0"
              strokeWidth={1.1}
              ifOverflow="visible"
              style={{ filter: `drop-shadow(0 0 4px ${m.glow})` }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
