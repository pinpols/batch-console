#!/usr/bin/env bash
# =========================================================
# fe-acceptance.sh
#
# FE 全链路验收 entry — 与 ~/.claude/skills/fe-acceptance 同步。
# 类比 BE 的 be-acceptance.sh,串行执行 typecheck → lint → i18n →
# api-drift → unit → build → e2e smoke → e2e full → preview 冒烟 →
# 违约扫 → backlog 归档。
#
# 用法:
#   bash scripts/local/fe-acceptance.sh                  # 全 12 步,15-25 min
#   bash scripts/local/fe-acceptance.sh --skip-e2e-full  # 跳 e2e full,4-6 min
#   bash scripts/local/fe-acceptance.sh --build-only     # 只 typecheck+lint+build,2-3 min
#   bash scripts/local/fe-acceptance.sh --tests-only     # 单测+e2e,不 build
#   bash scripts/local/fe-acceptance.sh --from-step=6    # 从某步起
#   bash scripts/local/fe-acceptance.sh --steps=2,3,7    # 只跑选定
#   bash scripts/local/fe-acceptance.sh --skip=9         # 跳指定
#   bash scripts/local/fe-acceptance.sh --resume         # 续跑上次失败处
#   bash scripts/local/fe-acceptance.sh --list           # 列步骤
#
# 步骤定义:
#   0  前置条件检查(node / BE / playwright / 端口 / 磁盘)
#   1  依赖刷新(package-lock 变才 npm ci)
#   2  typecheck (vue-tsc --noEmit)
#   3  lint:check (eslint)
#   4  check:i18n (zh / en 1:1)
#   5  gen:api:check (BE OpenAPI drift)
#   6  test:unit (Vitest)
#   7  build (typecheck + i18n + vite build)
#   8  test:e2e:smoke (3 specs)
#   9  test:e2e (Playwright full, 82 specs)
#   10 preview 冒烟 (vite preview + curl)
#   11 近 3 天 FE 违约扫描
#   12 backlog 归档
# =========================================================

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# BE_DIR:默认走 sibling 仓相对路径(本仓和 file-batch-system 平级)。
# 别人 clone 仓库到不同位置 / Linux 上跑,环境变量 export BE_DIR=/path 覆盖。
BE_DIR="${BE_DIR:-$ROOT_DIR/../file-batch-system}"
BE_PORT="${BE_PORT:-18080}"
DEV_PORT="${DEV_PORT:-5173}"
PREVIEW_PORT="${PREVIEW_PORT:-4173}"
LOG_DIR="$ROOT_DIR/logs/fe-acceptance"
mkdir -p "$LOG_DIR" "$ROOT_DIR/docs/backlog"

GREEN='\033[32m' RED='\033[31m' YELLOW='\033[33m' BLUE='\033[34m' DIM='\033[2m' RST='\033[0m'

RUN_STEPS=()
SKIP_STEPS=()
FROM_STEP=0
RESUME=0
SKIP_E2E_FULL=0
STATE_FILE="$ROOT_DIR/.fe-acceptance-state"

ALL_STEPS=(0 1 2 3 4 5 6 7 8 9 10 11 12)

step_name() {
  case "$1" in
    0)  echo "前置条件检查" ;;
    1)  echo "依赖刷新" ;;
    2)  echo "typecheck" ;;
    3)  echo "lint:check" ;;
    4)  echo "check:i18n" ;;
    5)  echo "gen:api:check" ;;
    6)  echo "test:unit" ;;
    7)  echo "build" ;;
    8)  echo "e2e smoke" ;;
    9)  echo "e2e full" ;;
    10) echo "preview 冒烟" ;;
    11) echo "近 3 天违约扫描" ;;
    12) echo "backlog 归档" ;;
    *)  echo "?" ;;
  esac
}

# ── 参数解析 ────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-step=*)    FROM_STEP="${1#*=}" ;;
    --steps=*)        IFS=',' read -ra RUN_STEPS <<< "${1#*=}" ;;
    --skip=*)         IFS=',' read -ra SKIP_STEPS <<< "${1#*=}" ;;
    --resume)         RESUME=1 ;;
    --skip-e2e-full)  SKIP_E2E_FULL=1 ;;
    --build-only)     RUN_STEPS=(0 1 2 3 4 5 7) ;;
    --tests-only)     RUN_STEPS=(0 1 6 8 9) ;;
    --list)
      printf "${BLUE}可用步骤:${RST}\n"
      for n in "${ALL_STEPS[@]}"; do
        printf "  %2d  %s\n" "$n" "$(step_name $n)"
      done
      exit 0
      ;;
    --help|-h) head -36 "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "未知参数: $1(--help)"; exit 2 ;;
  esac
  shift
