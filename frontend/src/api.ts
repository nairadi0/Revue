export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

export async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  if (body && typeof body.detail === 'string') {
    return body.detail
  }
  return `${fallback}: ${response.status}`
}
