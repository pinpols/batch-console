#!/usr/bin/env bash
# Shell 脚本统一使用 Bash/sh，避免依赖开发机未必安装的 zsh。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v shellcheck >/dev/null 2>&1 || { echo "FAIL SHELL_SCRIPTS: 缺少 shellcheck" >&2; exit 1; }

bash_files=()
while IFS= read -r -d '' file; do
  shebang="$(head -n 1 "$file")"
  case "$shebang" in
    *zsh*) echo "FAIL SHELL_SCRIPTS: $file uses zsh; use Bash/sh for portable execution" >&2; exit 1 ;;
    *) bash_files+=("$file") ;;
  esac
done < <(git ls-files -z -- '*.sh')

for file in "${bash_files[@]}"; do bash -n "$file"; done
if ((${#bash_files[@]} > 0)); then
  printf '%s\0' "${bash_files[@]}" | xargs -0 shellcheck -S warning
fi

echo "PASS SHELL_SCRIPTS: bash/sh=${#bash_files[@]}"
