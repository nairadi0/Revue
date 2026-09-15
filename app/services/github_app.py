import time
from datetime import datetime
import httpx
from jose import jwt
from ..config import settings


GITHUB_API = "https://api.github.com"
JWT_LIFETIME_SECONDS = 540
CLOCK_SKEW_SECONDS = 60
TOKEN_REFRESH_MARGIN_SECONDS = 300

_installation_tokens: dict[int, tuple[str, float]] = {}


class GitHubAppError(Exception):
  pass


def make_app_jwt() -> str:
  now = int(time.time())
  claims = {
    "iat": now - CLOCK_SKEW_SECONDS,
    "exp": now + JWT_LIFETIME_SECONDS,
    "iss": settings.github_app_id,
  }
  return jwt.encode(claims, settings.github_app_private_key_pem, algorithm="RS256")


def app_headers() -> dict[str, str]:
  return {"Authorization": f"Bearer {make_app_jwt()}", "Accept": "application/vnd.github+json"}


def installation_headers(token: str) -> dict[str, str]:
  return {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}


async def get_installation_token(installation_id: int) -> str:
  cached = _installation_tokens.get(installation_id)
  if cached and cached[1] - time.time() > TOKEN_REFRESH_MARGIN_SECONDS:
    return cached[0]

  async with httpx.AsyncClient() as client:
    response = await client.post(
      f"{GITHUB_API}/app/installations/{installation_id}/access_tokens",
      headers=app_headers(),
    )
  if response.status_code != 201:
    raise GitHubAppError(f"Failed to mint installation token ({response.status_code}): {response.text}")

  body = response.json()
  expires_at = datetime.fromisoformat(body["expires_at"]).timestamp()
  _installation_tokens[installation_id] = (body["token"], expires_at)
  return body["token"]


async def find_repo_installation(owner: str, name: str) -> int | None:
  async with httpx.AsyncClient() as client:
    response = await client.get(f"{GITHUB_API}/repos/{owner}/{name}/installation", headers=app_headers())
  if response.status_code == 404:
    return None
  if response.status_code != 200:
    raise GitHubAppError(f"Failed to look up installation for {owner}/{name} ({response.status_code}): {response.text}")
  return response.json()["id"]


class AppNotInstalled(GitHubAppError):
  def __init__(self, owner: str, name: str):
    self.owner = owner
    self.name = name
    super().__init__(f"Revue is not installed on {owner}/{name}")


async def repo_headers(repo) -> dict[str, str]:
  if repo.installation_id is None:
    raise AppNotInstalled(repo.owner, repo.name)
  return installation_headers(await get_installation_token(repo.installation_id))


def install_url() -> str:
  return f"https://github.com/apps/{settings.github_app_slug}/installations/new"
