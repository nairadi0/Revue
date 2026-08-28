from fastapi import APIRouter, Depends
from ..models import User
from .auth import get_current_user
import httpx


router = APIRouter()


@router.get("/user/repos")
async def get_repos(current_user: User = Depends(get_current_user)):
  base_url = "https://api.github.com/user/repos"
  async with httpx.AsyncClient() as client:
    auth_header = {"Authorization" : f"Bearer {current_user.access_token}"}
    response = await client.get(base_url, headers=auth_header)
    repo_data = response.json()

    return repo_data

