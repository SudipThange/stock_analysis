import { apiUrl } from './config'

let refreshInFlight: Promise<string | null> | null = null

function getStoredAccessToken(): string | undefined {
  return typeof window !== 'undefined' ? localStorage.getItem('access') || undefined : undefined
}

function getStoredRefreshToken(): string | undefined {
  return typeof window !== 'undefined' ? localStorage.getItem('refresh') || undefined : undefined
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const refresh = getStoredRefreshToken()
    if (!refresh) return null

    try {
      const res = await fetch(apiUrl('/user/token/refresh/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })

      if (!res.ok) return null

      const data = await res.json().catch(() => ({} as any))
      if (!data?.access) return null

      localStorage.setItem('access', data.access)
      if (data.refresh) {
        localStorage.setItem('refresh', data.refresh)
      }

      return String(data.access)
    } catch {
      return null
    }
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

export async function apiGet(path: string, token?: string, init?: RequestInit) {
  const buildHeaders = (authToken?: string) => {
    const headers = {
      ...(init?.headers as Record<string, string> | undefined),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    }
    return Object.keys(headers).length ? headers : undefined
  }

  let authToken = token || getStoredAccessToken()
  let res = await fetch(apiUrl(path), {
    ...init,
    headers: buildHeaders(authToken)
  })

  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      authToken = refreshed
      res = await fetch(apiUrl(path), {
        ...init,
        headers: buildHeaders(authToken)
      })
    }
  }

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
  const buildHeaders = (authToken?: string) => ({
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
  })

  let authToken = token || getStoredAccessToken()
  let res = await fetch(apiUrl(path), {
    method,
    headers: buildHeaders(authToken),
    body: JSON.stringify(body)
  })

  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      authToken = refreshed
      res = await fetch(apiUrl(path), {
        method,
        headers: buildHeaders(authToken),
        body: JSON.stringify(body)
      })
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }
    const text = await res.text().catch(() => '')
    throw new Error(text || `request failed (${res.status})`)
  }
  return res.json().catch(() => ({}))
}
