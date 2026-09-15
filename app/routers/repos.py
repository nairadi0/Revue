from fastapi import APIRouter, Depends, HTTPException
from ..models import User, Repository, UserRepository
from .auth import get_current_user, get_valid_access_token
from ..services.github_app import find_repo_installation, AppNotInstalled
from pydantic import BaseModel
import httpx
from ..database import get_db
from sqlalchemy.orm import Session


router = APIRouter()


@router.get("/user/repos")
async def get_repos(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
  base_url = "https://api.github.com/user/repos"
  await get_valid_access_token(current_user, db)
  auth_header = {"Authorization" : f"Bearer {current_user.access_token}"}
  all_repos = []
  async with httpx.AsyncClient() as client:
    url = base_url
    params = {"per_page": 100}
    while url:
      response = await client.get(url, headers=auth_header, params=params)
      if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch repositories from GitHub")
      all_repos.extend(response.json())
      next_link = response.links.get("next")
      url = next_link["url"] if next_link else None
      params = None 

  return all_repos


class ConnectRepoRequest(BaseModel):
  owner: str
  name: str


@router.post("/repos/connect")
async def connect_repo(payload: ConnectRepoRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
  owner = payload.owner
  name = payload.name
  await get_valid_access_token(current_user, db)
  async with httpx.AsyncClient() as client:
    auth_header = {"Authorization" : f"Bearer {current_user.access_token}"}
    response = await client.get(f"https://api.github.com/repos/{owner}/{name}", headers=auth_header)
  if response.status_code != 200:
    raise HTTPException(status_code=404, detail="Repository not found or not accessible")
  repo_info = response.json()

  installation_id = await find_repo_installation(repo_info['owner']['login'], repo_info['name'])
  if installation_id is None:
    raise AppNotInstalled(repo_info['owner']['login'], repo_info['name'])

  repo = db.query(Repository).filter(Repository.github_repo_id == repo_info['id']).first()
  if repo:
    repo.default_branch = repo_info['default_branch']
    repo.owner = repo_info['owner']['login']
    repo.name = repo_info['name']
    repo.installation_id = installation_id
  else:
    repo = Repository(
      owner = repo_info['owner']['login'],
      name = repo_info['name'],
      default_branch = repo_info['default_branch'],
      github_repo_id = repo_info['id'],
      installation_id = installation_id,
    )
    db.add(repo)
    db.flush()

  user_repo = db.query(UserRepository).filter(UserRepository.repo_id == repo.id, UserRepository.user_id == current_user.id).first()
  if not user_repo:
    user_repo = UserRepository(
      user_id = current_user.id,
      repo_id = repo.id,
    )
    db.add(user_repo)
  db.commit()
  return {
    "id": repo.id,
    "github_repo_id": repo.github_repo_id,
    "owner": repo.owner,
    "name": repo.name,
    "default_branch": repo.default_branch,
    "installation_id": repo.installation_id,
  }


@router.get("/user/connected-repos")
def get_connected_repos(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
  connected_repos = db.query(UserRepository, Repository).join(Repository, UserRepository.repo_id == Repository.id).filter(UserRepository.user_id == current_user.id)
  repos = []
  for user_repo, repo in connected_repos.all():
    id = repo.id
    name = repo.name
    owner = repo.owner
    connected_at = user_repo.connected_at
    repos.append({"id" : id,
                  "name" : name,
                  "owner" : owner,
                  "connected_at" : connected_at,
                  "post_reviews" : repo.post_reviews,
                  })

  return repos


class RepoSettings(BaseModel):
  post_reviews: bool


@router.patch("/repos/{repo_id}/settings")
def update_repo_settings(repo_id: int, payload: RepoSettings, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
  repo_access = db.query(UserRepository).filter(UserRepository.user_id == current_user.id, UserRepository.repo_id == repo_id).first()
  if repo_access is None: raise HTTPException(status_code=403, detail="You do not have access to this repository")
  repo = db.query(Repository).filter(Repository.id == repo_id).first()
  repo.post_reviews = payload.post_reviews
  db.commit()
  return {"id": repo.id, "post_reviews": repo.post_reviews}
