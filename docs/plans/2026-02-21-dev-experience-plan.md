# Dev Experience Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate all dev tooling into a Makefile + ruff + Claude Code workflow, migrating Cursor config into CLAUDE.md and skills, then removing Cursor files.

**Architecture:** Makefile as the single entry point for all dev commands. Ruff replaces flake8+mypy for linting/formatting. CLAUDE.md becomes the comprehensive project reference. Plugin scaffolding moves to a Claude Code skill.

**Tech Stack:** GNU Make, ruff, pytest, pyenv, Claude Code skills

---

### Task 1: Create ruff.toml

**Files:**
- Create: `ruff.toml`

**Step 1: Create ruff.toml**

```toml
# Ruff configuration for LEDMatrix
# Replaces flake8, flake8-bugbear, isort, and mypy

target-version = "py310"
line-length = 120

# Exclude directories that shouldn't be linted
exclude = [
    "plugins/",
    "plugin-repos/",
    "venv/",
    ".venv/",
    ".git/",
    "__pycache__/",
    "rpi-rgb-led-matrix-master/",
    "starlark-apps/",
]

[lint]
select = [
    "E",    # pycodestyle errors
    "F",    # pyflakes
    "B",    # flake8-bugbear
    "I",    # isort
    "UP",   # pyupgrade
    "W",    # pycodestyle warnings
]
ignore = [
    "E501",  # line too long (handled by formatter)
]

[lint.per-file-ignores]
"test/**/*.py" = ["B", "UP"]

[format]
quote-style = "double"
indent-style = "space"
```

**Step 2: Verify ruff runs cleanly**

