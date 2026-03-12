import { useEffect } from 'react'
import { Check } from 'lucide-react'

type Props = {
  open: boolean
  title: string
  message: string
  onDone?: () => void
  durationMs?: number
}

export default function TopSuccessPopup({
  open,
  title,
  message,
  onDone,
  durationMs = 400,
}: Props) {
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      onDone?.()
    }, Math.max(100, durationMs))
    return () => window.clearTimeout(timer)
  }, [open, onDone, durationMs])

  if (!open) return null

  return (
    <div className="top-success-wrap" role="status" aria-live="polite">
      <div className="top-success-card">
        <div className="top-success-icon">
          <Check size={22} strokeWidth={3} />
        </div>
        <div className="top-success-title">{title}</div>
        <div className="top-success-message">{message}</div>
      </div>
    </div>
  )
}
