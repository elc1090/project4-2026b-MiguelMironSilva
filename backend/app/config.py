from urllib.parse import urlsplit

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    tmdb_api_key: str
    jwt_secret_key: str
    google_client_id: str = ""
    google_client_secret: SecretStr = SecretStr("")
    google_redirect_uri: str = "http://127.0.0.1:8000/api/auth/google/callback"
    frontend_url: str = "http://localhost:5173"

    @field_validator("google_redirect_uri", "frontend_url")
    @classmethod
    def validate_login_url(cls, value: str, info) -> str:
        parts = urlsplit(value)
        local = parts.hostname in {"localhost", "127.0.0.1", "::1"}
        if (not parts.hostname or parts.username is not None or parts.password is not None
                or parts.query or parts.fragment or "?" in value or "#" in value
                or "\\" in value or any(char.isspace() for char in value)
                or (parts.scheme != "https" and not (local and parts.scheme == "http"))):
            raise ValueError("Use uma URL HTTPS, ou HTTP somente no ambiente local")
        if info.field_name == "frontend_url" and parts.path not in ("", "/"):
            raise ValueError("FRONTEND_URL deve conter somente a origem do frontend")
        if info.field_name == "google_redirect_uri" and not parts.path.endswith("/api/auth/google/callback"):
            raise ValueError("GOOGLE_REDIRECT_URI deve apontar para /api/auth/google/callback")
        return value.rstrip("/") if info.field_name == "frontend_url" else value

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # .env can also contain deployment or other integration settings.
    )


settings = Settings()