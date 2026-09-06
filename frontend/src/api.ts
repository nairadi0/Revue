export const API_BASE = 'http://localhost:8000'

// FastAPI's HTTPException puts the real message in the response body's
// `detail` field (e.g. { "detail": "..." }) — the status code alone
// doesn't tell the user anything actionable.
export async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  if (body && typeof body.detail === 'string') {
    return body.detail
  }
  return `${fallback}: ${response.status}`
}
