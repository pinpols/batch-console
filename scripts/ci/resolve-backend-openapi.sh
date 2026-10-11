#!/usr/bin/env bash
# 为拉取请求解析配对后端契约；找不到配对分支时回退到 main。
set -euo pipefail

output_file="${1:?usage: resolve-backend-openapi.sh OUTPUT_FILE GITHUB_OUTPUT}"
github_output="${2:?usage: resolve-backend-openapi.sh OUTPUT_FILE GITHUB_OUTPUT}"
main_url="https://raw.githubusercontent.com/pinpols/file-batch-system/main/docs/api/console-api.openapi.yaml"
contract_url="${BE_OPENAPI_URL_OVERRIDE:-}"

if [[ -z "$contract_url" && "${GITHUB_EVENT_NAME:-}" == "pull_request" && -n "${BACKEND_API_REF:-}" ]]; then
  if ! git check-ref-format --branch "$BACKEND_API_REF" >/dev/null; then
    echo "Invalid backend contract ref: $BACKEND_API_REF" >&2
    exit 1
  fi

  paired_url="https://raw.githubusercontent.com/pinpols/file-batch-system/${BACKEND_API_REF}/docs/api/console-api.openapi.yaml"
  status="$(curl -sSL -o "$output_file" -w '%{http_code}' "$paired_url")" || {
    echo "Unable to fetch paired backend contract: $paired_url" >&2
    exit 1
  }
  if [[ "$status" == "200" ]]; then
    echo "Using paired backend contract ref: $BACKEND_API_REF"
    echo "path=$output_file" >> "$github_output"
    exit 0
  elif [[ "$status" != "404" ]]; then
    echo "Unexpected HTTP $status fetching paired backend contract: $paired_url" >&2
    exit 1
  fi
  echo "No paired backend branch found; falling back to main."
fi

if [[ -n "$contract_url" ]]; then
  source_url="$contract_url"
else
  source_url="$main_url"
fi

curl -fsSL "$source_url" -o "$output_file"
echo "Using backend contract: $source_url"
echo "path=$output_file" >> "$github_output"
