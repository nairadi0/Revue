import time
import pytest
import respx
from cryptography.hazmat.primitives import serialization
from httpx import Response
from jose import jwt

from app.config import settings
from app.services import github_app


def test_app_jwt_has_expected_claims(rsa_key):
  token = github_app.make_app_jwt()
  public_pem = rsa_key.public_key().public_bytes(
    serialization.Encoding.PEM,
    serialization.PublicFormat.SubjectPublicKeyInfo,
  )
  claims = jwt.decode(token, public_pem, algorithms=["RS256"])
  now = int(time.time())
  assert claims["iss"] == settings.github_app_id
  assert claims["iat"] <= now - 30
  assert 0 < claims["exp"] - now <= 600


@pytest.mark.anyio
@respx.mock
async def test_installation_token_is_cached_until_near_expiry(rsa_key):
  route = respx.post("https://api.github.com/app/installations/777/access_tokens").mock(
    return_value=Response(201, json={"token": "ghs_first", "expires_at": "2099-01-01T00:00:00Z"})
  )
  assert await github_app.get_installation_token(777) == "ghs_first"
  assert await github_app.get_installation_token(777) == "ghs_first"
  assert route.call_count == 1

  github_app._installation_tokens[777] = ("ghs_stale", time.time() + 60)
  route.mock(return_value=Response(201, json={"token": "ghs_second", "expires_at": "2099-01-01T00:00:00Z"}))
  assert await github_app.get_installation_token(777) == "ghs_second"
  assert route.call_count == 2


@pytest.mark.anyio
@respx.mock
async def test_installation_token_failure_raises(rsa_key):
  respx.post("https://api.github.com/app/installations/1/access_tokens").mock(return_value=Response(404, json={"message": "Not Found"}))
  with pytest.raises(github_app.GitHubAppError):
    await github_app.get_installation_token(1)


@pytest.mark.anyio
@respx.mock
async def test_find_repo_installation(rsa_key):
  respx.get("https://api.github.com/repos/acme/widgets/installation").mock(return_value=Response(200, json={"id": 777}))
  respx.get("https://api.github.com/repos/acme/nothing/installation").mock(return_value=Response(404, json={}))
  assert await github_app.find_repo_installation("acme", "widgets") == 777
  assert await github_app.find_repo_installation("acme", "nothing") is None


@pytest.mark.anyio
async def test_repo_headers_requires_installation():
  class Bare:
    owner, name, installation_id = "acme", "widgets", None

  with pytest.raises(github_app.AppNotInstalled):
    await github_app.repo_headers(Bare())
