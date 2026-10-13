#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
# shellcheck source=../lib/gate-result.sh
source "$ROOT/scripts/lib/gate-result.sh"

group="${BATCH_GATE_GROUP:-general}"
if (($# >= 2)) && [[ "$1" == "--group" ]]; then
  group="$2"
  shift 2
fi

if (($# < 4)) || [[ "$3" != "--" ]]; then
  echo "用法：run-gate.sh [--group <name>] <code> <name> -- <command...>" >&2
  exit 2
fi

if [[ ! "$group" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  printf '❌ 不通过 | code=FE_GATE_GROUP_INVALID | gate=门禁分组 | group=governance | mode=enforce | exit_code=2 | action=fix_and_retry\n' >&2
  exit 2
fi

code="$1"
name="$2"
shift 3
BATCH_GATE_GROUP="$group" gate_run "$code" "$name" "$@"
