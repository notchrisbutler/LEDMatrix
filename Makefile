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
