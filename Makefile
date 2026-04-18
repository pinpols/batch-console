SHELL := /bin/zsh

NPM ?= npm
HOST ?= 0.0.0.0
PORT ?= 5173

DEV_PID_FILE := .vite-dev.pid
DEV_LOG_FILE := .vite-dev.log
DEV_SERVER_SCRIPT := ./scripts/dev-server.sh
TEST_UNIT_SCRIPT := ./scripts/test-unit.sh
TEST_E2E_SCRIPT := ./scripts/test-e2e.sh
CI_SCRIPT := ./scripts/ci.sh

.PHONY: help install dev dev-bg stop restart status logs build preview lint format test test-unit test-unit-watch test-e2e test-e2e-ui test-e2e-headed ci clean

help:
	@echo "Available targets:"
	@echo "  make install           Install dependencies"
	@echo "  make dev               Start frontend dev server in foreground"
	@echo "  make dev-bg            Start frontend dev server in background"
	@echo "  make stop              Stop background frontend dev server"
	@echo "  make restart           Restart background frontend dev server"
	@echo "  make status            Show background frontend dev server status"
	@echo "  make logs              Tail background frontend dev server log"
	@echo "  make build             Build production assets"
	@echo "  make preview           Preview production build"
	@echo "  make lint              Run eslint"
	@echo "  make format            Run prettier for src/"
	@echo "  make test              Run unit tests"
	@echo "  make test-unit         Run unit tests once"
	@echo "  make test-unit-watch   Run unit tests in watch mode"
	@echo "  make test-e2e          Run Playwright end-to-end tests"
	@echo "  make test-e2e-ui       Run Playwright in UI mode"
	@echo "  make test-e2e-headed   Run Playwright in headed mode"
	@echo "  make ci                Run lint + build + unit tests + e2e tests"
	@echo "  make clean             Remove dev pid/log files"

install:
	$(NPM) install

dev:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) dev

dev-bg:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) start

stop:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) stop

restart:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) restart

status:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) status

logs:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) logs

build:
	$(NPM) run build

preview:
	$(NPM) run preview -- --host $(HOST) --port $(PORT)

lint:
	$(NPM) run lint

format:
	$(NPM) run format

test: test-unit

test-unit:
	NPM=$(NPM) $(TEST_UNIT_SCRIPT) run

test-unit-watch:
	NPM=$(NPM) $(TEST_UNIT_SCRIPT) watch

test-e2e:
	NPM=$(NPM) $(TEST_E2E_SCRIPT) run

test-e2e-ui:
	NPM=$(NPM) $(TEST_E2E_SCRIPT) ui

test-e2e-headed:
	NPM=$(NPM) $(TEST_E2E_SCRIPT) headed

ci:
	NPM=$(NPM) $(CI_SCRIPT)

clean:
	rm -f "$(DEV_PID_FILE)" "$(DEV_LOG_FILE)"
