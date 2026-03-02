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
    <div style={{
      position:'fixed', inset:0, zIndex:100,
      background:'rgba(2,8,23,0.6)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'
    }}>
      <div className="card" style={{ maxWidth:480, width:'100%' }}>
        <div style={{fontSize:20, fontWeight:700, marginBottom:8}}>{title}</div>
        {message && <div style={{color:'var(--muted)', marginBottom:12}}>{message}</div>}
        <div className="row" style={{justifyContent:'flex-end'}}>
          {actions}
          <button className="btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}
