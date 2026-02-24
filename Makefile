# LEDMatrix Development Makefile
# Run `make help` to see available targets

.DEFAULT_GOAL := help

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
		echo "Creating venv with $$(python3 --version)..."; \
		python3 -m venv $(VENV); \
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
web: ## Run the web interface (WEB_PORT=5050)
	WEB_PORT=$(or $(WEB_PORT),5050) $(PYTHON) web_interface/start.py

.PHONY: run-all
run-all: ## Run emulator + web interface together
	@echo "Starting emulator and web interface..."
	@trap 'kill 0' INT TERM; \
	EMULATOR=true $(PYTHON) run.py & \
	WEB_PORT=$(or $(WEB_PORT),5050) $(PYTHON) web_interface/start.py & \
	wait

.PHONY: install-web2
install-web2: ## Install lightweight web UI dependencies
	$(PIP) install -r web_ui/requirements.txt

.PHONY: web2
web2: ## Run lightweight web UI (port 5454)
	$(PYTHON) -m uvicorn web_ui.server:app --host 0.0.0.0 --port 5454 --reload

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
plugin-link: ## Link a plugin for development (NAME=<id> DIR=<path>)
	@if [ -z "$(NAME)" ]; then echo "Usage: make plugin-link NAME=<plugin-id> DIR=<path>"; exit 1; fi
	@if [ -z "$(DIR)" ]; then echo "Usage: make plugin-link NAME=<plugin-id> DIR=<path>"; exit 1; fi
	./scripts/dev/dev_plugin_setup.sh link $(NAME) $(DIR)

.PHONY: plugin-unlink
plugin-unlink: ## Unlink a development plugin (NAME=<id>)
	@if [ -z "$(NAME)" ]; then echo "Usage: make plugin-unlink NAME=<plugin-id>"; exit 1; fi
	./scripts/dev/dev_plugin_setup.sh unlink $(NAME)

.PHONY: plugin-list
plugin-list: ## List linked development plugins
	./scripts/dev/dev_plugin_setup.sh list

# ── Build ────────────────────────────────────────────────────────────

.PHONY: bundle-widgets
bundle-widgets: ## Bundle widget JS files
	$(PYTHON) scripts/bundle_widgets.py

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
