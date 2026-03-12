import { useEffect, useState } from 'react'
import { Plus, Edit2, Save, X, Trash2 } from 'lucide-react'
import TopSuccessPopup from '../components/TopSuccessPopup'
import { useAuth } from '../context/AuthContext'
import { apiGet, apiJson } from '../api/client'

type Portfolio = { id: number; title: string; desc: string }

export default function Portfolios() {
  const { access } = useAuth()
  const [items, setItems] = useState<Portfolio[]>([])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [editing, setEditing] = useState<Portfolio | null>(null)
  const [showSuccess, setShowSuccess] = useState<{ open: boolean; text: string }>({ open: false, text: '' })

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
    setTitle('')
    setDesc('')
    setShowSuccess({ open: true, text: `Portfolio "${title}" created successfully.` })
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
    <div className="container page">
      <TopSuccessPopup
        open={showSuccess.open}
        title="Portfolio Added"
        message={showSuccess.text}
        onDone={() => setShowSuccess({ open: false, text: '' })}
      />

      <div className="grid split-layout">
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Create Portfolio</div>
          <div className="grid">
            <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
            <textarea className="textarea" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
            <button className="btn" onClick={submit}>
              <Plus size={16} style={{ marginRight: 6 }} />
              Create
            </button>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Portfolios</div>
          <div className="portfolio-list">
            {items.map(p => (
              <div key={p.id} className="portfolio-item">
                <div className="portfolio-main">
                  <div className="portfolio-title">
                    {editing?.id === p.id ? (
                      <input className="input" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
                    ) : p.title}
                  </div>
                  <div className="portfolio-desc">
                    {editing?.id === p.id ? (
                      <input className="input" value={editing.desc} onChange={e => setEditing({ ...editing, desc: e.target.value })} />
                    ) : p.desc}
                  </div>
                </div>
                <div className="portfolio-actions row">
                  {editing?.id === p.id ? (
                    <>
                      <button className="btn" onClick={saveEdit}>
                        <Save size={16} style={{ marginRight: 6 }} /> Save
                      </button>
                      <button className="btn secondary" onClick={() => setEditing(null)}>
                        <X size={16} style={{ marginRight: 6 }} /> Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn" onClick={() => setEditing(p)}>
                        <Edit2 size={16} style={{ marginRight: 6 }} /> Edit
                      </button>
                      <button className="btn secondary" onClick={() => del(p.id)}>
                        <Trash2 size={16} style={{ marginRight: 6 }} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
