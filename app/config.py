import base64
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str
    github_client_id: str
    github_client_secret: str
    github_redirect_uri: str
    session_secret: str
    gemini_api_key: str
    environment: str = "development"
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    github_webhook_secret: str
    github_app_id: int
    github_app_slug: str
    github_app_private_key: str

    @property
    def github_app_private_key_pem(self) -> str:
        return base64.b64decode(self.github_app_private_key).decode()

settings = Settings()

