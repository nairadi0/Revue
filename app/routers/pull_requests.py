from fastapi import APIRouter, Depends, HTTPException
import httpx
from sqlalchemy.orm import Session
from ..database import get_db
from .auth import get_current_user, get_valid_access_token
from ..models import User, Repository, UserRepository, PullRequest, Status, PRFile
from ..services.agent import agent_review

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


@router.get("/repos/{repo_id}/prs/{pr_number}/files")
async def get_pr_files(repo_id: int, pr_number: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
   repo_access = db.query(UserRepository).filter(UserRepository.user_id == current_user.id, UserRepository.repo_id == repo_id).first()
   if repo_access is None: raise HTTPException(status_code=403, detail="You do not have access to this repository")
   repo = db.query(Repository).filter(Repository.id == repo_id).first()
   pr = db.query(PullRequest).filter(PullRequest.repo_id == repo_id, PullRequest.pr_number == pr_number).first()
   if pr is None: raise HTTPException(status_code=404, detail="Pull Request not found")
   await get_valid_access_token(current_user, db)
   owner = repo.owner
   name = repo.name
   base_url = f"https://api.github.com/repos/{owner}/{name}/pulls/{pr_number}/files"
   async with httpx.AsyncClient() as client:
      auth_header = {"Authorization" : f"Bearer {current_user.access_token}"}
      response = await client.get(base_url, headers=auth_header)
      if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Cannot find files for this Pull Request")
      pr_files = response.json()
      files = []
      for file in pr_files:
          file_path = file['filename']
          additions = file['additions']
          deletions = file['deletions']
          patch_text = file.get('patch', '')
          file = db.query(PRFile).filter(PRFile.pr_id == pr.id, PRFile.file_path == file_path).first()
          if file:
              file.additions = additions
              file.deletions = deletions
              file.patch_text = patch_text
          else: 
              file = PRFile (
                  pr_id = pr.id,
                  file_path = file_path,
                  additions = additions,
                  deletions = deletions,
                  patch_text = patch_text
              )
              db.add(file)
              db.flush()
          files.append({"id" : file.id,
                        "pr_id" : file.pr_id,
                        "file_path" : file.file_path,
                        "additions" : file.additions,
                        "deletions" : file.deletions,
                        "patch_text" : file.patch_text
                        })
      db.commit()
   return files
            

@router.post("/repos/{repo_id}/prs/{pr_number}/review")
async def trigger_review(repo_id: int, pr_number: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo_access = db.query(UserRepository).filter(UserRepository.user_id == current_user.id, UserRepository.repo_id == repo_id).first()
    if repo_access is None: raise HTTPException(status_code=403, detail="You do not have access to this repository")
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    pr = db.query(PullRequest).filter(PullRequest.repo_id == repo_id, PullRequest.pr_number == pr_number).first()
    if pr is None: raise HTTPException(status_code=404, detail="Pull Request not found")
    pr_files = db.query(PRFile).filter(PRFile.pr_id == pr.id)
    file_count = 0
    for pr_file in pr_files:
        await agent_review(pr_file, repo, current_user, db)
        file_count += 1
    return {"files_reviewed" : file_count}
