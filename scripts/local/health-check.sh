#!/usr/bin/env bash
# =========================================================
# health-check.sh (FE 侧基建健康检查)
#
# 检查 FE 联调 / 部署需要的下游:
#   1. BE console-api    actuator/health → 必检(无它 FE 起不来)
#   2. BE trigger        actuator/health → 可选(--no-trigger 跳)
#   3. BE orchestrator   actuator/health → 可选(--no-orch 跳)
#   4. OpenAPI 漂移       BE openapi.yaml vs FE api.generated.ts(--no-drift 跳)
#   5. Vite preview 端口   5173 是否被占(信息,不影响 exit)
#   6. cloudflared 隧道    可选(--no-tunnel 默认跳,要查传 --check-tunnel)
#
# env-var 驱动,任何环境可用:
#   本地:    默认 localhost
#   Staging: BE_CONSOLE_URL=https://console.staging.example.com bash health-check.sh
#   CI smoke: BE_CONSOLE_URL=http://app:18080 BE_DRIFT_OPENAPI=... bash health-check.sh
#
# 用法:
#   bash scripts/local/health-check.sh             # 默认本地
#   bash scripts/local/health-check.sh --quiet     # 只 exit code
#   bash scripts/local/health-check.sh --no-trigger --no-orch  # 只检 console
#   bash scripts/local/health-check.sh --check-tunnel          # 加查 trycloudflare
#
# 返回:
#   0  全部 healthy
#   1  至少 1 项不健康
# =========================================================

set -uo pipefail

# ── 配置 ──────────────────────────────────────────────
BE_CONSOLE_URL="${BE_CONSOLE_URL:-http://localhost:18080}"
BE_TRIGGER_URL="${BE_TRIGGER_URL:-http://localhost:18081}"
BE_ORCH_URL="${BE_ORCH_URL:-http://localhost:18082}"
FE_PREVIEW_PORT="${FE_PREVIEW_PORT:-5173}"

# OpenAPI 漂移检查:BE 的 openapi.yaml 路径(default 本地 sibling 仓)
BE_OPENAPI_PATH="${BE_OPENAPI_PATH:-../file-batch-system/docs/api/console-api.openapi.yaml}"
FE_API_GEN_PATH="${FE_API_GEN_PATH:-src/types/api.generated.ts}"

# Tunnel(可选)
TUNNEL_URL="${TUNNEL_URL:-}"  # 留空时尝试从 cloudflared 进程 log 抓

QUIET=0
SKIP_TRIGGER=0
SKIP_ORCH=0
SKIP_DRIFT=0
CHECK_TUNNEL=0
for arg in "$@"; do
  case "$arg" in
    --quiet) QUIET=1 ;;
    --no-trigger) SKIP_TRIGGER=1 ;;
    --no-orch) SKIP_ORCH=1 ;;
    --no-drift) SKIP_DRIFT=1 ;;
    --check-tunnel) CHECK_TUNNEL=1 ;;
    --help|-h)
      grep -E "^# " "$0" | head -30 | sed 's/^# //'
      exit 0
      ;;
  esac
done

GREEN='\033[32m' RED='\033[31m' YELLOW='\033[33m' DIM='\033[2m' RST='\033[0m'
PASS=0 FAIL=0 SKIP=0

ok()   { (( PASS++ )); [[ $QUIET == 1 ]] || printf "  ${GREEN}✓${RST} %-22s %s\n" "$1" "$2"; }
ng()   { (( FAIL++ )); [[ $QUIET == 1 ]] || printf "  ${RED}✗${RST} %-22s %s\n" "$1" "$2"; }
warn() { [[ $QUIET == 1 ]] || printf "  ${YELLOW}⚠${RST} %-22s %s\n" "$1" "$2"; }
skip() { (( SKIP++ )); [[ $QUIET == 1 ]] || printf "  ${DIM}-${RST} %-22s %s\n" "$1" "$2"; }
info() { [[ $QUIET == 1 ]] || printf "  ${DIM}ⓘ${RST} %-22s %s\n" "$1" "$2"; }

