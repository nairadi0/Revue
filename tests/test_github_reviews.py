from datetime import datetime, timezone
import pytest
import respx
from httpx import Response
from sqlalchemy import BigInteger, inspect

from app.models import AgentRun, AgentStatus, Category, PRFile, PullRequest, ReviewFinding, Severity, UserRepository
from app.routers.pull_requests import publish_review
from app.services.github_reviews import build_review, diff_lines, post_review, ReviewPostError


SINGLE_HUNK = """@@ -10,4 +10,5 @@ def f():
 a = 1
-b = 2
+b = 3
+c = 4
 d = 5"""

MULTI_HUNK = """@@ -1,3 +1,3 @@
-x
+y
 z
 w
@@ -40,2 +40,3 @@
 p
+q
 r"""

ADDED_FILE = """@@ -0,0 +1,3 @@
+line one
+line two
+line three"""

RENAMED_NO_CHANGES = ""


def test_diff_lines_single_hunk():
  assert diff_lines(SINGLE_HUNK) == {10, 11, 12, 13}


def test_diff_lines_multi_hunk():
  assert diff_lines(MULTI_HUNK) == {1, 2, 3, 40, 41, 42}


def test_diff_lines_added_file():
  assert diff_lines(ADDED_FILE) == {1, 2, 3}


def test_diff_lines_renamed_without_patch():
  assert diff_lines(RENAMED_NO_CHANGES) == set()


def test_diff_lines_ignores_no_newline_marker():
  patch = "@@ -1 +1 @@\n-a\n+b\n\\ No newline at end of file"
  assert diff_lines(patch) == {1}


@pytest.fixture
def pr(db, repo):
  row = PullRequest(repo_id=repo.id, pr_number=7, title="Fix", author="dev", status="OPEN", opened_at=datetime.now(timezone.utc))
  db.add(row)
  db.commit()
  return row


@pytest.fixture
def run(db, pr):
  row = AgentRun(pr_id=pr.id, status=AgentStatus.SUCCESS, started_at=datetime.now(timezone.utc))
  db.add(row)
  db.commit()
  return row


@pytest.fixture
def pr_file(db, pr):
  row = PRFile(pr_id=pr.id, file_path="app/main.py", additions=2, deletions=1, patch_text=SINGLE_HUNK)
  db.add(row)
  db.commit()
  return row


def make_finding(db, pr, pr_file, run, line, severity=Severity.MEDIUM):
  row = ReviewFinding(
    pr_id=pr.id, file_id=pr_file.id, agent_run_id=run.id, line_number=line,
    severity=severity, category=Category.BUG, finding_text="Something is off", suggestion="Fix it",
  )
  db.add(row)
  db.commit()
  return row


def test_build_review_returns_none_without_findings(run, pr_file):
  assert build_review(run, [], [pr_file]) is None


def test_build_review_splits_anchorable_and_unanchorable(db, pr, pr_file, run):
  inline = make_finding(db, pr, pr_file, run, 12, Severity.HIGH)
  outside = make_finding(db, pr, pr_file, run, 99, Severity.LOW)

  payload = build_review(run, [inline, outside], [pr_file])

  assert payload["event"] == "COMMENT"
  assert payload["comments"] == [{
    "path": "app/main.py", "line": 12, "side": "RIGHT",
    "body": "**HIGH · BUG**\n\nSomething is off\n\n**Suggestion:** Fix it",
  }]
  assert "Revue reviewed 1 file and found 2 issues — 1 high, 1 low." in payload["body"]
  assert "`app/main.py:99`" in payload["body"]
  assert f"/runs/{run.id}" in payload["body"]


def reviews_route(repo, pr, status=200, body=None):
  respx.post(f"https://api.github.com/app/installations/{repo.installation_id}/access_tokens").mock(
    return_value=Response(201, json={"token": "ghs_test", "expires_at": "2099-01-01T00:00:00Z"})
  )
  return respx.post(f"https://api.github.com/repos/{repo.owner}/{repo.name}/pulls/{pr.pr_number}/reviews").mock(
    return_value=Response(status, json=body if body is not None else {"id": 555})
  )


@respx.mock
@pytest.mark.anyio
async def test_post_review_returns_review_id(repo, pr, rsa_key):
  route = reviews_route(repo, pr)
  review_id = await post_review(repo, pr, {"event": "COMMENT", "body": "hi", "comments": []})
  assert review_id == 555
  assert route.calls.last.request.headers["Authorization"] == "Bearer ghs_test"


@respx.mock
@pytest.mark.anyio
async def test_post_review_raises_on_422(repo, pr, rsa_key):
  reviews_route(repo, pr, status=422, body={"message": "line must be part of the diff"})
  with pytest.raises(ReviewPostError, match="422"):
    await post_review(repo, pr, {"event": "COMMENT", "body": "hi", "comments": []})


@respx.mock
@pytest.mark.anyio
async def test_publish_review_stores_id_and_is_idempotent(db, repo, pr, pr_file, run, rsa_key):
  repo.post_reviews = True
  db.commit()
  make_finding(db, pr, pr_file, run, 12)
  route = reviews_route(repo, pr)

  first = await publish_review(run, repo, pr, [pr_file], db)
  assert first == {"step": "post_review", "review_id": 555, "comments": 1}
  assert run.github_review_id == 555

  second = await publish_review(run, repo, pr, [pr_file], db)
  assert second["skipped"] == "already posted"
  assert route.call_count == 1


