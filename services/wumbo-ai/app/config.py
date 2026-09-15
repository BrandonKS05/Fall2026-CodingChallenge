"""Settings, read from the environment once at import time.

The API key is never written down here or anywhere else in the repository: it
arrives as OPENAI_API_KEY, and the service runs (in fallback) without it so a
missing key degrades the widget instead of breaking the page.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    openai_api_key: str | None = None

    #: Any chat-completions model the account can reach. Kept in the environment
    #: so moving to a newer or cheaper one never needs a code change.
    wumbo_model: str = "gpt-4o-mini"
    wumbo_max_tokens: int = 700
    #: None omits the parameter, which the reasoning models require.
    wumbo_temperature: float | None = 0.3
    wumbo_request_timeout_seconds: float = 30.0

    # Per session, and a slower ceiling so one session cannot grind all day.
    wumbo_rate_limit_per_minute: int = 12
    wumbo_rate_limit_per_hour: int = 120

    # How many past turns to replay. Older ones are dropped rather than summarized.
    wumbo_history_turns: int = 12

    wumbo_allowed_origins: str = "http://localhost:5173"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.wumbo_allowed_origins.split(",") if origin.strip()]

    @property
    def configured(self) -> bool:
        """False when there is no key, which is what puts the service in fallback."""
        return bool(self.openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
