#!/usr/bin/env bash
# =========================================================
# fe-acceptance.sh
#
# FE 全链路验收入口。静态治理、测试和真实环境步骤均给出明确 PASS/FAIL/SKIP；
# 默认全量验收要求后端可用，不允许把基础设施缺失记成通过。
#
# 用法:
#   bash scripts/local/fe-acceptance.sh                  # 完整验收,15-30 min
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
#   6  test:unit + coverage
#   7  build + bundle size + prod audit
#   8  test:e2e:smoke (3 specs)
#   9  test:e2e (Playwright full suite)
#   10 preview 冒烟 (vite preview + curl)
#   11 近 3 天 FE 违约扫描
#   12 本地验收报告
#   14 工程治理门禁
# =========================================================

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

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

ALL_STEPS=(0 1 2 3 4 5 14 6 7 8 9 10 13 11 12)

step_name() {
  case "$1" in
    0)  echo "前置条件检查" ;;
    1)  echo "依赖刷新" ;;
    2)  echo "typecheck" ;;
    3)  echo "lint:check" ;;
    4)  echo "check:i18n" ;;
    5)  echo "gen:api:check" ;;
    6)  echo "test:unit + coverage" ;;
    7)  echo "build + size + audit" ;;
    8)  echo "e2e smoke" ;;
    9)  echo "e2e full" ;;
    10) echo "preview 冒烟" ;;
    13) echo "真实使用审计" ;;
    11) echo "近 3 天违约扫描" ;;
    12) echo "本地验收报告" ;;
    14) echo "工程治理门禁" ;;
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
    --build-only)     RUN_STEPS=(0 1 2 3 4 5 14 7) ;;
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
  local name
  name="$(step_name "$n")"
  if ! should_run "$n"; then
    printf "${DIM}── Step %2d %s (skip)${RST}\n" "$n" "$name"
    RESULTS[$n]="SKIP"
    return 0
  fi
  printf "\n${BLUE}── Step %2d %s ──────────────────────${RST}\n" "$n" "$name"
  local start
  local logf
  start=$(date +%s)
  logf="$LOG_DIR/step${n}-$(date +%H%M).log"
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
    if should_run 8 || should_run 9 || should_run 13; then
      echo "BE: DOWN；当前选择包含真实浏览器或真实使用验收"
      return 1
    fi
    echo "BE: DOWN；当前选择不包含真实环境步骤"
  fi
  npx playwright --version >/dev/null 2>&1 || {
    echo "playwright 不可用，请先执行 npm ci"
    return 1
  }
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
step_14_governance(){ npm run verify:governance; }
step_6_unit()       { npm run test:unit -- --coverage; }
step_7_build()      {
  npm run build
  npm run size
  npm audit --omit=dev --audit-level=high
  du -sh dist/ 2>/dev/null
}
step_8_e2e_smoke()  { npm run test:e2e:smoke; }
step_9_e2e_full()   { npm run test:e2e:all; }

step_10_preview() {
  local existing_pid command_line
  existing_pid=$(lsof -ti ":${PREVIEW_PORT}" -sTCP:LISTEN 2>/dev/null | head -1 || true)
  if [[ -n "$existing_pid" ]]; then
    command_line=$(ps -p "$existing_pid" -o command= 2>/dev/null || true)
    if [[ "$command_line" != *vite*preview* ]]; then
      echo "preview 端口 ${PREVIEW_PORT} 被未知进程占用: pid=$existing_pid command=$command_line" >&2
      return 1
    fi
    kill -TERM "$existing_pid" 2>/dev/null || true
  fi
  nohup npm exec -- vite preview --port "${PREVIEW_PORT}" > "$LOG_DIR/preview.log" 2>&1 &
  disown
  sleep 3
  local ok=1
  for path in / /login /m/; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PREVIEW_PORT}${path}")
    echo "  ${path} → ${code}"
    [[ "$code" =~ ^(200|301|302)$ ]] || ok=0
  done
  (( ok == 1 )) || { echo "preview 路由响应异常"; return 1; }
}

step_13_real_audit() {
  # 真实使用视角审计:像用户/运维那样把页面用一遍(载入渲染 + 点击提交 + 操作员旅程),
  # 抓「能打开但不能用」的问题。需 BE + 运行中的 FE(用 preview 端口,已代理 /api)。
  if ! curl -sf http://localhost:18080/actuator/health -o /dev/null 2>/dev/null; then
    echo "BE DOWN，无法执行真实使用审计"; return 1
  fi
  if ! curl -sf "http://localhost:${PREVIEW_PORT}/" -o /dev/null 2>/dev/null; then
    echo "preview(:${PREVIEW_PORT})未起，无法执行真实使用审计"; return 1
  fi
  BASE="http://localhost:${PREVIEW_PORT}" node scripts/local/fe-real-usage-audit.cjs
}

step_11_diff_scan() {
  local out="$LOG_DIR/diff-scan.txt"
  echo "扫描近 3 天 *.vue / *.ts / *.tsx commit:" > "$out"
  git log --since='3 days ago' --pretty=format:'%h %an %s' -- '*.vue' '*.ts' '*.tsx' >> "$out" 2>/dev/null || true
  echo "" >> "$out"
  echo "潜在违约(grep,需人工 review):" >> "$out"
  git log -p --since='3 days ago' -- '*.vue' '*.ts' '*.tsx' 2>/dev/null \
    | grep -nE '^\+' | grep -vE '^\+\+\+' \
    | grep -nE 'console\.log|v-html=|axios\.(get|post|put|delete)|new axios|innerHTML\s*=' \
    >> "$out" || true
  echo "扫描结果:$out"
  wc -l < "$out"
}

step_12_report() {
  local f="$LOG_DIR/latest-summary.md"
  {
    echo "# FE 本地验收报告($(date +%Y-%m-%d))"
    echo ""
    echo "## 汇总"
    echo ""
    echo "| Step | 状态 | 耗时(s) |"
    echo "|---|---|---|"
    for n in "${ALL_STEPS[@]}"; do
      printf "| %d %s | %s | %s |\n" "$n" "$(step_name $n)" "${RESULTS[$n]:-N/A}" "${DURATIONS[$n]:-}"
    done
  } > "$f"
  echo "报告 → $f"
}

# ── 主流程 ─────────────────────────────────────────────────

START_AT=$(date +%s)
trap 'echo; echo "中断"; exit 130' INT

run_step 0 step_0_preflight   || exit 1
run_step 1 step_1_deps        || exit 1
run_step 2 step_2_typecheck   || exit 1
run_step 3 step_3_lint        || exit 1
run_step 4 step_4_i18n        || exit 1
run_step 5 step_5_apidrift    || exit 1
run_step 14 step_14_governance || exit 1
run_step 6 step_6_unit        || exit 1
run_step 7 step_7_build       || exit 1
run_step 8 step_8_e2e_smoke   || exit 1
run_step 9 step_9_e2e_full    || exit 1
run_step 10 step_10_preview     || exit 1
run_step 13 step_13_real_audit  || exit 1
run_step 11 step_11_diff_scan   || true
run_step 12 step_12_report      || true

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
