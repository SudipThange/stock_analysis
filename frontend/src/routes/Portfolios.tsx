import { useEffect, useState } from 'react'
import Popup from '../components/Popup'
import { useAuth } from '../context/AuthContext'
import { apiGet, apiJson } from '../api/client'

type Portfolio = { id: number; title: string; desc: string }

export default function Portfolios() {
  const { access } = useAuth()
  const [items, setItems] = useState<Portfolio[]>([])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [editing, setEditing] = useState<Portfolio | null>(null)
  const [showSuccess, setShowSuccess] = useState<{open:boolean; text:string}>({open:false, text:''})

  const load = async () => {
    const data = await apiGet('/portfolio/', access || undefined)
    setItems(data)
  }

  useEffect(() => {
    if (access) load()
  }, [access])

  const submit = async () => {
    if (!title || !desc) return
    await apiJson('/portfolio/', 'POST', { title, desc }, access || undefined)
    setTitle(''); setDesc('')
    setShowSuccess({ open:true, text:`Portfolio “${title}” created successfully.` })
    await load()
  }

  const saveEdit = async () => {
    if (!editing) return
    await apiJson(`/portfolio/${editing.id}/`, 'PUT', { title: editing.title, desc: editing.desc }, access || undefined)
    setEditing(null)
    await load()
  }

  const del = async (id: number) => {
    await apiJson(`/portfolio/${id}/`, 'DELETE', {}, access || undefined)
    await load()
  }

  return (
    <div className="container" style={{padding:'24px 0'}}>
      <div className="grid" style={{gridTemplateColumns:'1fr 2fr'}}>
        <div className="card">
          <div style={{fontWeight:700, marginBottom:8}}>Create Portfolio</div>
          <div className="grid">
            <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
            <textarea className="textarea" placeholder="Description" value={desc} onChange={e=>setDesc(e.target.value)} />
            <button className="btn" onClick={submit}>Create</button>
          </div>
        </div>
        <div className="card">
          <div style={{fontWeight:700, marginBottom:8}}>Portfolios</div>
          <table className="table">
            <thead><tr><th>Title</th><th>Description</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id}>
                  <td>
                    {editing?.id===p.id ? (
                      <input className="input" value={editing.title} onChange={e=>setEditing({...editing, title:e.target.value})} />
                    ) : p.title}
                  </td>
                  <td>
                    {editing?.id===p.id ? (
                      <input className="input" value={editing.desc} onChange={e=>setEditing({...editing, desc:e.target.value})} />
                    ) : p.desc}
                  </td>
                  <td className="row">
                    {editing?.id===p.id ? (
                      <>
                        <button className="btn" onClick={saveEdit}>Save</button>
                        <button className="btn secondary" onClick={()=>setEditing(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn" onClick={()=>setEditing(p)}>Edit</button>
                        <button className="btn secondary" onClick={()=>del(p.id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Popup
        open={showSuccess.open}
        title="Portfolio Created"
        message={showSuccess.text}
        onClose={()=>setShowSuccess({open:false, text:''})}
      />
    </div>
  )
}
