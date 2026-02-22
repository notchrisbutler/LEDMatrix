# Dev Experience Overhaul Design

## Goal

Consolidate developer tooling into a clean, Makefile-driven workflow with Claude Code as the primary AI assistant. Remove Cursor-specific config and migrate all valuable content into CLAUDE.md and Claude Code skills.

## Scope

### 1. Makefile

Full-featured Makefile with these targets:

**Setup**
- `make setup` — Create venv via pyenv, install all deps (core + emulator + web + dev)
- `make venv` — Create venv only
- `make install` — Install all requirements into existing venv

**Run**
- `make run` — Run emulator mode (`python run.py --emulator`)
- `make web` — Run web interface
- `make run-all` — Run emulator + web together

**Quality (ruff only, replaces flake8/mypy)**
- `make lint` — `ruff check .`
- `make lint-fix` — `ruff check --fix .`
- `make format` — `ruff format .`
- `make check` — lint + format --check (CI gate)

**Test**
- `make test` — Run all tests
- `make test-unit` — `pytest -m unit`
- `make test-integration` — `pytest -m integration`
- `make test-cov` — pytest with coverage report

**Plugin Dev**
- `make plugin-link NAME=<name> PATH=<path>` — Link plugin for dev
- `make plugin-unlink NAME=<name>` — Unlink plugin
- `make plugin-list` — List linked plugins

**Maintenance**
- `make clean` — Remove __pycache__, .pytest_cache, .mypy_cache, .ruff_cache
- `make clean-venv` — Remove venv
- `make clean-all` — clean + clean-venv

**Help**
- `make help` (default target) — Show all targets with descriptions

### 2. Ruff Configuration

Create `ruff.toml` with:
- Target Python 3.10
- Line length 120 (match existing style)
- Enable rule sets: E, F, B (bugbear), I (isort), UP (pyupgrade), W
- Ignore E501 (line length handled by formatter)
- Exclude: plugins/, venv/, .git/, __pycache__/
- Format: quote-style double, indent-style space

Update `.pre-commit-config.yaml`:
- Remove flake8 + flake8-bugbear hooks
- Remove mypy hook
- Add ruff (ruff check + ruff format) hooks
- Keep: trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-merge-conflict
- Keep: custom no-bare-except and no-hardcoded-paths hooks

### 3. CLAUDE.md Enhancement

Expand to include all migrated content from .cursor/rules/:
- Coding standards (naming, patterns, error handling)
- Project structure and architecture overview
- Git workflow (commit format, branching conventions)
- Testing conventions and patterns
- Configuration management
- Raspberry Pi constraints
- Plugin development quick reference
- Display manager / cache manager API cheat sheet

Keep concise — reference `docs/` for deep dives.

### 4. Claude Code Skill: plugin-scaffold

Create `.claude/skills/plugin-scaffold.md`:
- Interactive skill that creates a new plugin from templates
- Generates: manifest.json, manager.py, config_schema.json, requirements.txt
- Uses content from current `.cursor/plugin_templates/`
- Asks for plugin name, description, category, display modes

### 5. .claude/settings.json Cleanup

Review and update permissions for the Makefile-driven workflow.

### 6. Remove Cursor Config

Delete after migration:
- `.cursorrules`
- `.cursor/` directory (rules/, plugin_templates/, plugins_guide.md, README.md, plans/)

## Files Changed

| Action | File |
|--------|------|
| Create | `Makefile` |
| Create | `ruff.toml` |
| Create | `.claude/skills/plugin-scaffold.md` |
| Update | `CLAUDE.md` |
| Update | `.pre-commit-config.yaml` |
| Update | `.claude/settings.json` |
| Delete | `.cursorrules` |
| Delete | `.cursor/` (entire directory) |

## Out of Scope

- GitHub Actions CI (not currently set up, separate effort)
- Pi deployment targets (user pulls via git)
- Changes to plugin system code
- pyproject.toml migration (staying with requirements.txt)
