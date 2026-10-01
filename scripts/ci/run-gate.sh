#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
# shellcheck source=../lib/gate-result.sh
source "$ROOT/scripts/lib/gate-result.sh"

if (($# < 4)) || [[ "$3" != "--" ]]; then
  echo "用法：run-gate.sh <code> <name> -- <command...>" >&2
  exit 2
fi

code="$1"
name="$2"
shift 3
gate_run "$code" "$name" "$@"
