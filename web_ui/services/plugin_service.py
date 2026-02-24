"""Plugin service — wraps PluginManager and StoreManager."""

import json
from pathlib import Path
from typing import Any

from src.config_manager import ConfigManager
from src.plugin_system.plugin_manager import PluginManager
from src.plugin_system.store_manager import PluginStoreManager


class PluginService:
    """Thin wrapper around plugin system modules."""

    _plugin_manager: PluginManager = None
    _store_manager: PluginStoreManager = None
    _config_manager: ConfigManager = None

    @classmethod
    def init(cls, plugins_dir: str, config_manager: ConfigManager) -> None:
        cls._config_manager = config_manager
        cls._plugin_manager = PluginManager(
            plugins_dir=plugins_dir,
            config_manager=config_manager,
            display_manager=None,
            cache_manager=None,
        )
        cls._store_manager = PluginStoreManager(plugins_dir=plugins_dir)
        cls._plugin_manager.discover_plugins()

    @classmethod
    def list_plugins(cls) -> list[dict[str, Any]]:
        all_info = cls._plugin_manager.get_all_plugin_info()
        config = cls._config_manager.load_config()
        result = []
        for info in all_info:
            pid = info.get("id")
            plugin_config = config.get(pid, {})
            enabled = plugin_config.get("enabled", True)
            # Check plugin instance
            instance = cls._plugin_manager.get_plugin(pid)
            if instance:
                enabled = instance.enabled
            result.append(
                {
                    "id": pid,
                    "name": info.get("name", pid),
                    "version": info.get("version", ""),
                    "author": info.get("author", "Unknown"),
                    "description": info.get("description", ""),
                    "category": info.get("category", "General"),
                    "enabled": enabled,
                    "tags": info.get("tags", []),
                }
            )
        return result

    @classmethod
    def get_plugin_config(cls, plugin_id: str) -> dict[str, Any]:
        config = cls._config_manager.load_config()
        plugin_config = config.get(plugin_id, {})
        # Load schema
        schema = {}
        schema_path = Path(cls._plugin_manager.plugins_dir) / plugin_id / "config_schema.json"
        if schema_path.exists():
            try:
                schema = json.loads(schema_path.read_text())
            except (json.JSONDecodeError, OSError):
                pass
        return {"config": plugin_config, "schema": schema}

    @classmethod
    def save_plugin_config(cls, plugin_id: str, new_config: dict[str, Any]) -> None:
        config = cls._config_manager.load_config()
        config[plugin_id] = new_config
        cls._config_manager.save_config(config)

    @classmethod
    def toggle_plugin(cls, plugin_id: str, enabled: bool) -> dict[str, str]:
        config = cls._config_manager.load_config()
        if plugin_id not in config:
            config[plugin_id] = {}
        config[plugin_id]["enabled"] = enabled
        cls._config_manager.save_config(config)
        return {"status": "ok", "plugin_id": plugin_id, "enabled": enabled}

    @classmethod
    def get_store_plugins(cls) -> list[dict[str, Any]]:
        registry = cls._store_manager.fetch_registry()
        return registry.get("plugins", [])

    @classmethod
    def install_plugin(cls, plugin_id: str) -> dict[str, str]:
        success = cls._store_manager.install_plugin(plugin_id)
        if success:
            cls._plugin_manager.discover_plugins()
            return {"status": "ok", "message": f"Installed {plugin_id}"}
        return {"status": "error", "message": f"Failed to install {plugin_id}"}

    @classmethod
    def uninstall_plugin(cls, plugin_id: str) -> dict[str, str]:
        success = cls._store_manager.uninstall_plugin(plugin_id)
        if success:
            cls._plugin_manager.discover_plugins()
            return {"status": "ok", "message": f"Uninstalled {plugin_id}"}
        return {"status": "error", "message": f"Failed to uninstall {plugin_id}"}