@respx.mock
@pytest.mark.anyio
async def test_publish_review_logs_github_error_without_raising(db, repo, pr, pr_file, run, rsa_key):
  repo.post_reviews = True
  db.commit()
  make_finding(db, pr, pr_file, run, 12)
  reviews_route(repo, pr, status=422, body={"message": "line must be part of the diff"})

  entry = await publish_review(run, repo, pr, [pr_file], db)

  assert entry["step"] == "post_review"
  assert "422" in entry["error"]
  assert run.github_review_id is None


@pytest.mark.anyio
async def test_publish_review_skips_when_repo_opted_out(db, repo, pr, pr_file, run):
  make_finding(db, pr, pr_file, run, 12)
  entry = await publish_review(run, repo, pr, [pr_file], db)
  assert entry["skipped"].startswith("posting to GitHub is off")


@pytest.mark.anyio
async def test_publish_review_skips_with_no_findings(db, repo, pr, pr_file, run):
  repo.post_reviews = True
  db.commit()
  entry = await publish_review(run, repo, pr, [pr_file], db)
  assert entry == {"step": "post_review", "skipped": "no findings"}


def test_findings_endpoint_returns_latest_run_only(authed_client, db, user, repo, pr, pr_file):
  db.add(UserRepository(user_id=user.id, repo_id=repo.id))
  older = AgentRun(pr_id=pr.id, status=AgentStatus.SUCCESS, started_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
  newer = AgentRun(pr_id=pr.id, status=AgentStatus.SUCCESS, started_at=datetime(2026, 2, 1, tzinfo=timezone.utc))
  failed = AgentRun(pr_id=pr.id, status=AgentStatus.FAILED, started_at=datetime(2026, 3, 1, tzinfo=timezone.utc))
  db.add_all([older, newer, failed])
  db.commit()
  make_finding(db, pr, pr_file, older, 10)
  latest = make_finding(db, pr, pr_file, newer, 11)

  response = authed_client.get(f"/repos/{repo.id}/prs/{pr.pr_number}/findings")

  assert response.status_code == 200
  assert [f["id"] for f in response.json()] == [latest.id]


def test_findings_endpoint_falls_back_to_legacy_rows(authed_client, db, user, repo, pr, pr_file):
  db.add(UserRepository(user_id=user.id, repo_id=repo.id))
  legacy = ReviewFinding(
    pr_id=pr.id, file_id=pr_file.id, agent_run_id=None, line_number=3,
    severity=Severity.LOW, category=Category.STYLE, finding_text="old", suggestion="",
  )
  db.add(legacy)
  db.commit()

  response = authed_client.get(f"/repos/{repo.id}/prs/{pr.pr_number}/findings")

  assert [f["id"] for f in response.json()] == [legacy.id]


def test_run_detail_includes_github_review_link(authed_client, db, user, repo, pr, run):
  db.add(UserRepository(user_id=user.id, repo_id=repo.id))
  run.github_review_id = 555
  db.commit()

  body = authed_client.get(f"/agent_runs/{run.id}").json()

  assert body["github_review_id"] == 555
  assert body["github_review_url"] == "https://github.com/acme/widgets/pull/7#pullrequestreview-555"
  assert body["owner"] == "acme" and body["name"] == "widgets"


def test_latest_review_endpoint(authed_client, db, user, repo, pr, run):
  db.add(UserRepository(user_id=user.id, repo_id=repo.id))
  db.commit()
  assert authed_client.get(f"/repos/{repo.id}/prs/{pr.pr_number}/latest-review").json() == {"run_id": run.id, "github_review_url": None}

  run.github_review_id = 555
  db.commit()
  body = authed_client.get(f"/repos/{repo.id}/prs/{pr.pr_number}/latest-review").json()
  assert body["github_review_url"].endswith("#pullrequestreview-555")


def test_repo_settings_toggle(authed_client, db, user, repo):
  db.add(UserRepository(user_id=user.id, repo_id=repo.id))
  db.commit()

  response = authed_client.patch(f"/repos/{repo.id}/settings", json={"post_reviews": True})

  assert response.json() == {"id": repo.id, "post_reviews": True}
  db.refresh(repo)
  assert repo.post_reviews is True
  assert authed_client.get("/user/connected-repos").json()[0]["post_reviews"] is True


def test_repo_settings_requires_access(authed_client, db, repo):
  assert authed_client.patch(f"/repos/{repo.id}/settings", json={"post_reviews": True}).status_code == 403


def test_schema_has_new_columns(db):
  inspector = inspect(db.get_bind())
  assert "agent_run_id" in {c["name"] for c in inspector.get_columns("review_findings")}
  review_id_column = next(c for c in inspector.get_columns("agent_runs") if c["name"] == "github_review_id")
  assert isinstance(review_id_column["type"], BigInteger)
  columns = {c["name"] for c in inspector.get_columns("repositories")}
  assert "post_reviews" in columns and "webhook_id" not in columns
