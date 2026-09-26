#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_FILE="${ROOT_DIR}/src/types/api.generated.ts"
DEFAULT_OPENAPI_PATH="${ROOT_DIR}/../file-batch-system/docs/api/console-api.openapi.yaml"
OPENAPI_PATH="${BE_OPENAPI_PATH:-${DEFAULT_OPENAPI_PATH}}"
OPENAPI_URL="${BE_OPENAPI_URL:-}"
TMP_DIR=""

cleanup() {
  if [[ -n "${TMP_DIR}" && -d "${TMP_DIR}" ]]; then
    rm -rf "${TMP_DIR}"
  fi
}
trap cleanup EXIT

cd "${ROOT_DIR}"

if [[ -n "${OPENAPI_URL}" ]]; then
  TMP_DIR="$(mktemp -d)"
  OPENAPI_PATH="${TMP_DIR}/console-api.openapi.yaml"
  curl -fsSL "${OPENAPI_URL}" -o "${OPENAPI_PATH}"
fi

if [[ ! -f "${OPENAPI_PATH}" ]]; then
  cat >&2 <<EOF
OpenAPI schema not found: ${OPENAPI_PATH}

Set BE_OPENAPI_PATH to a local schema file, or set BE_OPENAPI_URL to download
one before generating src/types/api.generated.ts.
EOF
  exit 1
fi

npx openapi-typescript "${OPENAPI_PATH}" -o "${OUTPUT_FILE}"
npx prettier --write "${OUTPUT_FILE}"
