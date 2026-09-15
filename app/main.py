from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .services.github_app import AppNotInstalled, install_url
from .routers.auth import router as auth_router
from .routers.repos import router as repos_router
from .routers.pull_requests import router as pr_router
from .routers.webhooks import router as webhooks_router
from .routers.metrics import router as metrics_router
from .config import settings


app = FastAPI()


@app.exception_handler(AppNotInstalled)
async def app_not_installed_handler(request: Request, exc: AppNotInstalled):
  return JSONResponse(
    status_code=409,
    content={"detail": str(exc), "code": "app_not_installed", "install_url": install_url()},
  )


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
