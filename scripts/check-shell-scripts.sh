#!/usr/bin/env bash
# 按 shebang 分流检查 Shell 脚本：Bash/sh 要求 ShellCheck warning 为零，zsh 至少过语法检查。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v shellcheck >/dev/null 2>&1 || { echo "FAIL SHELL_SCRIPTS: 缺少 shellcheck" >&2; exit 1; }

bash_files=()
zsh_files=()
while IFS= read -r -d '' file; do
  shebang="$(head -n 1 "$file")"
  case "$shebang" in
    *zsh*) zsh_files+=("$file") ;;
    *) bash_files+=("$file") ;;
  esac
done < <(git ls-files -z -- '*.sh')

for file in "${bash_files[@]}"; do bash -n "$file"; done
for file in "${zsh_files[@]}"; do zsh -n "$file"; done
if ((${#bash_files[@]} > 0)); then
  printf '%s\0' "${bash_files[@]}" | xargs -0 shellcheck -S warning
fi

echo "PASS SHELL_SCRIPTS: bash=${#bash_files[@]} zsh=${#zsh_files[@]}"
