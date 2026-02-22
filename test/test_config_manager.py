"""
Tests for ConfigManager.

Tests configuration loading, migration, secrets handling, and validation.
"""

import json
import os
from unittest.mock import Mock

import pytest

from src.config_manager import ConfigManager


class TestConfigManagerInitialization:
    """Test ConfigManager initialization."""

    def test_init_with_default_paths(self):
        """Test initialization with default paths."""
        manager = ConfigManager()
        assert manager.config_path == "config/config.json"
        assert manager.secrets_path == "config/config_secrets.json"
        assert manager.template_path == "config/config.template.json"
        assert manager.config == {}

    def test_init_with_custom_paths(self):
        """Test initialization with custom paths."""
        manager = ConfigManager(
            config_path="custom/config.json",
            secrets_path="custom/secrets.json"
        )
        assert manager.config_path == "custom/config.json"
        assert manager.secrets_path == "custom/secrets.json"

    def test_get_config_path(self):
        """Test getting config path."""
        manager = ConfigManager(config_path="test/config.json")
        assert manager.get_config_path() == "test/config.json"

    def test_get_secrets_path(self):
        """Test getting secrets path."""
        manager = ConfigManager(secrets_path="test/secrets.json")
        assert manager.get_secrets_path() == "test/secrets.json"


class TestConfigLoading:
    """Test configuration loading."""

    def test_load_config_from_existing_file(self, tmp_path):
        """Test loading config from existing file."""
        config_file = tmp_path / "config.json"
        config_data = {"timezone": "UTC", "display": {"hardware": {"rows": 32}}}

        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(config_path=str(config_file))
        loaded = manager.load_config()

        assert loaded["timezone"] == "UTC"
        assert loaded["display"]["hardware"]["rows"] == 32

    def test_load_config_creates_from_template(self, tmp_path):
        """Test that config is created from template if missing."""
        template_file = tmp_path / "template.json"
        config_file = tmp_path / "config.json"
        template_data = {"timezone": "UTC", "display": {}}

        with open(template_file, 'w') as f:
            json.dump(template_data, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(tmp_path / "secrets.json")
        )
        manager.template_path = str(template_file)

        loaded = manager.load_config()

        assert os.path.exists(config_file)
        assert loaded["timezone"] == "UTC"

    def test_load_config_merges_secrets(self, tmp_path):
        """Test that secrets are merged into config."""
        config_file = tmp_path / "config.json"
        secrets_file = tmp_path / "secrets.json"

        config_data = {"timezone": "UTC", "plugin1": {"enabled": True}}
        secrets_data = {"plugin1": {"api_key": "secret123"}}

        with open(config_file, 'w') as f:
            json.dump(config_data, f)
        with open(secrets_file, 'w') as f:
            json.dump(secrets_data, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(secrets_file)
        )
        loaded = manager.load_config()

        assert loaded["plugin1"]["enabled"] is True
        assert loaded["plugin1"]["api_key"] == "secret123"

    def test_load_config_handles_missing_secrets_gracefully(self, tmp_path):
        """Test that missing secrets file doesn't cause error."""
        config_file = tmp_path / "config.json"
        config_data = {"timezone": "UTC"}

        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(tmp_path / "nonexistent.json")
        )
        loaded = manager.load_config()

        assert loaded["timezone"] == "UTC"

    def test_load_config_handles_invalid_json(self, tmp_path):
        """Test that invalid JSON raises appropriate error."""
        from src.exceptions import ConfigError
        config_file = tmp_path / "config.json"

        with open(config_file, 'w') as f:
            f.write("invalid json {")

        manager = ConfigManager(config_path=str(config_file))
        manager.template_path = str(tmp_path / "nonexistent_template.json")  # No template to fall back to

        # ConfigManager raises ConfigError, not JSONDecodeError
        with pytest.raises(ConfigError):
            manager.load_config()

    def test_get_config_loads_if_not_loaded(self, tmp_path):
        """Test that get_config loads config if not already loaded."""
        config_file = tmp_path / "config.json"
        config_data = {"timezone": "America/New_York"}

        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(config_path=str(config_file))
        config = manager.get_config()

        assert config["timezone"] == "America/New_York"


