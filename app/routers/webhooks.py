from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import hmac, hashlib
import httpx
from ..config import settings
from ..database import get_db
from ..models import User, Repository, UserRepository, PullRequest, PRFile, AgentRun, AgentStatus, Status
from .auth import get_valid_access_token
from .pull_requests import pr_review


router = APIRouter()


@router.post("/webhooks/github")
async def github_webhook(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
  body = await request.body()
  signature = request.headers.get("X-Hub-Signature-256", "")
  expected_signature = "sha256=" + hmac.new(settings.github_webhook_secret.encode(), body, hashlib.sha256).hexdigest()
  if not hmac.compare_digest(expected_signature, signature):
    raise HTTPException(status_code=401, detail="Invalid signature")

  event = request.headers.get("X-GitHub-Event")
  payload = await request.json()

  if event != "pull_request" or payload.get("action") != "opened":
    return {"status": "ignored"}

  repo_info = payload["repository"]
  pr_info = payload["pull_request"]
  author_login = pr_info["user"]["login"]

  repo = db.query(Repository).filter(Repository.github_repo_id == repo_info["id"]).first()
  if repo is None:
    return {"status": "ignored"}

  user = (
    db.query(User)
    .join(UserRepository, User.id == UserRepository.user_id)
    .filter(UserRepository.repo_id == repo.id, User.username == author_login)
    .first()
  )
  if user is None:
    return {"status": "ignored"}

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
      author=author_login,
      opened_at=pr_info["created_at"],
      status=Status.OPEN,
    )
    db.add(pr)
    db.flush()
  db.commit()

  await get_valid_access_token(user, db)
  auth_header = {"Authorization": f"Bearer {user.access_token}"}
  files_url = f"https://api.github.com/repos/{repo.owner}/{repo.name}/pulls/{pr_number}/files"
  async with httpx.AsyncClient() as client:
    response = await client.get(files_url, headers=auth_header)
    if response.status_code != 200:
      return {"status": "error", "detail": "failed to fetch PR files"}
    for file in response.json():
      file_path = file["filename"]
      additions = file["additions"]
      deletions = file["deletions"]
      patch_text = file.get("patch", "")
      status = file["status"]
      lookup_path = file["previous_filename"] if status == "renamed" else file_path
      existing = db.query(PRFile).filter(PRFile.pr_id == pr.id, PRFile.file_path == lookup_path).first()
      if existing:
        existing.file_path = file_path
        existing.additions = additions
        existing.deletions = deletions
        existing.patch_text = patch_text
      else:
        db.add(PRFile(
          pr_id=pr.id,
          file_path=file_path,
          additions=additions,
          deletions=deletions,
          patch_text=patch_text,
        ))
    db.commit()

  runs = db.query(AgentRun).filter(
    AgentRun.triggered_by_user_id == user.id,
    AgentRun.started_at >= (datetime.now() - timedelta(hours=24)),
  )
  if runs.count() >= 5:
    return {"status": "rate_limited"}

  agent_run = AgentRun(
    pr_id=pr.id,
    status=AgentStatus.PENDING,
    started_at=datetime.now(),
    triggered_by_user_id=user.id,
  )
  db.add(agent_run)
  db.commit()
  background_tasks.add_task(pr_review, agent_run.id, repo.id, pr_number, user.id)

  return {"status": "triggered", "run_id": agent_run.id}
