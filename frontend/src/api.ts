export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

export async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  if (body && typeof body.detail === 'string') {
    return body.detail
  }
  return `${fallback}: ${response.status}`
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, fallback = 'Request failed'): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' })
  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response, fallback))
  }
  return response.json() as Promise<T>
}

export function apiPost<T>(path: string, body?: unknown, fallback = 'Request failed'): Promise<T> {
  return apiFetch<T>(
    path,
    body === undefined
      ? { method: 'POST' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    fallback,
  )
}