done

if (( RESUME == 1 )); then
  if [[ -f "$STATE_FILE" ]]; then
    FROM_STEP=$(grep -E "^last_failed=" "$STATE_FILE" | tail -1 | cut -d= -f2)
    if [[ -z "$FROM_STEP" || "$FROM_STEP" == "0" ]]; then
      printf "${YELLOW}--resume:无失败记录,跑完整流程${RST}\n"
      FROM_STEP=0
    else
      printf "${YELLOW}--resume:从 step %s 续跑${RST}\n" "$FROM_STEP"
    fi
  else
    printf "${YELLOW}--resume:无 state 文件,跑完整流程${RST}\n"
  fi
fi

should_run() {
  local s=$1
  # 显式 --steps 优先
  if (( ${#RUN_STEPS[@]} > 0 )); then
    for x in "${RUN_STEPS[@]}"; do [[ "$x" == "$s" ]] && return 0; done
    return 1
  fi
  # --from-step 过滤
  (( s < FROM_STEP )) && return 1
  # --skip 排除
  for x in "${SKIP_STEPS[@]:-}"; do [[ "$x" == "$s" ]] && return 1; done
  # --skip-e2e-full
  (( SKIP_E2E_FULL == 1 && s == 9 )) && return 1
  return 0
}

declare -A RESULTS
declare -A DURATIONS
FAILED_STEP=0

run_step() {
  local n=$1; shift
  local name="$(step_name $n)"
  if ! should_run "$n"; then
    printf "${DIM}── Step %2d %s (skip)${RST}\n" "$n" "$name"
    RESULTS[$n]="SKIP"
    return 0
  fi
  printf "\n${BLUE}── Step %2d %s ──────────────────────${RST}\n" "$n" "$name"
  local start=$(date +%s)
  local logf="$LOG_DIR/step${n}-$(date +%H%M).log"
  if "$@" 2>&1 | tee "$logf"; then
    local dur=$(( $(date +%s) - start ))
    DURATIONS[$n]=$dur
    RESULTS[$n]="PASS"
    printf "${GREEN}✓ Step %s pass (%ss)${RST}\n" "$n" "$dur"
    return 0
  else
    local dur=$(( $(date +%s) - start ))
    DURATIONS[$n]=$dur
    RESULTS[$n]="FAIL"
    FAILED_STEP=$n
    printf "${RED}✗ Step %s fail (%ss)  → %s${RST}\n" "$n" "$dur" "$logf"
    echo "last_failed=$n" > "$STATE_FILE"
    return 1
  fi
}

# ── Steps ──────────────────────────────────────────────────

step_0_preflight() {
  echo "node: $(node --version 2>/dev/null || echo MISSING)"
  if curl -sf "http://localhost:${BE_PORT}/actuator/health" -o /dev/null; then
    echo "BE: UP"
  else
    echo "BE: DOWN(e2e 会失败,gen:api:check 也读不到 yaml 可能 OK)"
  fi
  ls ~/Library/Caches/ms-playwright/chromium-* 2>/dev/null | head -1 \
    || echo "playwright: chromium 缺,需 npx playwright install chromium"
  for port in $DEV_PORT $PREVIEW_PORT; do
    if lsof -i :$port -sTCP:LISTEN >/dev/null 2>&1; then
      echo "  PORT $port: occupied"
    fi
  done
  df -h "$ROOT_DIR" | tail -1 | awk '{print "disk free:", $4}'
}

step_1_deps() {
  if git diff --quiet HEAD package-lock.json package.json 2>/dev/null; then
    echo "package-lock 无变更,skip npm ci"
  else
    npm ci
  fi
}

step_2_typecheck()  { npm run typecheck; }
step_3_lint()       { npm run lint:check; }
step_4_i18n()       { npm run check:i18n; }
step_5_apidrift()   { npm run gen:api:check; }
step_6_unit()       { npm run test:unit; }
step_7_build()      { npm run build; du -sh dist/ 2>/dev/null; }
step_8_e2e_smoke()  { npm run test:e2e:smoke; }
step_9_e2e_full()   { npm run test:e2e; }

step_10_preview() {
  lsof -i :${PREVIEW_PORT} -sTCP:LISTEN 2>/dev/null | tail -n +2 | awk '{print $2}' | xargs -r kill 2>/dev/null || true
  nohup npx vite preview --port ${PREVIEW_PORT} > "$LOG_DIR/preview.log" 2>&1 &
  disown
  sleep 3
  local ok=1
  for path in / /login /m/; do
    local code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PREVIEW_PORT}${path}")
    echo "  ${path} → ${code}"
    [[ "$code" =~ ^(200|301|302)$ ]] || ok=0
  done
  (( ok == 1 )) || { echo "preview 路由响应异常"; return 1; }
}

step_11_diff_scan() {
  local out="$LOG_DIR/diff-scan.txt"
  echo "扫描近 3 天 *.vue / *.ts / *.tsx commit:" > "$out"
  git log --since='3 days ago' --pretty=format:'%h %an %s' -- '*.vue' '*.ts' '*.tsx' >> "$out" 2>/dev/null || true
  echo "" >> "$out"
  echo "潜在违约(grep,需人工 review):" >> "$out"
  git diff --since='3 days ago' -- '*.vue' '*.ts' '*.tsx' 2>/dev/null \
    | grep -nE '^\+' | grep -vE '^\+\+\+' \
    | grep -nE 'console\.log|v-html=|axios\.(get|post|put|delete)|new axios|innerHTML\s*=' \
    >> "$out" || true
  echo "扫描结果:$out"
  wc -l < "$out"
}

step_12_backlog() {
  local f="$ROOT_DIR/docs/backlog/fe-acceptance-$(date +%Y-%m-%d).md"
  {
    echo "# FE 验收 backlog($(date +%Y-%m-%d))"
    echo ""
    echo "## 汇总"
    echo ""
    echo "| Step | 状态 | 耗时(s) |"
    echo "|---|---|---|"
    for n in "${ALL_STEPS[@]}"; do
      printf "| %d %s | %s | %s |\n" "$n" "$(step_name $n)" "${RESULTS[$n]:-N/A}" "${DURATIONS[$n]:-}"
    done
    echo ""
    echo "## 工具链 / 环境(不修主代码)"
    echo "- [ ] (人工补)"
    echo ""
    echo "## 代码 bug"
    echo "- [ ] (人工补)"
    echo ""
    echo "## flaky / 性能(独立 PR)"
    echo "- [ ] (人工补)"
  } > "$f"
  echo "backlog → $f"
}

# ── 主流程 ─────────────────────────────────────────────────

START_AT=$(date +%s)
trap 'echo; echo "中断"; exit 130' INT

run_step 0 step_0_preflight   || true   # preflight 不阻断
run_step 1 step_1_deps        || exit 1
run_step 2 step_2_typecheck   || exit 1
run_step 3 step_3_lint        || exit 1
run_step 4 step_4_i18n        || exit 1
run_step 5 step_5_apidrift    || exit 1
run_step 6 step_6_unit        || exit 1
run_step 7 step_7_build       || exit 1
run_step 8 step_8_e2e_smoke   || exit 1
run_step 9 step_9_e2e_full    || exit 1
run_step 10 step_10_preview   || true   # preview 失败不阻断后续归档
run_step 11 step_11_diff_scan || true
run_step 12 step_12_backlog   || true

TOTAL=$(( $(date +%s) - START_AT ))

# ── 汇总 ───────────────────────────────────────────────────
printf "\n${BLUE}═══ 验收汇总(总耗时 %ss / %s min)═══${RST}\n" "$TOTAL" "$((TOTAL/60))"
printf "%-4s %-22s %-6s %s\n" "#" "step" "状态" "耗时(s)"
for n in "${ALL_STEPS[@]}"; do
  printf "%-4s %-22s %-6s %s\n" "$n" "$(step_name $n)" "${RESULTS[$n]:-N/A}" "${DURATIONS[$n]:-}"
done

if (( FAILED_STEP > 0 )); then
  printf "\n${RED}失败步骤:%d(%s)${RST}\n" "$FAILED_STEP" "$(step_name $FAILED_STEP)"
  printf "${YELLOW}续跑:bash scripts/local/fe-acceptance.sh --resume${RST}\n"
  exit 1
fi

# 全过则清 state
rm -f "$STATE_FILE"
printf "\n${GREEN}全部通过${RST}\n"
