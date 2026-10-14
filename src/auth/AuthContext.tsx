import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getToken, readStoredUser, setToken, writeStoredUser } from '../api/client'
import type { SessionUser } from '../api/types'
import { signInToFirebase } from '../lib/firebase'
import { prepareChatTransport, resetChatTransport } from '../chat/transport'
import { resetFavourites } from '../lib/favourites'

type AuthContextValue = {
  user: SessionUser | null
  ready: boolean
  login: (user: SessionUser, token: string) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  ensureRealtime: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function connectRealtime(userId: string) {
  try {
    const result = await api<{ token: string }>('/user/firebase/createcustomtoken', {
      method: 'POST',
      body: { userId },
    })
    await signInToFirebase(result.token)
    prepareChatTransport('firestore')
  } catch {
    prepareChatTransport('rest')
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => readStoredUser<SessionUser>())
  const [ready, setReady] = useState(false)

  const login = useCallback(async (next: SessionUser, token: string) => {
    setToken(token)
    writeStoredUser(next)
    setUser(next)
    if (next.isOnboarded) void connectRealtime(next.id)
    else prepareChatTransport('rest')
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/user/auth/logout', { method: 'POST', body: {} })
    } catch {
      /* local session still clears */
    }
    setToken(null)
    writeStoredUser(null)
    setUser(null)
    resetChatTransport()
    resetFavourites()
  }, [])

  const refreshProfile = useCallback(async () => {
    const profile = await api<{ user: SessionUser }>('/user/profile')
    const merged = { ...readStoredUser<SessionUser>(), ...profile.user }
    writeStoredUser(merged)
    setUser(merged)
  }, [])

  const ensureRealtime = useCallback(async () => {
    const current = readStoredUser<SessionUser>()
    if (current?.id && current.isOnboarded) await connectRealtime(current.id)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      const token = getToken()
      if (!token) {
        setReady(true)
        return
      }
      try {
        const refreshed = await api<{ token?: string; user?: Partial<SessionUser> }>('/auth/token/refresh', {
          method: 'POST',
        })
        if (refreshed.token) setToken(refreshed.token)
        const stored = readStoredUser<SessionUser>()
        const merged = { ...stored, ...refreshed.user } as SessionUser
        if (merged?.id) {
          writeStoredUser(merged)
          if (!cancelled) setUser(merged)
          // Don't hold the first render on Firebase; chat waits on the transport.
          if (merged.isOnboarded) void connectRealtime(merged.id)
          else prepareChatTransport('rest')
        }
      } catch {
        setToken(null)
        writeStoredUser(null)
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, logout, refreshProfile, ensureRealtime }),
    [user, ready, login, logout, refreshProfile, ensureRealtime],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
