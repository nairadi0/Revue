from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import hmac, hashlib
import httpx
from ..config import settings
from ..database import get_db
from ..models import Repository, PullRequest, PRFile, AgentRun, AgentStatus, Status
from ..services.github_app import repo_headers
from .pull_requests import pr_review


router = APIRouter()

REVIEWS_PER_REPO_PER_DAY = 5


@router.post("/webhooks/github")
async def github_webhook(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
  body = await request.body()
  signature = request.headers.get("X-Hub-Signature-256", "")
  expected_signature = "sha256=" + hmac.new(settings.github_webhook_secret.encode(), body, hashlib.sha256).hexdigest()
  if not hmac.compare_digest(expected_signature, signature):
    raise HTTPException(status_code=401, detail="Invalid signature")

  event = request.headers.get("X-GitHub-Event")
  payload = await request.json()

  if event == "installation":
    return handle_installation(payload, db)
  if event == "installation_repositories":
    return handle_installation_repositories(payload, db)
  if event == "pull_request" and payload.get("action") == "opened":
    return await handle_pull_request_opened(payload, background_tasks, db)
  return {"status": "ignored"}


def set_installation(db: Session, github_repo_ids: list[int], installation_id: int | None) -> int:
  if not github_repo_ids:
    return 0
  updated = (
    db.query(Repository)
    .filter(Repository.github_repo_id.in_(github_repo_ids))
    .update({Repository.installation_id: installation_id}, synchronize_session=False)
  )
  db.commit()
  return updated


def handle_installation(payload: dict, db: Session):
  action = payload.get("action")
  installation_id = payload["installation"]["id"]
  if action == "created":
    repo_ids = [repo["id"] for repo in payload.get("repositories", [])]
    return {"status": "linked", "repos": set_installation(db, repo_ids, installation_id)}
  if action in ("deleted", "suspend"):
    updated = (
      db.query(Repository)
      .filter(Repository.installation_id == installation_id)
      .update({Repository.installation_id: None}, synchronize_session=False)
    )
    db.commit()
    return {"status": "unlinked", "repos": updated}
  return {"status": "ignored"}


def handle_installation_repositories(payload: dict, db: Session):
  installation_id = payload["installation"]["id"]
  added = [repo["id"] for repo in payload.get("repositories_added", [])]
  removed = [repo["id"] for repo in payload.get("repositories_removed", [])]
  return {
    "status": "updated",
    "linked": set_installation(db, added, installation_id),
    "unlinked": set_installation(db, removed, None),
  }


async def handle_pull_request_opened(payload: dict, background_tasks: BackgroundTasks, db: Session):
  repo_info = payload["repository"]
  pr_info = payload["pull_request"]
  installation_id = payload["installation"]["id"]

  repo = db.query(Repository).filter(Repository.github_repo_id == repo_info["id"]).first()
  if repo is None:
    return {"status": "ignored"}
  if repo.installation_id != installation_id:
    repo.installation_id = installation_id

  pr_number = pr_info["number"]
  pr = db.query(PullRequest).filter(PullRequest.repo_id == repo.id, PullRequest.pr_number == pr_number).first()
  if pr:
    pr.status = Status.OPEN
    pr.title = pr_info["title"]
  else:
    pr = PullRequest(
      repo_id=repo.id,
      pr_number=pr_number,
      title=pr_info["title"],
      author=pr_info["user"]["login"],
      opened_at=datetime.fromisoformat(pr_info["created_at"]),
      status=Status.OPEN,
    )
    db.add(pr)
    db.flush()
  db.commit()

  files_url = f"https://api.github.com/repos/{repo.owner}/{repo.name}/pulls/{pr_number}/files"
  async with httpx.AsyncClient() as client:
    response = await client.get(files_url, headers=await repo_headers(repo))
  if response.status_code != 200:
    return {"status": "error", "detail": "failed to fetch PR files"}
  for file in response.json():
    file_path = file["filename"]
    lookup_path = file["previous_filename"] if file["status"] == "renamed" else file_path
    existing = db.query(PRFile).filter(PRFile.pr_id == pr.id, PRFile.file_path == lookup_path).first()
    if existing:
      existing.file_path = file_path
      existing.additions = file["additions"]
      existing.deletions = file["deletions"]
      existing.patch_text = file.get("patch", "")
    else:
      db.add(PRFile(
        pr_id=pr.id,
        file_path=file_path,
        additions=file["additions"],
        deletions=file["deletions"],
        patch_text=file.get("patch", ""),
      ))
  db.commit()

  recent_runs = (
    db.query(AgentRun)
    .join(PullRequest, AgentRun.pr_id == PullRequest.id)
    .filter(
      PullRequest.repo_id == repo.id,
      AgentRun.started_at >= datetime.now(timezone.utc) - timedelta(hours=24),
    )
    .count()
  )
  if recent_runs >= REVIEWS_PER_REPO_PER_DAY:
    return {"status": "rate_limited"}

  agent_run = AgentRun(
    pr_id=pr.id,
    status=AgentStatus.PENDING,
    started_at=datetime.now(timezone.utc),
    triggered_by_user_id=None,
  )
  db.add(agent_run)
  db.commit()
  background_tasks.add_task(pr_review, agent_run.id, repo.id, pr_number)

  return {"status": "triggered", "run_id": agent_run.id}
