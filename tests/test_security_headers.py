import pytest

from app.security_headers import SECURITY_HEADERS


@pytest.mark.parametrize("header,value", sorted(SECURITY_HEADERS.items()))
def test_response_carries_security_header(client, header, value):
  response = client.get("/openapi.json")
  assert response.headers[header] == value


def test_headers_present_on_error_responses(client):
  response = client.get("/no-such-route")
  assert response.status_code == 404
  assert response.headers["X-Content-Type-Options"] == "nosniff"
  assert response.headers["X-Frame-Options"] == "DENY"
