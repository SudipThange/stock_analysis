import { useAuth } from '../context/AuthContext'

export async function apiGet(path: string, token?: string) {
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `request failed (${res.status})`)
  }
  return res.json()
}

export async function apiJson(path: string, method: 'POST'|'PUT'|'PATCH'|'DELETE', body: any, token?: string) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `request failed (${res.status})`)
  }
  return res.json().catch(() => ({}))
}
