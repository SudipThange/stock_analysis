import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../api/config'

type AuthContextType = {
  access: string | null
  refresh: string | null
  isAuthenticated: boolean
  authReady: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  access: null,
  refresh: null,
  isAuthenticated: false,
  authReady: false,
  login: async () => false,
  register: async () => false,
  logout: () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<string | null>(null)
  const [refresh, setRefresh] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const getJwtExpiryMs = (token: string): number | null => {
    try {
      const parts = token.split('.')
      if (parts.length < 2) return null
      const base64Url = parts[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(window.atob(base64))
      if (!payload?.exp || typeof payload.exp !== 'number') return null
      return payload.exp * 1000
    } catch {
      return null
    }
  }

  const isTokenValid = (token: string): boolean => {
    const expMs = getJwtExpiryMs(token)
    if (!expMs) return false
    return expMs > Date.now()
  }

  const logout = () => {
    setAccess(null)
    setRefresh(null)
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
  }

  const refreshAccessToken = async (refreshTokenArg?: string | null) => {
    const refreshToken = refreshTokenArg || localStorage.getItem('refresh')
    if (!refreshToken) return false

    try {
      const res = await fetch(apiUrl('/user/token/refresh/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken })
      })

      if (!res.ok) return false

      const data = await res.json()
      if (!data?.access || !isTokenValid(data.access)) return false

      setAccess(data.access)
      localStorage.setItem('access', data.access)

      if (data.refresh) {
        setRefresh(data.refresh)
        localStorage.setItem('refresh', data.refresh)
      }

      return true
    } catch {
      return false
    }
  }

  const loadFromStorage = () => {
    const a = localStorage.getItem('access')
    const r = localStorage.getItem('refresh')
    if (a && isTokenValid(a)) {
      setAccess(a)
      setRefresh(r)
      return true
    }
    if (r) {
      setRefresh(r)
      return false
    }
    logout()
    return false
  }

  useEffect(() => {
    const initAuth = async () => {
      const loaded = loadFromStorage()
      if (!loaded) {
        const restored = await refreshAccessToken(localStorage.getItem('refresh'))
        if (!restored) {
          logout()
        }
      }
      setAuthReady(true)
    }

    initAuth()
  }, [])

  useEffect(() => {
    if (!access) return
    const expMs = getJwtExpiryMs(access)
    if (!expMs) {
      logout()
      return
    }
    const msRemaining = expMs - Date.now()
    const refreshLeadMs = 60 * 1000
    const msUntilRefresh = Math.max(0, msRemaining - refreshLeadMs)

    const timer = window.setTimeout(async () => {
      const refreshed = await refreshAccessToken(localStorage.getItem('refresh'))
      if (!refreshed) logout()
    }, msUntilRefresh)

    return () => window.clearTimeout(timer)
  }, [access])

  useEffect(() => {
    const revalidateAuth = async () => {
      const token = localStorage.getItem('access')
      if (!token || !isTokenValid(token)) {
        const refreshed = await refreshAccessToken(localStorage.getItem('refresh'))
        if (!refreshed) logout()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void revalidateAuth()
      }
    }

    const onUnauthorized = () => logout()

    const onFocus = () => {
      void revalidateAuth()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('auth:unauthorized', onUnauthorized)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('auth:unauthorized', onUnauthorized)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await fetch(apiUrl('/user/login/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) return false
    const data = await res.json()
    if (!data.access || !isTokenValid(data.access)) return false
    setAccess(data.access)
    setRefresh(data.refresh)
    localStorage.setItem('access', data.access)
    localStorage.setItem('refresh', data.refresh)
    setAuthReady(true)
    return true
  }

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch(apiUrl('/user/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    })
    if (!res.ok) return false
    // Registration should only create account; login must be performed explicitly.
    await res.json().catch(() => ({}))
    return true
  }

  const isAuthenticated = !!access && isTokenValid(access)
  const value = useMemo(() => ({ access, refresh, isAuthenticated, authReady, login, register, logout }), [access, refresh, isAuthenticated, authReady])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
