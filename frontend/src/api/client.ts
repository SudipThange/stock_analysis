import { useAuth } from '../context/AuthContext'

export async function apiGet(path: string, token?: string, init?: RequestInit) {
  const headers = {
    ...(init?.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: Object.keys(headers).length ? headers : undefined
  })
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }
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
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }
    const text = await res.text().catch(() => '')
    throw new Error(text || `request failed (${res.status})`)
  }
  return res.json().catch(() => ({}))
}
