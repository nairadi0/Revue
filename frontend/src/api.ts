export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

interface ErrorBody {
  detail?: unknown
  code?: unknown
  install_url?: unknown
}

async function readErrorBody(response: Response): Promise<ErrorBody | null> {
  return response.json().catch(() => null)
}

function messageFrom(body: ErrorBody | null, status: number, fallback: string): string {
  return body && typeof body.detail === 'string' ? body.detail : `${fallback}: ${status}`
}

export async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  return messageFrom(await readErrorBody(response), response.status, fallback)
}

export class ApiError extends Error {
  status: number
  code: string | null
  installUrl: string | null

  constructor(status: number, message: string, body: ErrorBody | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = body && typeof body.code === 'string' ? body.code : null
    this.installUrl = body && typeof body.install_url === 'string' ? body.install_url : null
  }

  get appNotInstalled(): boolean {
    return this.code === 'app_not_installed'
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, fallback = 'Request failed'): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' })
  if (!response.ok) {
    const body = await readErrorBody(response)
    throw new ApiError(response.status, messageFrom(body, response.status, fallback), body)
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