Run: `ruff check . --config ruff.toml` (from project root)
Expected: Output showing any existing lint issues (informational, don't fix yet)

**Step 3: Commit**

```bash
git add ruff.toml
git commit -m "chore: add ruff configuration replacing flake8 and mypy"
```

---

### Task 2: Update .pre-commit-config.yaml

**Files:**
- Modify: `.pre-commit-config.yaml`

**Step 1: Replace flake8 and mypy hooks with ruff**

Replace the full file content with:

```yaml
# Pre-commit hooks for LEDMatrix
# Install: pip install pre-commit && pre-commit install
# Run manually: pre-commit run --all-files

repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-merge-conflict

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.9.7
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: local
    hooks:
      - id: no-bare-except
        name: Check for bare except clauses
        entry: bash -c 'if grep -rn "except:\s*pass" src/; then echo "Found bare except:pass - please handle exceptions properly"; exit 1; fi'
        language: system
        types: [python]
        pass_filenames: false

      - id: no-hardcoded-paths
        name: Check for hardcoded user paths
        entry: bash -c 'if grep -rn "/home/chuck/" src/; then echo "Found hardcoded user paths - please use relative paths or config"; exit 1; fi'
        language: system
        types: [python]
        pass_filenames: false
```

**Step 2: Commit**

```bash
git add .pre-commit-config.yaml
git commit -m "chore: replace flake8 and mypy with ruff in pre-commit hooks"
```

---

### Task 3: Update requirements.txt — remove mypy, add ruff

**Files:**
- Modify: `requirements.txt`

**Step 1: Replace mypy with ruff in requirements.txt**

Remove this line:
```
mypy>=1.5.0,<2.0.0
```

Add this line (in the testing dependencies section):
```
ruff>=0.9.0,<1.0.0
```

**Step 2: Commit**

```bash
git add requirements.txt
git commit -m "chore: replace mypy with ruff in requirements"
```

---

### Task 4: Create the Makefile

**Files:**
- Create: `Makefile`

**Step 1: Write the Makefile**

```makefile
# LEDMatrix Development Makefile
# Run `make help` to see available targets

.DEFAULT_GOAL := help

PYTHON_VERSION := 3.12
VENV := venv
VENV_BIN := $(VENV)/bin
PYTHON := $(VENV_BIN)/python
PIP := $(VENV_BIN)/pip
RUFF := $(VENV_BIN)/ruff
PYTEST := $(VENV_BIN)/pytest
PRECOMMIT := $(VENV_BIN)/pre-commit

# ── Setup ────────────────────────────────────────────────────────────

.PHONY: setup
setup: venv install hooks ## Full dev setup: venv + deps + pre-commit hooks

.PHONY: venv
venv: ## Create Python virtual environment
	@if [ ! -d "$(VENV)" ]; then \
		echo "Creating venv with Python $(PYTHON_VERSION)..."; \
		python$(PYTHON_VERSION) -m venv $(VENV); \
		echo "venv created."; \
	else \
		echo "venv already exists."; \
	fi

.PHONY: install
install: ## Install all dependencies into venv
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	$(PIP) install -r requirements-emulator.txt
	$(PIP) install -r web_interface/requirements.txt
	@echo "All dependencies installed."

.PHONY: hooks
hooks: ## Install pre-commit hooks
	$(PIP) install pre-commit
	$(PRECOMMIT) install
	@echo "Pre-commit hooks installed."

# ── Run ──────────────────────────────────────────────────────────────

.PHONY: run
run: ## Run LED matrix in emulator mode
	EMULATOR=true $(PYTHON) run.py

.PHONY: web
web: ## Run the web interface
	$(PYTHON) web_interface/start.py

.PHONY: run-all
run-all: ## Run emulator + web interface together
	@echo "Starting emulator and web interface..."
	EMULATOR=true $(PYTHON) run.py & \
	$(PYTHON) web_interface/start.py & \
	wait

# ── Quality ──────────────────────────────────────────────────────────

.PHONY: lint
lint: ## Run ruff linter
	$(RUFF) check .

.PHONY: lint-fix
lint-fix: ## Run ruff linter with auto-fix
	$(RUFF) check --fix .

.PHONY: format
format: ## Format code with ruff
	$(RUFF) format .

.PHONY: format-check
format-check: ## Check formatting without changes
	$(RUFF) format --check .

.PHONY: check
check: lint format-check ## Run all quality checks (lint + format)

# ── Test ─────────────────────────────────────────────────────────────

.PHONY: test
test: ## Run all tests
	$(PYTEST)

.PHONY: test-unit
test-unit: ## Run unit tests only
	$(PYTEST) -m unit

.PHONY: test-integration
test-integration: ## Run integration tests only
	$(PYTEST) -m integration

.PHONY: test-cov
test-cov: ## Run tests with HTML coverage report
	$(PYTEST) --cov=src --cov-report=html --cov-report=term-missing
	@echo "Coverage report: htmlcov/index.html"

# ── Plugin Development ───────────────────────────────────────────────

.PHONY: plugin-link
plugin-link: ## Link a plugin for development (NAME=<id> PATH=<path>)
	@if [ -z "$(NAME)" ]; then echo "Usage: make plugin-link NAME=<plugin-id> PATH=<path>"; exit 1; fi
	@if [ -z "$(PATH)" ]; then echo "Usage: make plugin-link NAME=<plugin-id> PATH=<path>"; exit 1; fi
	./scripts/dev/dev_plugin_setup.sh link $(NAME) $(PATH)

.PHONY: plugin-unlink
plugin-unlink: ## Unlink a development plugin (NAME=<id>)
	@if [ -z "$(NAME)" ]; then echo "Usage: make plugin-unlink NAME=<plugin-id>"; exit 1; fi
	./scripts/dev/dev_plugin_setup.sh unlink $(NAME)

.PHONY: plugin-list
plugin-list: ## List linked development plugins
	./scripts/dev/dev_plugin_setup.sh list

# ── Maintenance ──────────────────────────────────────────────────────

.PHONY: clean
clean: ## Remove build artifacts and caches
	find . -type d -name "__pycache__" -not -path "./venv/*" -not -path "./plugins/*" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .mypy_cache .ruff_cache htmlcov .coverage

.PHONY: clean-venv
clean-venv: ## Remove virtual environment
	rm -rf $(VENV)

.PHONY: clean-all
clean-all: clean clean-venv ## Remove everything (caches + venv)

# ── Help ─────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help message
	@echo "LEDMatrix Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
```

**Step 2: Verify it works**

Run: `make help`
Expected: Formatted list of all targets with descriptions

**Step 3: Commit**

```bash
git add Makefile
git commit -m "feat: add Makefile for streamlined development workflow"
```

---

### Task 5: Enhance CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Rewrite CLAUDE.md with all migrated content**

Replace entire file with comprehensive version that includes:
- Project structure (from project-structure.mdc)
- Dev workflow with Makefile commands
- Coding standards (from coding-standards.mdc)
- Git workflow (from git-workflow.mdc and github-branches-rule.mdc, deduplicated)
- Error handling and logging (from error-handling-logging.mdc)
- Testing conventions (from testing-standards.mdc)
- Configuration management (from configuration-management.mdc)
- Plugin system reference (from .cursorrules and plugins_guide.md)
- Raspberry Pi constraints (from raspberry-pi-development.mdc)
- Common pitfalls (existing)
- API quick reference (from DEVELOPER_QUICK_REFERENCE.md)

Full content:

```markdown
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
make plugin-link NAME=my-plugin PATH=../ledmatrix-my-plugin
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
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: expand CLAUDE.md with full dev standards migrated from .cursor rules"
```

---

### Task 6: Create plugin-scaffold Claude Code skill

**Files:**
- Create: `.claude/skills/plugin-scaffold.md`

**Step 1: Write the skill file**

The skill should be an interactive prompt that:
1. Asks the user for plugin details (id, name, class name, description, category)
2. Generates all required plugin files using the template patterns from `.cursor/plugin_templates/`
3. Creates the files in `plugins/<plugin-id>/` or a specified directory

```markdown
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
from typing import Dict, Any
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
```

**Step 2: Commit**

```bash
git add .claude/skills/plugin-scaffold.md
git commit -m "feat: add plugin-scaffold Claude Code skill"
```

---

### Task 7: Clean up .claude/settings.json

**Files:**
- Modify: `.claude/settings.json`

**Step 1: Update settings.json**

Clean up stale entries and organize:

```json
{
  "permissions": {
    "allow": [
      "Bash(make *)",
      "Bash(python *)",
      "Bash(git *)",
      "Bash(ruff *)",
      "Bash(pytest *)",
      "Bash(pip *)",
      "Bash(pre-commit *)",
      "Bash(ls *)"
    ]
  }
}
```

Remove: overly broad `"Bash"` (security), stale `/Users/chrisbutler/new_dev/led/` path, redundant `"Read"`, `"Write"`, `"Edit"`, `"Glob"`, `"Grep"` (these don't need allowlisting), `"rsync *"` (no deploy target).

**Step 2: Commit**

```bash
git add .claude/settings.json
git commit -m "chore: clean up Claude Code permissions for Makefile workflow"
```

---

### Task 8: Remove Cursor config files

**Files:**
- Delete: `.cursorrules`
- Delete: `.cursor/` (entire directory)

**Step 1: Verify all content has been migrated**

Check that CLAUDE.md covers:
- [x] coding-standards.mdc content
- [x] git-workflow.mdc content
- [x] github-branches-rule.mdc content (deduplicated with git-workflow)
- [x] testing-standards.mdc content
- [x] project-structure.mdc content
- [x] error-handling-logging.mdc content
- [x] configuration-management.mdc content
- [x] raspberry-pi-development.mdc content
- [x] sports-managers.mdc content (covered under coding standards manager pattern)
- [x] plugin_templates/ → plugin-scaffold skill
- [x] plugins_guide.md → CLAUDE.md plugin section + existing docs/

**Step 2: Delete .cursorrules**

```bash
rm .cursorrules
```

**Step 3: Delete .cursor/ directory**

```bash
rm -rf .cursor/
```

**Step 4: Update .gitignore — add .cursor/**

Add to `.gitignore` under the IDE section:
```
.cursor/
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove Cursor config, migrated to CLAUDE.md and Claude Code skills"
```

---

### Task 9: Remove mypy.ini

**Files:**
- Delete: `mypy.ini`

**Step 1: Delete mypy.ini**

Since ruff replaces mypy entirely:

```bash
rm mypy.ini
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove mypy.ini, replaced by ruff"
```

---

### Task 10: Verify everything works end-to-end

**Step 1: Run make setup**

Run: `make setup`
Expected: venv created, all deps installed, pre-commit hooks installed

**Step 2: Run make check**

Run: `make check`
Expected: ruff lint and format checks run (may have existing issues, that's fine)

**Step 3: Run make test**

Run: `make test`
Expected: pytest runs test suite

**Step 4: Run make help**

Run: `make help`
Expected: All targets listed with descriptions

**Step 5: Verify plugin-scaffold skill is discoverable**

Check that `/plugin-scaffold` appears in Claude Code skill list.

**Step 6: Final commit if any adjustments needed**

```bash
git add -A
git commit -m "chore: finalize dev experience overhaul"
```
