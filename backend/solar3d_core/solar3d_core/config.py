from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "solar3d_dev"
    environment: str = "development"

    model_config = SettingsConfigDict(
        env_prefix="SOLAR3D_",
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
