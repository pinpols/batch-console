#!/usr/bin/env bash
# 用途：在可解析的提交范围内运行 gitleaks，避免浅克隆扫到整棵树或把无效范围当成通过。
# 用法：在仓库根目录执行 bash scripts/ci/gitleaks-scan.sh；调用前需已安装 gitleaks。
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# PR 只扫描相对基线的新提交；push、定时和手动触发只扫描最新提交。
# 两种范围都要求对象真实存在。gitleaks 在 git 无法解析 log 范围时仍返回 0。
if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
  base_ref="origin/${GITHUB_BASE_REF}"
  if ! git rev-parse --verify --quiet "${base_ref}^{commit}" >/dev/null; then
    echo "密钥扫描范围无法解析：缺少 ${base_ref}。checkout 必须使用 fetch-depth: 0。" >&2
    exit 1
  fi
  range="${base_ref}..HEAD"
else
  if ! git rev-parse --verify --quiet 'HEAD^' >/dev/null; then
    echo "密钥扫描范围无法解析：HEAD 没有可读取的父提交。checkout 必须使用 fetch-depth: 0。" >&2
    exit 1
  fi
  range="-1"
fi

exec gitleaks git . --log-opts="${range}" --redact --no-banner --exit-code 1
