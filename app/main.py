from fastapi import FastAPI
from .routers.auth import router as auth_router
from .routers.repos import router as repos_router


app = FastAPI()
app.include_router(auth_router)
app.include_router(repos_router)