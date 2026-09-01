from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str
    github_client_id: str
    github_client_secret: str
    github_redirect_uri: str
    session_secret: str
    gemini_api_key: str


settings = Settings()
