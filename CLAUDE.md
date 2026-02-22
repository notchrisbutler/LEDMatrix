# LEDMatrix

## Project Structure
- `src/` — Core source (display_controller, managers, plugin_system/)
- `src/plugin_system/` — Plugin loader, manager, store manager, base plugin class
- `web_interface/` — Flask web UI (blueprints, templates, static JS)
- `config/config.json` — User plugin configuration (persists across plugin reinstalls)
- `config/config_secrets.json` — API keys and sensitive data (gitignored)
- `plugins/` — Installed plugins directory (gitignored)
- `plugin-repos/` — Development symlinks to monorepo plugin dirs
- `assets/` — Logos, fonts, static resources
- `test/` — Unit and integration tests
- `scripts/` — Dev, install, and diagnostic scripts
- `docs/` — Developer documentation

## Development Workflow

All dev commands go through the Makefile:

```bash
make setup          # Create venv + install all deps + pre-commit hooks
make run            # Run emulator mode
make web            # Run web interface
make run-all        # Run emulator + web together
make lint           # Lint with ruff
make lint-fix       # Auto-fix lint issues
make format         # Format with ruff
make check          # Run all quality checks
make test           # Run all tests
make test-unit      # Unit tests only
make test-cov       # Tests with coverage report
make clean          # Remove caches
make clean-all      # Remove caches + venv
make help           # Show all targets
```

Entry points: `python run.py --emulator` (display), `python web_interface/start.py` (web UI)

## Coding Standards

### Naming Conventions
- Classes: `PascalCase` (e.g., `NHLRecentManager`)
- Functions/variables: `snake_case` (e.g., `fetch_game_data`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `ESPN_NHL_SCOREBOARD_URL`)
- Private methods: leading underscore (e.g., `_fetch_data`)

### Principles
- Simplicity first — clear, readable code over clever optimizations
- Explicit over implicit — make intentions clear through naming
- Fail fast — validate inputs and handle errors early
- Catch specific exceptions, never bare `except:`
- Type hints for function parameters and return values

### Linting and Formatting
- **ruff** is the only linter/formatter — no flake8, no mypy
- Run `make lint` and `make format` before committing
- Config in `ruff.toml`: Python 3.10 target, 120 char line length
- Rule sets: E, F, B (bugbear), I (isort), UP (pyupgrade), W

## Git Workflow

### Branch Naming
- `feature/description` — new features
- `fix/description` — bug fixes
- `hotfix/critical-issue` — urgent production fixes
- `refactor/description` — code restructuring

### Commit Messages
Format: `type(scope): description`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(nhl): add enhanced logging for data visibility`
- `fix(display): resolve rendering performance issue`

### Pull Requests
- Squash and merge preferred for feature branches
- Self-review before requesting review
- Keep branches small and focused
- Delete feature branches after merge

## Error Handling and Logging
- Use `self.logger` (from `get_logger()` in `src.logging_config`), NOT `logging.getLogger()`
- Structured prefixes: `[NHL Recent]`, `[NFL Live]`, etc.
- Log levels: `info` (normal ops), `debug` (troubleshooting), `warning` (non-critical), `error` (needs attention)
- Graceful degradation: fall back to cached data on API failure
- User-friendly messages: explain what went wrong and suggest solutions
- Off-season awareness: provide context when no games available

## Testing

Tests live in `test/` and use pytest. Config in `pytest.ini`.

```bash
make test              # All tests
make test-unit         # pytest -m unit
make test-integration  # pytest -m integration
make test-cov          # With coverage report (min 30%)
```

### Markers
`unit`, `integration`, `hardware`, `slow`, `plugin`

### Principles
- Test behavior, not implementation
- Mock external dependencies (APIs, display manager, cache manager)
- Test edge cases: empty data, API failures, config errors
- Descriptive test names, single responsibility per test
- Independent tests with clean setup/teardown

## Configuration Management
- Main config: `config/config.json` — plugin settings (gitignored)
- Secrets: `config/config_secrets.json` — API keys (gitignored)
- Template: `config/config.template.json` — defaults
- Validate required fields and types on startup
- Provide sensible defaults in code, not just config
- Never commit secrets to version control

## Plugin System

### Architecture
- Plugins inherit from `BasePlugin` in `src/plugin_system/base_plugin.py`
- Required abstract methods: `update()`, `display(force_clear=False)`
- Each plugin needs: `manifest.json`, `config_schema.json`, `manager.py`, `requirements.txt`
- Plugin instantiation args: `plugin_id, config, display_manager, cache_manager, plugin_manager`
- Config schemas use JSON Schema Draft-7
- Display dimensions: read dynamically from `self.display_manager.matrix.width/height`
- Use `/plugin-scaffold` skill to create new plugins

### Plugin Store
- Official plugins live in the `ledmatrix-plugins` monorepo (not individual repos)
- `plugins.json` registry at `https://raw.githubusercontent.com/ChuckBuilds/ledmatrix-plugins/main/plugins.json`
- Store manager (`src/plugin_system/store_manager.py`) handles install/update/uninstall
- Plugin configs stored in `config/config.json`, NOT in plugin directories
- Update detection uses version comparison (manifest vs registry latest_version)
- Third-party plugins can use their own repo URL with empty `plugin_path`

### Plugin Dev Workflow
```bash
make plugin-link NAME=my-plugin DIR=../ledmatrix-my-plugin
make plugin-list
make run              # Test with emulator
make plugin-unlink NAME=my-plugin
```

### Version Management
- Automatic via pre-push git hook (bumps patch version, creates tag)
- Plugin store checks: GitHub Releases > Tags > Manifest > Commit hash
- Manual bumps only for major/minor: `scripts/bump_plugin_version.py`

## Raspberry Pi Constraints
- Target hardware: Raspberry Pi with rpi-rgb-led-matrix
- Optimize for limited RAM and CPU
- Use `cache_manager` for data persistence and API response caching
- Background services for non-blocking data fetching
- Minimize unnecessary display redraws
- Development uses emulator (`make run`), Pi receives updates via git pull
- Production services: `ledmatrix.service`, `ledmatrix-web.service` (systemd)

## API Quick Reference

```python
# Display Manager
display_manager.clear()
display_manager.draw_text("Hello", x=10, y=16, color=(255, 255, 255))
display_manager.draw_image(image, x=0, y=0)
display_manager.update_display()
width, height = display_manager.width, display_manager.height

# Cache Manager
cached = cache_manager.get("key", max_age=3600)
cache_manager.set("key", data, ttl=3600)
cache_manager.delete("key")

# Plugin Manager
plugin = plugin_manager.get_plugin("plugin-id")
all_plugins = plugin_manager.get_all_plugins()
```

## Common Pitfalls
- paho-mqtt 2.x needs `callback_api_version=mqtt.CallbackAPIVersion.VERSION1` for v1 compat
- BasePlugin uses `get_logger()` from `src.logging_config`, not standard `logging.getLogger()`
- When modifying a plugin in the monorepo, you MUST bump `version` in its `manifest.json` and run `python update_registry.py`
- Plugin `id` in manifest.json must match the directory name
- Always call `display_manager.update_display()` after drawing
- Store secrets in `config/config_secrets.json`, not main config
