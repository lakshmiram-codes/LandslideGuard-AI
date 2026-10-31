from typing import List, Union, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "LandslideGuard AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DESCRIPTION: str = "AI-Based Early Warning and Landslide Risk Monitoring System for Vulnerable Mountain Corridors Across India (Himalayas, NER, Western Ghats, Nilgiris)"
    CURRENT_PHASE: str = "Phase 8 - Final Integration, Security Audit & Deployment Readiness"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Server configuration
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8000
    
    # Database configuration
    # Default to SQLite for seamless isolated tests/standalone run;
    # override with PostgreSQL via DATABASE_URL environment variable.
    DATABASE_URL: str = "sqlite:///./landslideguard.db"
    DATABASE_ECHO: bool = False
    DB_POOL_PRE_PING: bool = True

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            # Cloud providers like Render and Heroku use postgres://
            # SQLAlchemy 2.0 requires postgresql+psycopg2:// or postgresql://
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+psycopg2://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
                return v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v

    # Phase 5: Weather Integration Configuration (Open-Meteo & Modular Providers)
    WEATHER_PROVIDER: str = "open-meteo"
    OPEN_METEO_API_URL: str = "https://api.open-meteo.com/v1/forecast"
    OPEN_METEO_API_KEY: Optional[str] = None
    WEATHER_REQUEST_TIMEOUT_SECONDS: float = 8.0
    WEATHER_MAX_RETRIES: int = 3
    WEATHER_FRESHNESS_HOURS_CURRENT: float = 3.0
    WEATHER_FRESHNESS_HOURS_STALE: float = 24.0
    WEATHER_CLOCK_SKEW_TOLERANCE_MINUTES: float = 15.0
    WEATHER_MAX_BATCH_SIZE: int = 25

    # CORS Configuration
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip().rstrip("/") for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return [i.rstrip("/") if isinstance(i, str) else i for i in v]
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
