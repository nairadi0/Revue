from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from ..database import get_db, SessionLocal
from .auth import get_current_user, get_valid_access_token
from ..models import User, Repository, UserRepository, PullRequest, Status, PRFile, ReviewFinding, AgentRun, AgentStatus
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


async def pr_review(agent_run_id: int, repo_id: int, pr_number: int, current_user_id: int):
    db = SessionLocal()
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    pr = db.query(PullRequest).filter(PullRequest.repo_id == repo_id, PullRequest.pr_number == pr_number).first()
    pr_files = db.query(PRFile).filter(PRFile.pr_id == pr.id)
    user = db.query(User).filter(User.id == current_user_id).first()
    agent_run = db.query(AgentRun).filter(AgentRun.id == agent_run_id).first()
    run_log = []
    try:
      agent_run.status = AgentStatus.RUNNING
      db.commit()
      try: 
         file_count = 0
         for pr_file in pr_files:
            run_log.extend(await agent_review(pr_file, repo, user, db))
            file_count += 1
         agent_run.status = AgentStatus.SUCCESS
         agent_run.completed_at = datetime.now()
         agent_run.tool_calls_log = run_log
         db.commit()
      except Exception as e:
          agent_run.status = AgentStatus.FAILED
          agent_run.completed_at = datetime.now()
          run_log.append({"error" : str(e)})
          agent_run.tool_calls_log = run_log
          db.commit()
          
    finally:
      db.close()

@router.post("/repos/{repo_id}/prs/{pr_number}/review")
async def trigger_review(repo_id: int, pr_number: int, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo_access = db.query(UserRepository).filter(UserRepository.user_id == current_user.id, UserRepository.repo_id == repo_id).first()
    if repo_access is None: raise HTTPException(status_code=403, detail="You do not have access to this repository")
    pr = db.query(PullRequest).filter(PullRequest.repo_id == repo_id, PullRequest.pr_number == pr_number).first()
    if pr is None: raise HTTPException(status_code=404, detail="Pull Request not found")
    agent_run = AgentRun(
        pr_id = pr.id,
        status = AgentStatus.PENDING,
        started_at = datetime.now(),
    )
    db.add(agent_run)
    db.commit()
    background_tasks.add_task(pr_review, agent_run.id, repo_id, pr_number, current_user.id)
    return {"run_id" : agent_run.id,
            "status" : agent_run.status, 
            }


@router.get("/repos/{repo_id}/prs/{pr_number}/findings")
async def view_findings(repo_id: int, pr_number: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
   repo_access = db.query(UserRepository).filter(UserRepository.user_id == current_user.id, UserRepository.repo_id == repo_id).first()
   if repo_access is None: raise HTTPException(status_code=403, detail="You do not have access to this repository")
   pr = db.query(PullRequest).filter(PullRequest.repo_id == repo_id, PullRequest.pr_number == pr_number).first()
   if pr is None: raise HTTPException(status_code=404, detail="Pull Request not found")
   review_findings = db.query(ReviewFinding).filter(ReviewFinding.pr_id == pr.id)
   findings = []
   for finding in review_findings:
       finding_id = finding.id
       file_id = finding.file_id
       line_number = finding.line_number
       severity = finding.severity
       category = finding.category
       finding_text = finding.finding_text
       suggestion = finding.suggestion
       findings.append({"id" : finding_id,
                        "file_id" : file_id,
                        "line_number" : line_number,
                        "severity" : severity, 
                        "category" : category, 
                        "finding_text" : finding_text,
                        "suggestion" : suggestion,
                        })
   return findings


@router.get("/agent_runs/{run_id}")
async def pr_run(run_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    agent_run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
    if agent_run is None: raise HTTPException(status_code=404, detail="Pull request review not found")
    pr = db.query(PullRequest).filter(PullRequest.id == agent_run.pr_id).first()
    repo = db.query(UserRepository).filter(UserRepository.user_id == current_user.id, UserRepository.repo_id == pr.repo_id).first()
    if repo is None: raise HTTPException(status_code=403, detail="No permission to view this repository")

    return {"status" : agent_run.status,
            "started_at" : agent_run.started_at,
            "completed_at" : agent_run.completed_at,
            }

