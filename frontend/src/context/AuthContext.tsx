import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type AuthContextType = {
  access: string | null
  refresh: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  access: null,
  refresh: null,
  isAuthenticated: false,
  login: async () => false,
  logout: () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<string | null>(null)
  const [refresh, setRefresh] = useState<string | null>(null)

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

  const loadFromStorage = () => {
    const a = localStorage.getItem('access')
    const r = localStorage.getItem('refresh')
    if (a && isTokenValid(a)) {
      setAccess(a)
      setRefresh(r)
      return true
    }
    logout()
    return false
  }

  useEffect(() => {
    loadFromStorage()
  }, [])

  useEffect(() => {
    if (!access) return
    const expMs = getJwtExpiryMs(access)
    if (!expMs) {
      logout()
      return
    }
    const msRemaining = expMs - Date.now()
    if (msRemaining <= 0) {
      logout()
      return
    }
    const timer = window.setTimeout(() => logout(), msRemaining)
    return () => window.clearTimeout(timer)
  }, [access])

  useEffect(() => {
    const revalidateAuth = () => {
      const token = localStorage.getItem('access')
      if (!token || !isTokenValid(token)) {
        logout()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateAuth()
      }
    }

    const onUnauthorized = () => logout()

    window.addEventListener('focus', revalidateAuth)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('auth:unauthorized', onUnauthorized)

    return () => {
      window.removeEventListener('focus', revalidateAuth)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('auth:unauthorized', onUnauthorized)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/user/login/', {
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
    return true
  }

  const isAuthenticated = !!access && isTokenValid(access)
  const value = useMemo(() => ({ access, refresh, isAuthenticated, login, logout }), [access, refresh, isAuthenticated])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
