#!/usr/bin/env bash
# 本地无后端门禁：与 PR 静态检查保持同一口径，不修改工作区，也不伪装真实环境验收。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

npm run check:version
npm run lint:check
npm run typecheck
npm run check:i18n
npm run gen:api:check
npm run verify:governance
npm run test:unit -- --coverage
npm run build:fast
npm run size
npm audit --omit=dev --audit-level=high
