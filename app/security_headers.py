from starlette.middleware.base import BaseHTTPMiddleware


SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
  async def dispatch(self, request, call_next):
    response = await call_next(request)
    for header, value in SECURITY_HEADERS.items():
      response.headers.setdefault(header, value)
    return response
