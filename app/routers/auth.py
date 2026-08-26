from fastapi import APIRouter, responses
import httpx, secrets

from ..config import settings

router = APIRouter()
gh_client_id = settings.github_client_id


@router.get("/auth/login")
def create_url():
  base_url = "https://github.com/login/oauth/authorize"
  client_id = gh_client_id
  redirect_uri = "http://localhost:8000/auth/callback"
  scope = "repo"
  state = secrets.token_urlsafe()
  query_params = {"client_id" : client_id, 
                  "redirect_uri" : redirect_uri,
                  "scope" : scope,
                  "state" : state
                  }
  auth_url = httpx.URL(base_url, params=query_params)
  response = responses.RedirectResponse(str(auth_url))
  response.set_cookie("state", state, httponly=True)

  return response