# ── BE health 通用 ─────────────────────────────────────
check_be() {
  local name="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url/actuator/health" 2>&1)
  case "$code" in
    200) ok "$name" "$url/actuator/health → 200" ;;
    000) ng "$name" "$url 不通(超时 / 拒绝连接 / DNS 失败)" ;;
    *)   ng "$name" "$url/actuator/health → HTTP $code" ;;
  esac
}

# ── OpenAPI 漂移 ──────────────────────────────────────
check_drift() {
  if [[ $SKIP_DRIFT == 1 ]]; then
    skip "API drift" "--no-drift 跳过"
    return
  fi
  if [[ ! -f "$BE_OPENAPI_PATH" ]]; then
    warn "API drift" "BE openapi 文件不存在($BE_OPENAPI_PATH),跳过"
    return
  fi
  if [[ ! -f "$FE_API_GEN_PATH" ]]; then
    ng "API drift" "FE 生成文件不存在($FE_API_GEN_PATH)"
    return
  fi
  if [[ ! -x scripts/check-api-drift.sh ]]; then
    warn "API drift" "scripts/check-api-drift.sh 不存在 / 不可执行,跳过"
    return
  fi
  # 复用现有 check-api-drift.sh
  if bash scripts/check-api-drift.sh >/dev/null 2>&1; then
    ok "API drift" "FE api.generated.ts 与 BE openapi.yaml 一致"
  else
    ng "API drift" "FE 跟 BE OpenAPI 漂移,跑 npm run gen:api 同步"
  fi
}

# ── Vite preview 端口占用(信息) ────────────────────────
check_preview_port() {
  if lsof -ti ":$FE_PREVIEW_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    local pid=$(lsof -ti ":$FE_PREVIEW_PORT" -sTCP:LISTEN | head -1)
    info "Preview port" ":$FE_PREVIEW_PORT 已被占(pid=$pid),npm run preview 前需 kill"
  else
    info "Preview port" ":$FE_PREVIEW_PORT 空闲"
  fi
}

# ── Cloudflared 隧道(可选) ────────────────────────────
check_tunnel() {
  if [[ $CHECK_TUNNEL == 0 ]]; then
    skip "Tunnel" "默认跳过(传 --check-tunnel 启用)"
    return
  fi
  local url="$TUNNEL_URL"
  if [[ -z "$url" ]]; then
    # 试着从 cloudflared 进程 log 抓 trycloudflare URL
    url=$(grep -hoE "https://[a-z-]+\.trycloudflare\.com" /tmp/cloudflared*.log 2>/dev/null | tail -1)
  fi
  if [[ -z "$url" ]]; then
    warn "Tunnel" "未配 TUNNEL_URL 且 cloudflared log 抓不到 URL"
    return
  fi
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url/" 2>&1)
  if [[ "$code" =~ ^(200|301|302|404)$ ]]; then
    ok "Tunnel" "$url → HTTP $code (隧道可达)"
  else
    ng "Tunnel" "$url → HTTP ${code:-超时}"
  fi
}

# ── main ─────────────────────────────────────────────
[[ $QUIET == 1 ]] || echo "── FE 联调健康检查 ──"

check_be "BE console-api" "$BE_CONSOLE_URL"

if [[ $SKIP_TRIGGER == 1 ]]; then
  skip "BE trigger" "--no-trigger 跳过"
else
  check_be "BE trigger" "$BE_TRIGGER_URL"
fi

if [[ $SKIP_ORCH == 1 ]]; then
  skip "BE orchestrator" "--no-orch 跳过"
else
  check_be "BE orchestrator" "$BE_ORCH_URL"
fi

check_drift
check_preview_port
check_tunnel

[[ $QUIET == 1 ]] || echo
[[ $QUIET == 1 ]] || printf "结果:PASS=%d  FAIL=%d  SKIP=%d\n" "$PASS" "$FAIL" "$SKIP"

if (( FAIL > 0 )); then
  [[ $QUIET == 1 ]] || echo
  [[ $QUIET == 1 ]] || echo "建议:确认 BE 启动 (make dev-start in BE repo) 或覆盖 BE_CONSOLE_URL 等环境变量指向 staging"
  exit 1
fi
exit 0
