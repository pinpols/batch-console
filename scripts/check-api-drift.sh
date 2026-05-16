#!/usr/bin/env bash
# 检查后端 OpenAPI yaml 与前端生成的 src/types/api.generated.ts 是否漂移。
#
# 用法:
#   ./scripts/check-api-drift.sh                # local 模式:用同级 file-batch-system 的 yaml
#   BE_OPENAPI_URL=... ./scripts/check-api-drift.sh   # 远端模式:CI 用 raw GitHub URL
#   ./scripts/check-api-drift.sh --quiet         # 安静模式,只在漂移时输出
#
# 退出码:
#   0 — 一致 或 yaml 不可达(本地无 sibling、未设 BE_OPENAPI_URL → 跳过不阻塞)
#   1 — 检测到漂移(需跑 `npm run gen:api` 提交)
#   2 — 工具链 / curl 错误
#
# CI 推荐配置(.github/workflows/ci.yml):
#   - name: Check OpenAPI drift
#     env:
#       BE_OPENAPI_URL: https://raw.githubusercontent.com/<org>/file-batch-system/main/docs/api/console-api.openapi.yaml
#     run: bash scripts/check-api-drift.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

QUIET=false
[[ "${1:-}" == "--quiet" ]] && QUIET=true

log()  { $QUIET || echo "$@"; }
warn() { echo "[api-drift] $*" >&2; }

LOCAL_YAML="../file-batch-system/docs/api/console-api.openapi.yaml"
GENERATED="src/types/api.generated.ts"
# 用临时目录而非临时文件:macOS mktemp 无法控制后缀,而 prettier 需 .ts 才能选解析器
TMP_DIR="$(mktemp -d)"
TMP_YAML="$TMP_DIR/openapi.yaml"
TMP_TS="$TMP_DIR/api.regen.ts"
trap 'rm -rf "$TMP_DIR"' EXIT

# 1. 选定 yaml 源
YAML_PATH=""
if [[ -n "${BE_OPENAPI_URL:-}" ]]; then
  log "[api-drift] fetching $BE_OPENAPI_URL ..."
  if ! curl -fsSL "$BE_OPENAPI_URL" -o "$TMP_YAML"; then
    warn "could not fetch BE_OPENAPI_URL — skipping (exit 0)"
    exit 0
  fi
  YAML_PATH="$TMP_YAML"
elif [[ -f "$LOCAL_YAML" ]]; then
  YAML_PATH="$LOCAL_YAML"
else
  warn "no yaml source available (set BE_OPENAPI_URL or check out file-batch-system as sibling) — skipping (exit 0)"
  exit 0
fi

# 2. 检查工具链
if ! command -v npx >/dev/null 2>&1; then
  warn "npx not found"
  exit 2
fi
if [[ ! -f "$GENERATED" ]]; then
  warn "expected $GENERATED to exist"
  exit 2
fi

# 3. 重新生成到临时文件 + prettier 格式化(对齐 npm run gen:api 输出风格)
log "[api-drift] regenerating from $YAML_PATH ..."
if ! npx --yes openapi-typescript "$YAML_PATH" -o "$TMP_TS" >/dev/null 2>&1; then
  warn "openapi-typescript failed"
  exit 2
fi
# 显式指 project 的 .prettierrc:tmp 路径不在 project tree 下,
# prettier 默认配置发现走 fs.cwd → 项目根,但 --write 输入文件在 /tmp 时 walk-up
# 找不到 .prettierrc 会用 double-quote + semi 默认,造成"假漂移"
if ! npx --yes prettier --config "$ROOT_DIR/.prettierrc" --write "$TMP_TS" >/dev/null 2>&1; then
  warn "prettier failed"
  exit 2
fi

# 4. 比较
if diff -q "$TMP_TS" "$GENERATED" >/dev/null 2>&1; then
  log "[api-drift] ✓ in sync"
  exit 0
fi

# 5. 漂移 — 输出可读 diff,给出修复命令
echo "[api-drift] ✗ DRIFT DETECTED"
echo
echo "Backend yaml has changed but src/types/api.generated.ts was not regenerated."
echo
echo "── Fix locally ──"
echo "  npm run gen:api"
echo "  npx prettier --write src/types/api.generated.ts"
echo "  git add src/types/api.generated.ts && git commit -m 'chore(api): regen types'"
echo
echo "── First 60 lines of drift ──"
diff -u "$GENERATED" "$TMP_TS" | head -60 || true
exit 1
