SHELL := /bin/bash

NPM ?= npm
HOST ?= 0.0.0.0
PORT ?= 5173
DOCS_PORT ?= 5174
FE_DOCS_PORT ?= 5175
FE_CONTAINER ?= batch-console

# 文档目标(目录做成参数):backend | frontend | all | <目录路径>
#   DOCS  给 docs(serve 单目标,默认 backend) / docs-build(可 all)
#   STACK 给 dev-stack(SPA + 文档栈,默认 all = BE+FE)
#   DPORT 文档 preview 端口覆盖(默认空 → 脚本按 backend=5174/frontend=5175 选)
DOCS ?= backend
STACK ?= all
DPORT ?=
BG ?=

DEV_PID_FILE := .vite-dev.pid
DEV_LOG_FILE := .vite-dev.log
STACK_PID_FILE := .dev-stack.pid
STACK_LOG_FILE := .dev-stack.log
DEV_SERVER_SCRIPT := ./scripts/dev-server.sh
TEST_UNIT_SCRIPT := ./scripts/test-unit.sh
TEST_E2E_SCRIPT := ./scripts/test-e2e.sh
CI_SCRIPT := ./scripts/ci.sh

.PHONY: help install \
        dev dev-all dev-bg dev-stack logs-stack \
        docs docs-build kill \
        stop stop-container restart status logs \
        build preview lint format \
        test test-unit test-unit-watch test-e2e test-e2e-all test-e2e-smoke test-e2e-ui test-e2e-headed \
        typecheck check-version docker-build docker-up docker-down \
        ci clean health lint-fix

help:
	@echo "Local dev:"
	@echo "  make dev               SPA only (Vite, http://localhost:$(PORT))"
	@echo "  make dev-stack         SPA + 文档栈(kill 对应端口 → build → preview,Ctrl+C 一起停)"
	@echo "                           STACK=all|backend|frontend(默认 all);BG=1 后台+日志(.dev-stack.log)"
	@echo "  make logs-stack        tail 后台 stack 日志(BG=1 启动时)"
	@echo "  make dev-all           旧入口(清理占用端口后运行 npm dev:all;不停止容器)"
	@echo "  make dev-bg            SPA 后台,日志 -> $(DEV_LOG_FILE)"
	@echo "  make docs              起文档站:DOCS=backend(5174,默认)|frontend(5175)[ DPORT=覆盖端口 ]"
	@echo "  make docs-build        构建文档:DOCS=backend(默认)|frontend|all|<目录>"
	@echo "  make kill              kill 所有前端 dev 端口(SPA+BE/FE文档+preview)"
	@echo "  make stop              停掉后台 SPA(端口 $(PORT) + $(DOCS_PORT) + $(FE_DOCS_PORT))"
	@echo "  make stop-container    停掉 docker 里的 $(FE_CONTAINER) FE 容器(保留 db/redis/kafka)"
	@echo "  make restart           重启后台 SPA"
	@echo "  make status / logs     查看后台 SPA 状态 / 日志"
	@echo ""
	@echo "Build & test:"
	@echo "  make install           npm ci (exact lockfile install)"
	@echo "  make build             生产构建(vue-tsc + vite build)"
	@echo "  make preview           预览生产产物"
	@echo "  make lint              ESLint check (read-only)"
	@echo "  make lint-fix          ESLint autofix"
	@echo "  make format            Prettier write"
	@echo "  make test-unit         vitest run"
	@echo "  make test-e2e          Playwright 常规套件（排除 @slow）"
	@echo "  make test-e2e-all      Playwright 全量套件"
	@echo "  make test-e2e-smoke    Playwright 冒烟套件"
	@echo "  make typecheck         Vue / TypeScript 类型检查"
	@echo "  make check-version     前端 package / Docker 镜像版本检查"
	@echo "  make docker-build      构建本地前端镜像"
	@echo "  make ci                无后端本地门禁(含单测和构建,不跑 e2e)"
	@echo "  make clean             清理 dev pid/log"

install:
	$(NPM) ci

# ── Local dev ───────────────────────────────────────────────────────────────

dev:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) dev

# SPA + docs 双进程同窗口运行;package.json 的 dev:all 已经写好 concurrently,
# 这里只做端口冲突的预清理(避免上一次 Ctrl+C 没杀干净)。
dev-all:
	@pids="$$(lsof -ti tcp:$(PORT) tcp:$(DOCS_PORT) 2>/dev/null || true)"; \
	if [ -n "$$pids" ]; then printf '%s\n' "$$pids" | xargs kill 2>/dev/null || true; fi
	$(NPM) run dev:all

