from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from app.config import settings
from app.routers.auth import get_current_user


def claims_for(user):
  return {"sub": str(user.id), "exp": datetime.now(timezone.utc) + timedelta(days=7)}


class FakeRequest:
  def __init__(self, token):
    self.cookies = {"jwt": token} if token is not None else {}


def test_valid_hs256_token_resolves_the_user(db, user):
  token = jwt.encode(claims_for(user), settings.session_secret, "HS256")
  assert get_current_user(FakeRequest(token), db).id == user.id


def test_unsigned_token_is_rejected(db, user):
  token = jwt.encode(claims_for(user), key="", algorithm="none")
  with pytest.raises(HTTPException) as excinfo:
    get_current_user(FakeRequest(token), db)
  assert excinfo.value.status_code == 401


def test_token_signed_with_another_secret_is_rejected(db, user):
  token = jwt.encode(claims_for(user), "wrong-secret-of-sufficient-length-for-hs256", "HS256")
  with pytest.raises(HTTPException) as excinfo:
    get_current_user(FakeRequest(token), db)
  assert excinfo.value.status_code == 401


def test_expired_token_is_rejected(db, user):
  claims = {"sub": str(user.id), "exp": datetime.now(timezone.utc) - timedelta(seconds=1)}
  token = jwt.encode(claims, settings.session_secret, "HS256")
  with pytest.raises(HTTPException) as excinfo:
    get_current_user(FakeRequest(token), db)
  assert excinfo.value.status_code == 401


def test_missing_cookie_is_rejected(db):
  with pytest.raises(HTTPException) as excinfo:
    get_current_user(FakeRequest(None), db)
  assert excinfo.value.status_code == 401
