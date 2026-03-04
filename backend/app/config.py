from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Literature Chat Backend"
    unpaywall_email: str | None = Field(default=None, alias="UNPAYWALL_EMAIL")
    cors_origin: str = Field(default="http://localhost:5173", alias="CORS_ORIGIN")
    request_timeout_seconds: float = 12.0


settings = Settings()