dev-bg:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) $(DEV_SERVER_SCRIPT) start

# 只起文档站(kill 端口 → build → preview)。文档目录参数化:DOCS=backend|frontend|<目录>
#   make docs               # BE 文档(5174)
#   make docs DOCS=frontend # FE 文档(5175)
#   make docs DOCS=backend DPORT=6174  # 覆盖端口
docs:
	NPM=$(NPM) bash scripts/docs-serve.sh $(DOCS) $(DPORT)

# 构建文档静态产物。DOCS=backend|frontend|all|<目录>(默认 backend)
docs-build:
	NPM=$(NPM) bash scripts/docs-build.sh $(DOCS)

# SPA + 文档栈一起起;自动 kill 对应端口。前台(默认,Ctrl+C 一起停)或 BG=1 后台+日志。
#   make dev-stack                 # SPA + BE + FE 文档(STACK=all,前台)
#   make dev-stack STACK=backend
#   make dev-stack BG=1            # 后台跑,日志 -> .dev-stack.log(make logs-stack 看)
dev-stack:
	DEV_HOST=$(HOST) SPA_PORT=$(PORT) NPM=$(NPM) BG=$(BG) bash scripts/dev-stack.sh $(STACK)

# tail 后台 stack 日志(BG=1 启动时写 .dev-stack.log)
logs-stack:
	@test -f .dev-stack.log && tail -f .dev-stack.log || echo "无 .dev-stack.log(用 make dev-stack BG=1 后台启动)"

# kill 所有前端 dev 端口(SPA + BE/FE 文档 + preview),清后台 PID 文件。
kill:
	bash scripts/kill-fe.sh

stop:
	DEV_HOST=$(HOST) PORT=$(PORT) NPM=$(NPM) DEV_PID_FILE=$(DEV_PID_FILE) DEV_LOG_FILE=$(DEV_LOG_FILE) EXTRA_PORTS=$(DOCS_PORT),$(FE_DOCS_PORT) $(DEV_SERVER_SCRIPT) stop

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

# 联调环境健康检查(BE console-api / trigger / orchestrator + OpenAPI 漂移 + preview 端口)
# env-var 驱动,详见 scripts/local/health-check.sh 顶部注释。
# Staging:覆盖 BE_CONSOLE_URL / BE_TRIGGER_URL / BE_ORCH_URL 指向远端。
health:
	bash scripts/local/health-check.sh

# ── Build / preview ────────────────────────────────────────────────────────

build:
	$(NPM) run build

preview:
	$(NPM) run preview -- --host $(HOST) --port $(PORT)

# ── Quality ────────────────────────────────────────────────────────────────

lint:
	$(NPM) run lint:check

lint-fix:
	$(NPM) run lint

format:
	$(NPM) run format

typecheck:
	$(NPM) run typecheck

check-version:
	$(NPM) run check:version

test: test-unit

test-unit:
	NPM=$(NPM) $(TEST_UNIT_SCRIPT) run

test-unit-watch:
	NPM=$(NPM) $(TEST_UNIT_SCRIPT) watch

test-e2e:
	NPM=$(NPM) $(TEST_E2E_SCRIPT) run

test-e2e-all:
	NPM=$(NPM) $(TEST_E2E_SCRIPT) all

test-e2e-smoke:
	$(NPM) run test:e2e:smoke

test-e2e-ui:
	NPM=$(NPM) $(TEST_E2E_SCRIPT) ui

test-e2e-headed:
	NPM=$(NPM) $(TEST_E2E_SCRIPT) headed

docker-build:
	$(NPM) run docker:build

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

ci:
	NPM=$(NPM) $(CI_SCRIPT)

clean:
	@for pid_file in "$(DEV_PID_FILE)" "$(STACK_PID_FILE)"; do \
	  if [ -f "$$pid_file" ] && kill -0 "$$(cat "$$pid_file")" 2>/dev/null; then \
	    echo "Refusing to remove active process state in $$pid_file; use make stop or make kill first" >&2; \
	    exit 1; \
	  fi; \
	done
	rm -f "$(DEV_PID_FILE)" "$(DEV_LOG_FILE)" "$(STACK_PID_FILE)" "$(STACK_LOG_FILE)"
