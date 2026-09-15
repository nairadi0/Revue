import respx
from httpx import Response

from app.models import AgentRun, PRFile, PullRequest, Repository
from app.routers import webhooks
from tests.conftest import sign


def post(client, event, payload):
  body, headers = sign(payload)
  return client.post("/webhooks/github", content=body, headers={**headers, "X-GitHub-Event": event})


def test_rejects_bad_signature(client):
  response = client.post(
    "/webhooks/github",
    content=b"{}",
    headers={"X-Hub-Signature-256": "sha256=deadbeef", "X-GitHub-Event": "pull_request", "Content-Type": "application/json"},
  )
  assert response.status_code == 401


def test_ignores_unrelated_events(client):
  assert post(client, "push", {"ref": "refs/heads/main"}).json() == {"status": "ignored"}
  assert post(client, "pull_request", {"action": "closed"}).json() == {"status": "ignored"}


def test_installation_created_links_known_repos(client, db, repo):
  repo.installation_id = None
  db.commit()
  response = post(client, "installation", {"action": "created", "installation": {"id": 777}, "repositories": [{"id": 4242}, {"id": 9999}]})
  assert response.json() == {"status": "linked", "repos": 1}
  db.refresh(repo)
  assert repo.installation_id == 777


def test_installation_deleted_unlinks_repos(client, db, repo):
  response = post(client, "installation", {"action": "deleted", "installation": {"id": 777}})
  assert response.json() == {"status": "unlinked", "repos": 1}
  db.refresh(repo)
  assert repo.installation_id is None


def test_installation_repositories_added_and_removed(client, db, repo):
  removed = post(client, "installation_repositories", {
    "action": "removed", "installation": {"id": 777}, "repositories_added": [], "repositories_removed": [{"id": 4242}],
  })
  assert removed.json() == {"status": "updated", "linked": 0, "unlinked": 1}
  db.refresh(repo)
  assert repo.installation_id is None

  added = post(client, "installation_repositories", {
    "action": "added", "installation": {"id": 777}, "repositories_added": [{"id": 4242}], "repositories_removed": [],
  })
  assert added.json() == {"status": "updated", "linked": 1, "unlinked": 0}
  db.refresh(repo)
  assert repo.installation_id == 777


def opened_payload(repo, number=5, author="collaborator"):
  return {
    "action": "opened",
    "installation": {"id": repo.installation_id},
    "repository": {"id": repo.github_repo_id},
    "pull_request": {"number": number, "title": "Add thing", "user": {"login": author}, "created_at": "2026-09-14T00:00:00Z"},
  }


def mock_github(repo, number=5):
  respx.post(f"https://api.github.com/app/installations/{repo.installation_id}/access_tokens").mock(
    return_value=Response(201, json={"token": "ghs_test", "expires_at": "2099-01-01T00:00:00Z"})
  )
  return respx.get(f"https://api.github.com/repos/{repo.owner}/{repo.name}/pulls/{number}/files").mock(
    return_value=Response(200, json=[
      {"filename": "app/main.py", "additions": 3, "deletions": 1, "status": "modified", "patch": "@@ -1 +1 @@"},
    ])
  )


@respx.mock
def test_pull_request_opened_creates_run_without_a_user(client, db, repo, rsa_key, monkeypatch):
  monkeypatch.setattr(webhooks, "pr_review", lambda *args: None)
  files_route = mock_github(repo)

  response = post(client, "pull_request", opened_payload(repo))

  assert response.json()["status"] == "triggered"
  assert files_route.called
  assert files_route.calls.last.request.headers["Authorization"] == "Bearer ghs_test"

  pr = db.query(PullRequest).filter_by(repo_id=repo.id, pr_number=5).one()
  assert pr.author == "collaborator"
  assert db.query(PRFile).filter_by(pr_id=pr.id).count() == 1
  run = db.query(AgentRun).filter_by(pr_id=pr.id).one()
  assert run.triggered_by_user_id is None


def test_pull_request_opened_ignores_unknown_repo(client, db):
  unknown = Repository(owner="x", name="y", default_branch="main", github_repo_id=1, installation_id=1)
  response = post(client, "pull_request", opened_payload(unknown))
  assert response.json() == {"status": "ignored"}


@respx.mock
def test_pull_request_opened_rate_limits_per_repo(client, db, repo, rsa_key, monkeypatch):
  monkeypatch.setattr(webhooks, "pr_review", lambda *args: None)
  mock_github(repo)
  for number in range(1, 6):
    mock_github(repo, number)
    assert post(client, "pull_request", opened_payload(repo, number)).json()["status"] == "triggered"

  mock_github(repo, 6)
  assert post(client, "pull_request", opened_payload(repo, 6)).json() == {"status": "rate_limited"}
  assert db.query(AgentRun).count() == webhooks.REVIEWS_PER_REPO_PER_DAY
