from fastapi import APIRouter, Depends, HTTPException
from ..models import User, Repository, UserRepository
from .auth import get_current_user, get_valid_access_token
from pydantic import BaseModel
import httpx
from ..database import get_db
from sqlalchemy.orm import Session


router = APIRouter()


@router.get("/user/repos")
async def get_repos(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
  base_url = "https://api.github.com/user/repos"
  await get_valid_access_token(current_user, db)
  async with httpx.AsyncClient() as client:
    auth_header = {"Authorization" : f"Bearer {current_user.access_token}"}
    response = await client.get(base_url, headers=auth_header)
    repo_data = response.json()

    return repo_data


class ConnectRepoRequest(BaseModel):
  owner: str
  name: str


@router.post("/repos/connect")
async def connect_repo(payload: ConnectRepoRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
  owner = payload.owner
  name = payload.name
  await get_valid_access_token(current_user, db)
  base_url = f"https://api.github.com/repos/{owner}/{name}"
  async with httpx.AsyncClient() as client:
    auth_header = {"Authorization" : f"Bearer {current_user.access_token}"}
    response = await client.get(base_url, headers=auth_header)
    if response.status_code != 200:
      raise HTTPException(status_code=404, detail="Repository not found or not accessible")
    repo_info = response.json()
    repo = db.query(Repository).filter(Repository.github_repo_id == repo_info['id']).first()

    if repo:
      repo.default_branch = repo_info['default_branch']
      repo.owner = repo_info['owner']['login']
      repo.name = repo_info['name']
    else: 
      repo = Repository(
        owner = repo_info['owner']['login'],
        name = repo_info['name'],
        default_branch = repo_info['default_branch'],
        github_repo_id = repo_info['id'],
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
    }