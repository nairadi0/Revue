from fastapi import APIRouter, responses, Request, HTTPException, Depends
import httpx, secrets
from ..config import settings
from datetime import datetime, timedelta
from ..database import SessionLocal, get_db
from ..models import User
from jose import jwt, JWTError
from sqlalchemy.orm import Session


router = APIRouter()
gh_client_id = settings.github_client_id
gh_client_secret = settings.github_client_secret
gh_redirect_uri = settings.github_redirect_uri


@router.get("/auth/login")
async def login():
  base_url = "https://github.com/login/oauth/authorize"
  client_id = gh_client_id
  redirect_uri = gh_redirect_uri
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


@router.get("/auth/callback")
async def callback(code: str, state: str, request: Request):
  if state != request.cookies.get("state"): 
    raise HTTPException(status_code=400, detail="State mismatch" )
  base_url = "https://github.com/login/oauth/access_token"
  client_id = settings.github_client_id
  client_secret = settings.github_client_secret
  redirect_uri = gh_redirect_uri
  async with httpx.AsyncClient() as client:
    response = await client.post(base_url, data={"client_id" : client_id,
                                                 "client_secret" : client_secret,
                                                 "code" : code,
                                                 "redirect_uri" : redirect_uri
                                                }, headers={"Accept" : "application/json"})
    token_data = response.json()
    token_expires_at = timedelta(seconds=int(token_data["expires_in"])) + datetime.now()
    auth_header = {"Authorization" : f"Bearer {token_data['access_token']}"}
    gh_identity = await client.get("https://api.github.com/user", headers=auth_header)
    gh_identity_data = gh_identity.json()

    db = SessionLocal()
    user = db.query(User).filter(User.github_id == gh_identity_data["id"]).first()

    if user:
      user.access_token = token_data['access_token']
      user.token_expires_at = token_expires_at
      user.refresh_token = token_data['refresh_token']
    else:
      user = User(
        github_id = gh_identity_data["id"],
        username = gh_identity_data["login"],
        access_token = token_data['access_token'],
        token_expires_at = token_expires_at,
        refresh_token = token_data['refresh_token'],
      )
      db.add(user)
    db.commit()
    claims = {"sub" : str(user.id),
              "exp" : datetime.now() + timedelta(days=7)}
    jwt_token = jwt.encode(claims, settings.session_secret, "HS256")
    dash_url = "http://localhost:5173/dashboard"
    response = responses.RedirectResponse(str(dash_url))
    response.set_cookie("jwt", jwt_token, httponly=True)
    return response

  
def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
  token = request.cookies.get("jwt")
  if token is None: raise HTTPException(status_code=401, detail="User not Authenticated")
  try:
    decoded_token = jwt.decode(token, settings.session_secret, algorithms=["HS256"])
    user_id = int(decoded_token["sub"])
  except JWTError:
    raise HTTPException(status_code=401, detail="Invalid Token")
  user = db.query(User).filter(User.id == user_id).first()
  if not user: raise HTTPException(status_code=401, detail="User not found")

  return user


async def get_valid_access_token(user: User, db) -> str:
  if datetime.now() > user.token_expires_at:
    async with httpx.AsyncClient() as client:
      base_url = "https://github.com/login/oauth/access_token"
      response = await client.post(base_url, data={"grant_type" : "refresh_token",
                                                  "refresh_token" : user.refresh_token, 
                                                  "client_id" : gh_client_id, 
                                                  "client_secret" : gh_client_secret}, headers={"Accept" : "application/json"})
      new_token = response.json()
      user.access_token = new_token['access_token']
      user.refresh_token = new_token['refresh_token']
      user.token_expires_at = timedelta(seconds=int(new_token['expires_in'])) + datetime.now()
      db.commit()
      return user.access_token

  else:
    return user.access_token
