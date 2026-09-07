from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.auth import router as auth_router
from .routers.repos import router as repos_router
from .routers.pull_requests import router as pr_router
from .routers.webhooks import router as webhooks_router
from .routers.metrics import router as metrics_router
from .config import settings


app = FastAPI()
app.include_router(auth_router)
app.include_router(repos_router)
app.include_router(pr_router)
app.include_router(webhooks_router)
app.include_router(metrics_router)
app.add_middleware(
  CORSMiddleware,
  allow_origins=[settings.frontend_url],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)
