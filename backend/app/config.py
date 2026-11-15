from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[2] / '.env', extra='ignore')
    database_url: str = 'postgresql+psycopg://localhost:5432/fieldshift'
    app_token: str = ''
    cors_origins: list[str] = ['http://localhost:3000', 'http://127.0.0.1:3000']

settings = Settings()
