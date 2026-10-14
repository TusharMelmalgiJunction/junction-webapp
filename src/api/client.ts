const TOKEN_KEY = 'junction.token'
const USER_KEY = 'junction.user'

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function apiBase() {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function readStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeStoredUser(user: unknown | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

type RequestOptions = {
  method?: string
  body?: unknown
  form?: FormData
  auth?: boolean
  query?: Record<string, string | number | boolean | undefined | null>
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // Join rather than resolve, so the base can carry a path prefix (the dev proxy uses /prod-api).
  const url = new URL(`${apiBase().replace(/\/+$/, '')}${path}`, window.location.origin)
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const headers = new Headers()
  if (options.auth !== false) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  let body: BodyInit | undefined
  if (options.form) {
    body = options.form
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  const response = await fetch(url, { method: options.method || 'GET', headers, body })
  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }
  if (!response.ok) {
    const record = (data || {}) as { error?: string; message?: string; code?: string }
    throw new ApiError(record.error || record.message || `Request failed (${response.status})`, response.status, record.code)
  }
  return data as T
}
