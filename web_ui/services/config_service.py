"""Config service — wraps src.config_manager.ConfigManager."""

from typing import Any

from src.config_manager import ConfigManager


class ConfigService:
    """Thin wrapper around ConfigManager with in-memory caching."""

    _config_manager: ConfigManager = None
    _cache: dict | None = None

    @classmethod
    def init(cls) -> None:
        cls._config_manager = ConfigManager()
        cls._cache = None

    @classmethod
    def get_config(cls) -> dict[str, Any]:
        if cls._cache is None:
            cls._cache = cls._config_manager.load_config()
        return cls._cache

    @classmethod
    def update_config(cls, updates: dict[str, Any]) -> None:
        config = cls.get_config()
        config.update(updates)
        cls._config_manager.save_config(config)
        cls._cache = None  # Invalidate cache

    @classmethod
    def get_raw(cls, file_type: str) -> dict[str, Any]:
        return cls._config_manager.get_raw_file_content(file_type)

    @classmethod
    def invalidate(cls) -> None:
        cls._cache = None
