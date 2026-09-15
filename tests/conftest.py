import base64
import hashlib
from datetime import datetime, timezone
import hmac
import json
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models import Repository, User
from app.routers.auth import get_current_user
from app.services import github_app


@pytest.fixture
def anyio_backend():
  return "asyncio"


@pytest.fixture
def db():
  engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
  Base.metadata.create_all(engine)
  TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
  session = TestingSession()
  app.dependency_overrides[get_db] = lambda: session
  yield session
  session.close()
  app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def user(db):
  row = User(
    github_id=12345678,
    username="tester",
    access_token="ghu_test",
    token_expires_at=datetime(2099, 1, 1, tzinfo=timezone.utc),
    refresh_token="ghr_test",
  )
  db.add(row)
  db.commit()
  return row


@pytest.fixture
def authed_client(user):
  app.dependency_overrides[get_current_user] = lambda: user
  yield TestClient(app)
  app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def client(db):
  return TestClient(app)


@pytest.fixture
def repo(db):
  row = Repository(owner="acme", name="widgets", default_branch="main", github_repo_id=4242, installation_id=777)
  db.add(row)
  db.commit()
  return row


@pytest.fixture
def rsa_key(monkeypatch):
  key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
  pem = key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.TraditionalOpenSSL,
    serialization.NoEncryption(),
  )
  monkeypatch.setattr(settings, "github_app_private_key", base64.b64encode(pem).decode())
  return key


@pytest.fixture(autouse=True)
def clear_token_cache():
  github_app._installation_tokens.clear()
  yield
  github_app._installation_tokens.clear()


def sign(payload: dict) -> tuple[bytes, dict[str, str]]:
  body = json.dumps(payload).encode()
  signature = "sha256=" + hmac.new(settings.github_webhook_secret.encode(), body, hashlib.sha256).hexdigest()
  return body, {"X-Hub-Signature-256": signature, "Content-Type": "application/json"}