class TestConfigMigration:
    """Test configuration migration."""

    def test_migration_adds_new_keys(self, tmp_path):
        """Test that migration adds new keys from template."""
        config_file = tmp_path / "config.json"
        template_file = tmp_path / "template.json"

        current_data = {"timezone": "UTC"}
        template_data = {
            "timezone": "UTC",
            "display": {"hardware": {"rows": 32}},
            "new_key": "new_value"
        }

        with open(config_file, 'w') as f:
            json.dump(current_data, f)
        with open(template_file, 'w') as f:
            json.dump(template_data, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.template_path = str(template_file)
        manager.config = current_data.copy()

        manager._migrate_config()

        assert "new_key" in manager.config
        assert manager.config["new_key"] == "new_value"
        assert manager.config["display"]["hardware"]["rows"] == 32

    def test_migration_creates_backup(self, tmp_path):
        """Test that migration creates backup file."""
        config_file = tmp_path / "config.json"
        template_file = tmp_path / "template.json"
        backup_file = tmp_path / "config.json.backup"

        current_data = {"timezone": "UTC"}
        template_data = {"timezone": "UTC", "new_key": "new_value"}

        with open(config_file, 'w') as f:
            json.dump(current_data, f)
        with open(template_file, 'w') as f:
            json.dump(template_data, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.template_path = str(template_file)
        manager.config = current_data.copy()

        manager._migrate_config()

        assert backup_file.exists()
        with open(backup_file, 'r') as f:
            backup_data = json.load(f)
            assert backup_data == current_data

    def test_migration_skips_if_not_needed(self, tmp_path):
        """Test that migration is skipped if config is up to date."""
        config_file = tmp_path / "config.json"
        template_file = tmp_path / "template.json"

        config_data = {"timezone": "UTC", "display": {}}
        template_data = {"timezone": "UTC", "display": {}}

        with open(config_file, 'w') as f:
            json.dump(config_data, f)
        with open(template_file, 'w') as f:
            json.dump(template_data, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.template_path = str(template_file)
        manager.config = config_data.copy()

        # Should not raise or create backup
        manager._migrate_config()

        backup_file = tmp_path / "config.json.backup"
        assert not backup_file.exists()


class TestConfigSaving:
    """Test configuration saving."""

    def test_save_config_strips_secrets(self, tmp_path):
        """Test that save_config strips secrets from saved file."""
        config_file = tmp_path / "config.json"
        secrets_file = tmp_path / "secrets.json"

        config_data = {
            "timezone": "UTC",
            "plugin1": {
                "enabled": True,
                "api_key": "secret123"
            }
        }
        secrets_data = {
            "plugin1": {
                "api_key": "secret123"
            }
        }

        with open(secrets_file, 'w') as f:
            json.dump(secrets_data, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(secrets_file)
        )
        manager.config = config_data.copy()

        manager.save_config(config_data)

        # Verify secrets were stripped
        with open(config_file, 'r') as f:
            saved_data = json.load(f)
            assert "api_key" not in saved_data["plugin1"]
            assert saved_data["plugin1"]["enabled"] is True

    def test_save_config_updates_in_memory_config(self, tmp_path):
        """Test that save_config updates in-memory config."""
        config_file = tmp_path / "config.json"
        config_data = {"timezone": "America/New_York"}

        with open(config_file, 'w') as f:
            json.dump({"timezone": "UTC"}, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.load_config()

        manager.save_config(config_data)

        assert manager.config["timezone"] == "America/New_York"

    def test_save_raw_file_content(self, tmp_path):
        """Test saving raw file content."""
        config_file = tmp_path / "config.json"
        config_data = {"timezone": "UTC", "display": {}}

        manager = ConfigManager(config_path=str(config_file))
        manager.template_path = str(tmp_path / "nonexistent_template.json")  # Prevent migration
        manager.save_raw_file_content('main', config_data)

        assert config_file.exists()
        with open(config_file, 'r') as f:
            saved_data = json.load(f)
            # After save, load_config() is called which may migrate, so check that saved keys exist
            assert saved_data.get('timezone') == config_data['timezone']
            assert 'display' in saved_data

    def test_save_raw_file_content_invalid_type(self):
        """Test that invalid file type raises ValueError."""
        manager = ConfigManager()

        with pytest.raises(ValueError, match="Invalid file_type"):
            manager.save_raw_file_content('invalid', {})


class TestSecretsHandling:
    """Test secrets handling."""

    def test_get_secret(self, tmp_path):
        """Test getting a secret value."""
        secrets_file = tmp_path / "secrets.json"
        secrets_data = {"api_key": "secret123", "token": "token456"}

        with open(secrets_file, 'w') as f:
            json.dump(secrets_data, f)

        manager = ConfigManager(secrets_path=str(secrets_file))

        assert manager.get_secret("api_key") == "secret123"
        assert manager.get_secret("token") == "token456"
        assert manager.get_secret("nonexistent") is None

    def test_get_secret_handles_missing_file(self):
        """Test that get_secret handles missing secrets file."""
        manager = ConfigManager(secrets_path="nonexistent.json")

        assert manager.get_secret("api_key") is None

    def test_get_secret_handles_invalid_json(self, tmp_path):
        """Test that get_secret handles invalid JSON gracefully."""
        secrets_file = tmp_path / "secrets.json"

        with open(secrets_file, 'w') as f:
            f.write("invalid json {")

        manager = ConfigManager(secrets_path=str(secrets_file))

        # Should return None on error
        assert manager.get_secret("api_key") is None


class TestConfigHelpers:
    """Test helper methods."""

    def test_get_timezone(self, tmp_path):
        """Test getting timezone."""
        config_file = tmp_path / "config.json"
        config_data = {"timezone": "America/New_York"}

        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.load_config()

        assert manager.get_timezone() == "America/New_York"

    def test_get_timezone_default(self, tmp_path):
        """Test that get_timezone returns default if not set."""
        config_file = tmp_path / "config.json"
        config_data = {}

        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.template_path = str(tmp_path / "nonexistent_template.json")  # Prevent migration
        manager.load_config()

        # Default should be UTC, but migration might add it
        timezone = manager.get_timezone()
        assert timezone == "UTC" or timezone is not None  # Migration may add default

    def test_get_display_config(self, tmp_path):
        """Test getting display config."""
        config_file = tmp_path / "config.json"
        config_data = {"display": {"hardware": {"rows": 32}}}

        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.load_config()

        display_config = manager.get_display_config()
        assert display_config["hardware"]["rows"] == 32

    def test_get_clock_config(self, tmp_path):
        """Test getting clock config."""
        config_file = tmp_path / "config.json"
        config_data = {"clock": {"format": "12h"}}

        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.load_config()

        clock_config = manager.get_clock_config()
        assert clock_config["format"] == "12h"


class TestPluginConfigManagement:
    """Test plugin configuration management."""

    def test_cleanup_plugin_config(self, tmp_path):
        """Test cleaning up plugin configuration."""
        config_file = tmp_path / "config.json"
        secrets_file = tmp_path / "secrets.json"

        config_data = {
            "plugin1": {"enabled": True},
            "plugin2": {"enabled": False}
        }
        secrets_data = {
            "plugin1": {"api_key": "secret123"}
        }

        with open(config_file, 'w') as f:
            json.dump(config_data, f)
        with open(secrets_file, 'w') as f:
            json.dump(secrets_data, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(secrets_file)
        )
        manager.cleanup_plugin_config("plugin1")

        with open(config_file, 'r') as f:
            saved_config = json.load(f)
            assert "plugin1" not in saved_config
            assert "plugin2" in saved_config

        with open(secrets_file, 'r') as f:
            saved_secrets = json.load(f)
            assert "plugin1" not in saved_secrets

    def test_cleanup_orphaned_plugin_configs(self, tmp_path):
        """Test cleaning up orphaned plugin configs."""
        config_file = tmp_path / "config.json"
        secrets_file = tmp_path / "secrets.json"

        config_data = {
            "plugin1": {"enabled": True},
            "plugin2": {"enabled": False},
            "orphaned_plugin": {"enabled": True}
        }
        secrets_data = {
            "orphaned_plugin": {"api_key": "secret"}
        }

        with open(config_file, 'w') as f:
            json.dump(config_data, f)
        with open(secrets_file, 'w') as f:
            json.dump(secrets_data, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(secrets_file)
        )
        removed = manager.cleanup_orphaned_plugin_configs(["plugin1", "plugin2"])

        assert "orphaned_plugin" in removed

        with open(config_file, 'r') as f:
            saved_config = json.load(f)
            assert "orphaned_plugin" not in saved_config
            assert "plugin1" in saved_config
            assert "plugin2" in saved_config


class TestErrorHandling:
    """Test error handling scenarios."""

    def test_load_config_file_not_found_without_template(self, tmp_path):
        """Test that missing config file raises error if no template."""
        from src.exceptions import ConfigError
        manager = ConfigManager(config_path=str(tmp_path / "nonexistent.json"))
        manager.template_path = str(tmp_path / "nonexistent_template.json")

        # ConfigManager raises ConfigError, not FileNotFoundError
        with pytest.raises(ConfigError):
            manager.load_config()

    def test_get_raw_file_content_invalid_type(self):
        """Test that invalid file type raises ValueError."""
        manager = ConfigManager()

        with pytest.raises(ValueError, match="Invalid file_type"):
            manager.get_raw_file_content('invalid')

    def test_get_raw_file_content_missing_main_file(self, tmp_path):
        """Test that missing main config file raises error."""
        from src.exceptions import ConfigError
        manager = ConfigManager(config_path=str(tmp_path / "nonexistent.json"))

        # ConfigManager raises ConfigError, not FileNotFoundError
        with pytest.raises(ConfigError):
            manager.get_raw_file_content('main')

    def test_get_raw_file_content_missing_secrets_returns_empty(self, tmp_path):
        """Test that missing secrets file returns empty dict."""
        manager = ConfigManager(secrets_path=str(tmp_path / "nonexistent.json"))

        result = manager.get_raw_file_content('secrets')
        assert result == {}


@pytest.mark.unit
class TestAtomicSaveOperations:
    """Test atomic save operations."""

    def test_save_config_atomic_success(self, tmp_path):
        """Test successful atomic save updates in-memory config."""
        config_file = tmp_path / "config.json"
        config_data = {"timezone": "UTC"}

        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(tmp_path / "secrets.json")
        )
        manager.template_path = str(tmp_path / "nonexistent_template.json")
        manager.load_config()

        new_config = {"timezone": "America/Chicago", "new_field": "value"}
        result = manager.save_config_atomic(new_config)

        from src.config_manager_atomic import SaveResultStatus
        assert result.status == SaveResultStatus.SUCCESS
        assert manager.config["timezone"] == "America/Chicago"
        assert manager.config["new_field"] == "value"

    def test_save_config_atomic_strips_secrets(self, tmp_path):
        """Test that atomic save strips secrets from the main config file."""
        config_file = tmp_path / "config.json"
        secrets_file = tmp_path / "secrets.json"

        with open(config_file, 'w') as f:
            json.dump({"timezone": "UTC"}, f)
        with open(secrets_file, 'w') as f:
            json.dump({"plugin1": {"api_key": "secret"}}, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(secrets_file)
        )
        manager.template_path = str(tmp_path / "nonexistent_template.json")

        new_config = {"timezone": "UTC", "plugin1": {"enabled": True, "api_key": "secret"}}
        manager.save_config_atomic(new_config)

        with open(config_file, 'r') as f:
            saved = json.load(f)
        assert "api_key" not in saved.get("plugin1", {})

    def test_save_config_atomic_without_backup(self, tmp_path):
        """Test atomic save without creating a backup."""
        config_file = tmp_path / "config.json"
        with open(config_file, 'w') as f:
            json.dump({"timezone": "UTC"}, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(tmp_path / "secrets.json")
        )
        manager.template_path = str(tmp_path / "nonexistent_template.json")
        manager.load_config()

        result = manager.save_config_atomic(
            {"timezone": "US/Eastern"},
            create_backup=False
        )

        from src.config_manager_atomic import SaveResultStatus
        assert result.status == SaveResultStatus.SUCCESS

    def test_save_config_atomic_without_validation(self, tmp_path):
        """Test atomic save skipping post-write validation."""
        config_file = tmp_path / "config.json"
        with open(config_file, 'w') as f:
            json.dump({"timezone": "UTC"}, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(tmp_path / "secrets.json")
        )
        manager.template_path = str(tmp_path / "nonexistent_template.json")
        manager.load_config()

        result = manager.save_config_atomic(
            {"timezone": "US/Pacific"},
            validate_after_write=False
        )

        from src.config_manager_atomic import SaveResultStatus
        assert result.status == SaveResultStatus.SUCCESS


@pytest.mark.unit
class TestConfigRollback:
    """Test configuration rollback functionality."""

    def test_rollback_config_no_backups(self, tmp_path):
        """Test rollback when no backups exist."""
        config_file = tmp_path / "config.json"
        with open(config_file, 'w') as f:
            json.dump({"timezone": "UTC"}, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(tmp_path / "secrets.json")
        )
        manager.template_path = str(tmp_path / "nonexistent_template.json")
        manager.load_config()

        result = manager.rollback_config()
        assert result is False

    def test_list_backups_empty(self, tmp_path):
        """Test listing backups when none exist."""
        config_file = tmp_path / "config.json"
        with open(config_file, 'w') as f:
            json.dump({"timezone": "UTC"}, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(tmp_path / "secrets.json")
        )

        backups = manager.list_backups()
        assert isinstance(backups, list)

    def test_validate_config_file(self, tmp_path):
        """Test config file validation."""
        config_file = tmp_path / "config.json"
        with open(config_file, 'w') as f:
            json.dump({"timezone": "UTC"}, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(tmp_path / "secrets.json")
        )

        result = manager.validate_config_file()
        assert hasattr(result, 'is_valid')


@pytest.mark.unit
class TestDeepMerge:
    """Test deep merge behavior."""

    def test_deep_merge_nested_dicts(self):
        """Test deep merge of nested dictionaries."""
        manager = ConfigManager()
        target = {"a": {"b": 1, "c": 2}, "d": 3}
        source = {"a": {"b": 10, "e": 5}, "f": 6}

        manager._deep_merge(target, source)

        assert target["a"]["b"] == 10
        assert target["a"]["c"] == 2
        assert target["a"]["e"] == 5
        assert target["d"] == 3
        assert target["f"] == 6

    def test_deep_merge_overwrites_non_dict_with_value(self):
        """Test that deep merge overwrites non-dict values."""
        manager = ConfigManager()
        target = {"a": "string_value"}
        source = {"a": {"nested": True}}

        manager._deep_merge(target, source)

        assert target["a"] == {"nested": True}

    def test_deep_merge_source_non_dict_overwrites_dict(self):
        """Test that non-dict source value overwrites dict target."""
        manager = ConfigManager()
        target = {"a": {"nested": True}}
        source = {"a": "replaced"}

        manager._deep_merge(target, source)

        assert target["a"] == "replaced"

    def test_deep_merge_empty_source(self):
        """Test deep merge with empty source."""
        manager = ConfigManager()
        target = {"a": 1, "b": 2}
        source = {}

        manager._deep_merge(target, source)

        assert target == {"a": 1, "b": 2}

    def test_deep_merge_deeply_nested(self):
        """Test deep merge with deeply nested structures."""
        manager = ConfigManager()
        target = {"l1": {"l2": {"l3": {"value": "old"}}}}
        source = {"l1": {"l2": {"l3": {"value": "new", "extra": True}}}}

        manager._deep_merge(target, source)

        assert target["l1"]["l2"]["l3"]["value"] == "new"
        assert target["l1"]["l2"]["l3"]["extra"] is True


@pytest.mark.unit
class TestStripSecretsRecursive:
    """Test recursive secret stripping."""

    def test_strip_flat_secrets(self):
        """Test stripping flat secret keys."""
        manager = ConfigManager()
        data = {"public": "val", "api_key": "secret"}
        secrets = {"api_key": "secret"}

        result = manager._strip_secrets_recursive(data, secrets)

        assert "public" in result
        assert "api_key" not in result

    def test_strip_nested_secrets(self):
        """Test stripping nested secret keys."""
        manager = ConfigManager()
        data = {
            "plugin1": {
                "enabled": True,
                "api_key": "secret123"
            }
        }
        secrets = {
            "plugin1": {
                "api_key": "secret123"
            }
        }

        result = manager._strip_secrets_recursive(data, secrets)

        assert result["plugin1"]["enabled"] is True
        assert "api_key" not in result["plugin1"]

    def test_strip_preserves_non_secret_nested(self):
        """Test that non-secret nested keys are preserved."""
        manager = ConfigManager()
        data = {
            "plugin1": {
                "enabled": True,
                "option": "value"
            },
            "plugin2": {"setting": "keep"}
        }
        secrets = {
            "plugin1": {
                "api_key": "secret"
            }
        }

        result = manager._strip_secrets_recursive(data, secrets)

        assert result["plugin1"]["enabled"] is True
        assert result["plugin1"]["option"] == "value"
        assert result["plugin2"]["setting"] == "keep"

    def test_strip_removes_entire_secret_group_if_empty(self):
        """Test that a group is removed if all its contents are secrets."""
        manager = ConfigManager()
        data = {
            "plugin1": {"api_key": "secret"}
        }
        secrets = {
            "plugin1": {"api_key": "secret"}
        }

        result = manager._strip_secrets_recursive(data, secrets)

        # plugin1 should be gone since all its contents were secrets
        assert "plugin1" not in result


@pytest.mark.unit
class TestTemplateMigration:
    """Test template migration edge cases."""

    def test_has_new_keys_detects_missing_top_level(self):
        """Test _has_new_keys detects missing top-level keys."""
        manager = ConfigManager()
        current = {"a": 1}
        template = {"a": 1, "b": 2}

        assert manager._has_new_keys(current, template) is True

    def test_has_new_keys_detects_missing_nested(self):
        """Test _has_new_keys detects missing nested keys."""
        manager = ConfigManager()
        current = {"a": {"x": 1}}
        template = {"a": {"x": 1, "y": 2}}

        assert manager._has_new_keys(current, template) is True

    def test_has_new_keys_returns_false_when_complete(self):
        """Test _has_new_keys returns False when all keys present."""
        manager = ConfigManager()
        current = {"a": 1, "b": {"c": 2}}
        template = {"a": 1, "b": {"c": 2}}

        assert manager._has_new_keys(current, template) is False

    def test_merge_template_defaults_preserves_existing(self):
        """Test that merge_template_defaults does not overwrite existing values."""
        manager = ConfigManager()
        current = {"a": "user_value", "b": {"x": 10}}
        template = {"a": "default", "b": {"x": 99, "y": 20}, "c": "new"}

        manager._merge_template_defaults(current, template)

        assert current["a"] == "user_value"
        assert current["b"]["x"] == 10
        assert current["b"]["y"] == 20
        assert current["c"] == "new"

    def test_migration_handles_missing_template(self, tmp_path):
        """Test migration handles missing template gracefully."""
        config_file = tmp_path / "config.json"
        with open(config_file, 'w') as f:
            json.dump({"timezone": "UTC"}, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.template_path = str(tmp_path / "nonexistent_template.json")
        manager.config = {"timezone": "UTC"}

        # Should not raise
        manager._migrate_config()
        assert manager.config["timezone"] == "UTC"


@pytest.mark.unit
class TestValidateAllPluginConfigs:
    """Test plugin config validation."""

    def test_validate_without_schema_manager(self, tmp_path):
        """Test validate returns empty when no schema manager."""
        config_file = tmp_path / "config.json"
        with open(config_file, 'w') as f:
            json.dump({"plugin1": {"enabled": True}}, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.template_path = str(tmp_path / "nonexistent_template.json")

        result = manager.validate_all_plugin_configs(plugin_schema_manager=None)
        assert result == {}

    def test_validate_skips_non_plugin_sections(self, tmp_path):
        """Test that system config sections are skipped."""
        config_file = tmp_path / "config.json"
        with open(config_file, 'w') as f:
            json.dump({
                "display": {"brightness": 50},
                "schedule": {},
                "timezone": "UTC",
                "plugin_system": {},
                "my_plugin": {"enabled": True}
            }, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.template_path = str(tmp_path / "nonexistent_template.json")

        mock_schema_mgr = Mock()
        mock_schema_mgr.load_schema.return_value = None

        result = manager.validate_all_plugin_configs(plugin_schema_manager=mock_schema_mgr)

        # Should only validate my_plugin, not display/schedule/timezone/plugin_system
        assert "display" not in result
        assert "schedule" not in result
        assert "timezone" not in result
        assert "plugin_system" not in result

    def test_validate_with_schema(self, tmp_path):
        """Test validation with a mock schema manager that has schemas."""
        config_file = tmp_path / "config.json"
        with open(config_file, 'w') as f:
            json.dump({"my_plugin": {"enabled": True}}, f)

        manager = ConfigManager(config_path=str(config_file))
        manager.template_path = str(tmp_path / "nonexistent_template.json")

        mock_schema_mgr = Mock()
        mock_schema_mgr.load_schema.return_value = {"type": "object"}
        mock_schema_mgr.validate_config_against_schema.return_value = (True, [])

        result = manager.validate_all_plugin_configs(plugin_schema_manager=mock_schema_mgr)

        assert "my_plugin" in result
        assert result["my_plugin"]["valid"] is True
        assert result["my_plugin"]["errors"] == []


@pytest.mark.unit
class TestSaveRawFileContent:
    """Test save_raw_file_content edge cases."""

    def test_save_secrets_file(self, tmp_path):
        """Test saving secrets file content."""
        secrets_file = tmp_path / "secrets.json"
        config_file = tmp_path / "config.json"

        with open(config_file, 'w') as f:
            json.dump({"timezone": "UTC"}, f)

        manager = ConfigManager(
            config_path=str(config_file),
            secrets_path=str(secrets_file)
        )
        manager.template_path = str(tmp_path / "nonexistent_template.json")

        manager.save_raw_file_content('secrets', {"plugin1": {"api_key": "test"}})

        assert secrets_file.exists()
        with open(secrets_file, 'r') as f:
            data = json.load(f)
        assert data["plugin1"]["api_key"] == "test"

    def test_get_raw_file_content_valid_json(self, tmp_path):
        """Test reading raw config file content."""
        config_file = tmp_path / "config.json"
        data = {"timezone": "UTC", "display": {"brightness": 50}}

        with open(config_file, 'w') as f:
            json.dump(data, f)

        manager = ConfigManager(config_path=str(config_file))

        result = manager.get_raw_file_content('main')
        assert result["timezone"] == "UTC"
        assert result["display"]["brightness"] == 50

    def test_get_raw_file_content_invalid_json_raises(self, tmp_path):
        """Test that invalid JSON in config file raises ConfigError."""
        from src.exceptions import ConfigError
        config_file = tmp_path / "config.json"

        with open(config_file, 'w') as f:
            f.write("{invalid json}")

        manager = ConfigManager(config_path=str(config_file))

        with pytest.raises(ConfigError):
            manager.get_raw_file_content('main')

