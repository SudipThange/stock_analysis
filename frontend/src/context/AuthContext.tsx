import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type AuthContextType = {
  access: string | null
  refresh: string | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  access: null,
  refresh: null,
  login: async () => false,
  logout: () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<string | null>(null)
  const [refresh, setRefresh] = useState<string | null>(null)

  useEffect(() => {
    const a = localStorage.getItem('access')
    const r = localStorage.getItem('refresh')
    if (a) setAccess(a)
    if (r) setRefresh(r)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/user/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) return false
    const data = await res.json()
    setAccess(data.access)
    setRefresh(data.refresh)
    localStorage.setItem('access', data.access)
    localStorage.setItem('refresh', data.refresh)
    return true
  }

  const logout = () => {
    setAccess(null)
    setRefresh(null)
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
  }

  const value = useMemo(() => ({ access, refresh, login, logout }), [access, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
