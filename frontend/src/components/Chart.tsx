import { useEffect, useRef, useState } from 'react'
type Point = { date: string; close: number }

export default function Chart({ series }: { series: Point[] }) {
  const values = series.map(s => s.close)
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const height = 280
  const pad = 24
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver(() => setWidth(el.clientWidth))
    obs.observe(el)
    setWidth(el.clientWidth || 640)
    return () => obs.disconnect()
  }, [])
  if (values.length < 2) return <div className="card">No data</div>
  const min = Math.min(...values)
  const vmax = Math.max(...values)
  const max = vmax === min ? min + 1 : vmax
  const sx = (i: number) => pad + (width - pad * 2) * (i / Math.max(1, values.length - 1))
  const sy = (v: number) => height - pad - (height - pad * 2) * ((v - min) / (max - min))
  const pts = values.map((v, i) => `${sx(i)},${sy(v)}`).join(' ')
  return (
    <div ref={ref} style={{width: '100%'}}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <rect x="0" y="0" width={width} height={height} fill="#0b0f19" />
        <polyline fill="none" stroke="#22c55e" strokeWidth={2} points={pts} />
      </svg>
    </div>
  )
}
