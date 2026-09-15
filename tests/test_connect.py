import respx
from httpx import Response

from app.models import Repository, UserRepository
from app.routers import repos


def mock_repo_lookup(owner="acme", name="widgets", repo_id=4242):
  respx.get(f"https://api.github.com/repos/{owner}/{name}").mock(
    return_value=Response(200, json={"id": repo_id, "name": name, "default_branch": "main", "owner": {"login": owner}})
  )


@respx.mock
def test_connect_returns_409_with_install_url_when_not_installed(authed_client, db, rsa_key, monkeypatch):
  monkeypatch.setattr(repos, "get_valid_access_token", lambda *args: _noop())
  mock_repo_lookup()
  respx.get("https://api.github.com/repos/acme/widgets/installation").mock(return_value=Response(404, json={}))

  response = authed_client.post("/repos/connect", json={"owner": "acme", "name": "widgets"})

  assert response.status_code == 409
  body = response.json()
  assert body["code"] == "app_not_installed"
  assert body["install_url"].startswith("https://github.com/apps/")
  assert db.query(Repository).count() == 0


@respx.mock
def test_connect_stores_installation_id_and_links_user(authed_client, db, user, rsa_key, monkeypatch):
  monkeypatch.setattr(repos, "get_valid_access_token", lambda *args: _noop())
  mock_repo_lookup()
  respx.get("https://api.github.com/repos/acme/widgets/installation").mock(return_value=Response(200, json={"id": 777}))

  response = authed_client.post("/repos/connect", json={"owner": "acme", "name": "widgets"})

  assert response.status_code == 200
  assert response.json()["installation_id"] == 777
  repo = db.query(Repository).filter_by(github_repo_id=4242).one()
  assert repo.installation_id == 777
  assert db.query(UserRepository).filter_by(user_id=user.id, repo_id=repo.id).count() == 1


@respx.mock
def test_connect_relinks_existing_repo(authed_client, db, repo, user, rsa_key, monkeypatch):
  monkeypatch.setattr(repos, "get_valid_access_token", lambda *args: _noop())
  repo.installation_id = None
  db.commit()
  mock_repo_lookup()
  respx.get("https://api.github.com/repos/acme/widgets/installation").mock(return_value=Response(200, json={"id": 888}))

  response = authed_client.post("/repos/connect", json={"owner": "acme", "name": "widgets"})

  assert response.status_code == 200
  db.refresh(repo)
  assert repo.installation_id == 888
  assert db.query(Repository).count() == 1


def test_pr_list_returns_409_for_unlinked_repo(authed_client, db, repo, user):
  repo.installation_id = None
  db.add(UserRepository(user_id=user.id, repo_id=repo.id))
  db.commit()

  response = authed_client.get(f"/repos/{repo.id}/prs")

  assert response.status_code == 409
  assert response.json()["code"] == "app_not_installed"


async def _noop():
  return None
