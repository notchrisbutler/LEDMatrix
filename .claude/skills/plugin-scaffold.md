---
name: plugin-scaffold
description: Scaffold a new LEDMatrix plugin with all required files
user_invocable: true
---

# Plugin Scaffold

Create a new LEDMatrix plugin with all required boilerplate files.

## Process

1. **Gather information** — Ask the user (use AskUserQuestion) for:
   - Plugin ID (kebab-case, e.g., `weather-forecast`)
   - Plugin display name (e.g., "Weather Forecast")
   - Python class name (PascalCase, e.g., `WeatherForecastPlugin`)
   - Brief description
   - Category (one of: sports, weather, news, entertainment, utility, custom)
   - Whether it needs an API key
   - Target directory (default: `plugins/<plugin-id>/`)

2. **Generate files** — Create these files in the target directory:

### manifest.json
```json
{
  "id": "<PLUGIN_ID>",
  "name": "<PLUGIN_NAME>",
  "version": "1.0.0",
  "author": "ChuckBuilds",
  "description": "<DESCRIPTION>",
  "entry_point": "manager.py",
  "class_name": "<CLASS_NAME>",
  "category": "<CATEGORY>",
  "tags": ["<CATEGORY>"],
  "icon": "fas fa-puzzle-piece",
  "compatible_versions": [">=2.0.0"],
  "requires": {
    "python": ">=3.10",
    "display_size": { "min_width": 64, "min_height": 32 }
  },
  "config_schema": "config_schema.json",
  "update_interval": 60,
  "default_duration": 15,
  "display_modes": ["<PLUGIN_ID>"]
}
```

### manager.py
```python
"""
<PLUGIN_NAME>

<DESCRIPTION>
"""

from src.plugin_system.base_plugin import BasePlugin
import time


class <CLASS_NAME>(BasePlugin):
    """<DESCRIPTION>"""

    def __init__(self, plugin_id, config, display_manager, cache_manager, plugin_manager):
        super().__init__(plugin_id, config, display_manager, cache_manager, plugin_manager)
        self.data = None
        self.last_update_time = None
        self.refresh_interval = config.get("refresh_interval", 60)
        self.logger.info(f"Plugin {plugin_id} initialized")

    def update(self):
        cache_key = f"{self.plugin_id}_data"
        cached = self.cache_manager.get(cache_key, max_age=self.refresh_interval)
        if cached:
            self.data = cached
            return

        try:
            self.data = self._fetch_data()
            self.cache_manager.set(cache_key, self.data, ttl=self.refresh_interval)
            self.last_update_time = time.time()
        except Exception as e:
            self.logger.error(f"Failed to update data: {e}")
            expired = self.cache_manager.get(cache_key, max_age=31536000)
            if expired:
                self.data = expired

    def display(self, force_clear=False):
        if force_clear:
            self.display_manager.clear()
        if not self.data:
            self._display_error("No data available")
            return
        try:
            self._render_content()
            self.display_manager.update_display()
        except Exception as e:
            self.logger.error(f"Display error: {e}")
            self._display_error("Display error")

    def _fetch_data(self):
        # TODO: Implement data fetching
        return {"message": "Hello from <PLUGIN_NAME>!", "timestamp": time.time()}

    def _render_content(self):
        width = self.display_manager.width
        height = self.display_manager.height
        text = self.data.get("message", "No data")
        self.display_manager.draw_text(text, x=5, y=height // 2, color=(255, 255, 255))

    def _display_error(self, message):
        self.display_manager.clear()
        height = self.display_manager.height
        self.display_manager.draw_text(message, x=5, y=height // 2, color=(255, 0, 0))
        self.display_manager.update_display()

    def validate_config(self):
        if not super().validate_config():
            return False
        return True
```

### config_schema.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "<PLUGIN_NAME> Configuration",
  "description": "Configuration for <PLUGIN_NAME>",
  "properties": {
    "enabled": { "type": "boolean", "default": true, "description": "Enable or disable this plugin" },
    "display_duration": { "type": "number", "default": 15, "minimum": 1, "maximum": 300, "description": "Display duration in seconds" },
    "live_priority": { "type": "boolean", "default": false, "description": "Enable live priority takeover" },
    "refresh_interval": { "type": "integer", "default": 60, "minimum": 1, "description": "Data refresh interval in seconds" }
  },
  "required": ["enabled"],
  "additionalProperties": false
}
```

If user said they need an API key, add to config_schema.json properties:
```json
"api_key": { "type": "string", "default": "", "description": "API key (store in config_secrets.json)" }
```

### requirements.txt
```
# Plugin dependencies
# Core LEDMatrix deps (Pillow, requests, etc.) are already available
```

3. **Enable in config** — Tell the user to add to `config/config.json`:
```json
"<PLUGIN_ID>": { "enabled": true }
```

4. **Next steps** — Tell the user:
- Edit `_fetch_data()` in `manager.py` to implement data fetching
- Edit `_render_content()` to customize display rendering
- Run `make run` to test with the emulator
- See `docs/DEVELOPER_QUICK_REFERENCE.md` for API reference
