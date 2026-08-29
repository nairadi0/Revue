from fastapi import APIRouter, Depends, HTTPException
import httpx
from sqlalchemy.orm import Session
from ..database import get_db
from .auth import get_current_user, get_valid_access_token
from ..models import User, Repository, UserRepository, PullRequest, Status


router = APIRouter()


@router.get("/repos/{repo_id}/prs")
async def get_prs(repo_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
  repo_access = db.query(UserRepository).filter(UserRepository.user_id == current_user.id, UserRepository.repo_id == repo_id).first()
  if not repo_access: raise HTTPException(status_code=403, detail="You do not have access to this repository")
  repo = db.query(Repository).filter(Repository.id == repo_id).first()
  await get_valid_access_token(current_user, db)
  owner = repo.owner
  name = repo.name
  base_url = f"https://api.github.com/repos/{owner}/{name}/pulls"
  async with httpx.AsyncClient() as client:
    auth_header = {"Authorization" : f"Bearer {current_user.access_token}"}
    response = await client.get(base_url, headers=auth_header, params={"state" : "all"})
    if response.status_code != 200:
          raise HTTPException(status_code=404, detail="Repository not found or not accessible")
    pull_requests = response.json()
    prs = []
    for pr in pull_requests:
       pr_author = pr['user']['login']
       pr_number = pr['number']
       pr_title = pr['title']
       pr_state = pr['state']
       merged_at = pr['merged_at']
       created_at = pr['created_at']
       if pr_state == "open":
          status = Status.OPEN
       elif pr_state == "closed" and merged_at is not None:
          status = Status.MERGED
       elif pr_state == "closed" and merged_at is None:
          status = Status.CLOSED
       pr = db.query(PullRequest).filter(PullRequest.repo_id == repo_id, PullRequest.pr_number == pr_number).first()
       if pr:
          pr.status = status
          pr.title = pr_title
       else:
          pr = PullRequest(
             author = pr_author,
             title = pr_title,
             repo_id = repo_id,
             pr_number = pr_number,
             opened_at = created_at,
             status = status,
           )
          db.add(pr)
          db.flush()
       prs.append({"id" : pr.id, 
                    "pr_number" : pr.pr_number,
                    "title" : pr.title,
                    "author" : pr.author,
                    "status" : pr.status}) 
    db.commit()
  return prs
