import { ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  message?: string
  onClose: () => void
  actions?: ReactNode
}

export default function Popup({ open, title, message, onClose, actions }: Props) {
  if (!open) return null
  return (
    <div className="popup-overlay">
      <div className="card popup-card">
        <div className="popup-title">{title}</div>
        {message && <div className="popup-message">{message}</div>}
        <div className="row popup-actions">
          {actions}
          <button className="btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}
