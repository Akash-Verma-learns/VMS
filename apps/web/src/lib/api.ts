// Typed API client: token storage, auth header, and a mock toggle so the
// whole frontend runs without a live backend (VITE_USE_MOCKS, default on).

import { handleMock } from '../mocks/server'

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS as string | undefined) !== 'false'

const TOKEN_KEY = 'vms_token'
const USER_KEY = 'vms_user'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

// ---- token persistence ----
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}
export function getStoredUserRaw(): string | null {
  return localStorage.getItem(USER_KEY)
}
export function setStoredUserRaw(json: string | null): void {
  if (json) localStorage.setItem(USER_KEY, json)
  else localStorage.removeItem(USER_KEY)
}

export interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  // skip attaching the auth header (e.g. login endpoints)
  auth?: boolean
}

export async function apiFetch<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET'
  const token = opts.auth === false ? null : getToken()

  if (USE_MOCKS) {
    const res = await handleMock(method, path, opts.body, token)
    if (res.status >= 400) throw new ApiError(res.status, errorMessage(res.data))
    return res.data as T
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, errorMessage(data))
  return data as T
}

function errorMessage(data: unknown): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const msg = (data as { error?: unknown }).error
    if (typeof msg === 'string') return msg
  }
  return 'Request failed'
}

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path),
  post: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body }),
  patch: <T = unknown>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  put: <T = unknown>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body }),
  del: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}

export const usingMocks = USE_MOCKS
