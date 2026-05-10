SHELL := /bin/zsh

NPM ?= npm
HOST ?= 0.0.0.0
PORT ?= 5173
DOCS_PORT ?= 5174
FE_CONTAINER ?= batch-console

DEV_PID_FILE := .vite-dev.pid
DEV_LOG_FILE := .vite-dev.log
DEV_SERVER_SCRIPT := ./scripts/dev-server.sh
TEST_UNIT_SCRIPT := ./scripts/test-unit.sh
TEST_E2E_SCRIPT := ./scripts/test-e2e.sh
CI_SCRIPT := ./scripts/ci.sh

.PHONY: help install \
        dev dev-all dev-bg \
        docs docs-build \
        stop stop-container restart status logs \
        build preview lint format \
        test test-unit test-unit-watch test-e2e test-e2e-ui test-e2e-headed \
        ci clean

help:
	@echo "Local dev:"
	@echo "  make dev               SPA only (Vite, http://localhost:$(PORT))"
	@echo "  make dev-all           SPA + docs(VitePress build+preview) 双进程,Ctrl+C 一起停"
	@echo "                         注:docs:dev 跨仓 srcDir+cleanUrls 已知失效,固定走 build+preview"
	@echo "  make dev-bg            SPA 后台,日志 -> $(DEV_LOG_FILE)"
	@echo "  make docs              只起文档站(http://localhost:$(DOCS_PORT)/docs/)"
	@echo "  make docs-build        构建文档静态产物到 docs-site/.vitepress/dist/"
	@echo "  make stop              停掉后台 SPA(端口 $(PORT) + $(DOCS_PORT))"
	@echo "  make stop-container    停掉 docker 里的 $(FE_CONTAINER) FE 容器(保留 db/redis/kafka)"
	@echo "  make restart           重启后台 SPA"
	@echo "  make status / logs     查看后台 SPA 状态 / 日志"
	@echo ""
	@echo "Build & test:"
	@echo "  make install           npm install"
	@echo "  make build             生产构建(vue-tsc + vite build)"
	@echo "  make preview           预览生产产物"
	@echo "  make lint / format     eslint / prettier"
	@echo "  make test-unit         vitest run"
	@echo "  make test-e2e          Playwright 完整 e2e"
	@echo "  make ci                lint + build + unit + e2e"
	@echo "  make clean             清理 dev pid/log"

install:
	$(NPM) install

# ── Local dev ───────────────────────────────────────────────────────────────

dev:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) dev

# SPA + docs 双进程同窗口运行;package.json 的 dev:all 已经写好 concurrently,
# 这里只做端口冲突的预清理(避免上一次 Ctrl+C 没杀干净)。
dev-all: stop-container
	@lsof -ti tcp:$(PORT) tcp:$(DOCS_PORT) 2>/dev/null | xargs -r kill 2>/dev/null || true
	$(NPM) run dev:all

dev-bg:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) start

# 只起文档站(常驻 build + preview)。当 SPA 已经在跑、只想看文档时用。
docs:
	@lsof -ti tcp:$(DOCS_PORT) 2>/dev/null | xargs -r kill 2>/dev/null || true
	$(NPM) run docs:serve

docs-build:
	$(NPM) run docs:build

stop:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) EXTRA_PORTS=$(DOCS_PORT) $(DEV_SERVER_SCRIPT) stop

# 停掉 docker FE 容器(用 docker compose 部署时容器名就是 $(FE_CONTAINER));
# 容器不存在时静默,避免裸机环境报错。其它依赖容器(db/redis/kafka)保留。
stop-container:
	@if docker ps --format '{{.Names}}' | grep -q "^$(FE_CONTAINER)$$"; then \
	  echo "Stopping docker container: $(FE_CONTAINER)"; \
	  docker stop $(FE_CONTAINER) >/dev/null; \
	else \
	  echo "Docker container $(FE_CONTAINER) not running, skip"; \
	fi

restart:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) restart

status:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) status

logs:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) logs

# ── Build / preview ────────────────────────────────────────────────────────

build:
	$(NPM) run build

preview:
	$(NPM) run preview -- --host $(HOST) --port $(PORT)

# ── Quality ────────────────────────────────────────────────────────────────

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
