from fastapi import FastAPI
from .routers.auth import router as auth_router
from .routers.repos import router as repos_router
from .routers.pull_requests import router as pr_router


app = FastAPI()
app.include_router(auth_router)
app.include_router(repos_router)
app.include_router(pr_router)