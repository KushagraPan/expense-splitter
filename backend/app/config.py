"""Application Configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Expense Splitter API"
    app_version: str = "1.0.0"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]
    host: str = "0.0.0.0"
    port: int = 8000

    model_config = SettingsConfigDict(
        env_prefix="EXPENSE_SPLITTER_",
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
