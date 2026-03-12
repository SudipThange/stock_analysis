import { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet } from '../api/client'

type Suggestion = {
  symbol: string
  company_name: string
  exchange: string
}

type StockAutocompleteProps = {
  token?: string
  disabled?: boolean
  value: string
  onChange: (value: string) => void
  onSelect: (item: Suggestion) => void
  placeholder?: string
}

export default function StockAutocomplete({
  token,
  disabled,
  value,
  onChange,
  onSelect,
  placeholder,
}: StockAutocompleteProps) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const requestIdRef = useRef(0)

  const trimmed = value.trim()
  const canSearch = !disabled && trimmed.length > 0

  useEffect(() => {
    if (!canSearch) {
      setItems([])
      setOpen(false)
      setLoading(false)
      setActiveIndex(-1)
      setError(null)
      return
    }

    const controller = new AbortController()
    const currentRequestId = ++requestIdRef.current

    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiGet(
          `/stocks/search/?q=${encodeURIComponent(trimmed)}`,
          token,
          {
            signal: controller.signal,
          }
        )
        if (currentRequestId !== requestIdRef.current) return

        const next: Suggestion[] = Array.isArray(data)
          ? data
              .filter((row: any) => row && row.symbol && row.company_name)
              .map((row: any) => ({
                symbol: String(row.symbol).toUpperCase(),
                company_name: String(row.company_name),
                exchange: String(row.exchange || ''),
              }))
              .slice(0, 10)
          : []

        setItems(next)
        setOpen(true)
        setActiveIndex(next.length > 0 ? 0 : -1)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        if (currentRequestId !== requestIdRef.current) return
        setItems([])
        setOpen(true)
        setActiveIndex(-1)
        setError('Unable to fetch suggestions')
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed, token, canSearch, disabled])

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const activeItem = useMemo(() => {
    if (activeIndex < 0 || activeIndex >= items.length) return null
    return items[activeIndex]
  }, [items, activeIndex])

  const choose = (item: Suggestion) => {
    onSelect(item)
    setOpen(false)
    setItems([])
    setActiveIndex(-1)
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <input
        className="input"
        value={value}
        placeholder={placeholder || 'Search stock symbol or company'}
        disabled={disabled}
        onFocus={() => {
          if (items.length > 0 || loading || error) setOpen(true)
        }}
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onKeyDown={e => {
          if (!open) return

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex(prev => {
              const next = prev + 1
              return next >= items.length ? 0 : next
            })
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex(prev => {
              const next = prev - 1
              return next < 0 ? Math.max(0, items.length - 1) : next
            })
          } else if (e.key === 'Enter') {
            if (activeItem) {
              e.preventDefault()
              choose(activeItem)
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />

      {open && canSearch && (
        <div className="suggestion-menu" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, maxHeight: 260, overflow: 'auto' }}>
          {loading && <div style={{ padding: '10px 12px', color: 'var(--muted)' }}>Searching...</div>}
          {!loading && error && <div style={{ padding: '10px 12px', color: '#ef4444' }}>{error}</div>}
          {!loading && !error && items.length === 0 && <div style={{ padding: '10px 12px', color: 'var(--muted)' }}>No matches found</div>}

          {!loading && !error && items.map((item, index) => (
            <div
              key={`${item.symbol}-${index}`}
              className="suggestion-item"
              style={{
                padding: '8px',
                cursor: 'pointer',
                background: index === activeIndex ? 'rgba(14, 165, 183, 0.22)' : undefined,
              }}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={e => {
                e.preventDefault()
                choose(item)
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.company_name}</span>
                <span className="pill">{item.symbol}</span>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.exchange}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
