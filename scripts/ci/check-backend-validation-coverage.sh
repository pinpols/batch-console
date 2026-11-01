#!/usr/bin/env bash
# 用途：确认后端成功验证的提交覆盖待构建版本的代码与配置。
# 用法：bash scripts/ci/check-backend-validation-coverage.sh <仓库目录> <验证提交> <目标提交>
set -euo pipefail

repo=$1
validated=$2
target=$3
changed=$(mktemp)
trap 'rm -f "$changed"' EXIT

git -C "$repo" merge-base --is-ancestor "$validated" "$target" || {
  echo '后端成功验证的提交不是目标提交的祖先。' >&2
  exit 1
}
git -C "$repo" diff --name-only -z --no-renames "$validated" "$target" > "$changed"
while IFS= read -r -d '' path; do
  lower=$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')
  case "$lower" in
    *.md|*.rst) continue ;;
  esac
  case "$path" in
    LICENSE|NOTICE) continue ;;
  esac
  echo "后端成功验证后仍有未验证变更: $path" >&2
  exit 1
done < "$changed"
echo '后端成功验证已覆盖目标提交的代码和配置。'
