#!/usr/bin/env bash
# 启动本例独占的临时 Worker：路径和参数全部由调用方显式传入，脚本只负责加载配对后端的本地
# 环境变量并 exec Java。调用方用 `spawn('bash', [start-worker.sh, ...])` 传参，避免把绝对路径
# 拼进 `bash -c` 命令串（CodeQL js/shell-command-injection-from-environment）。
#
# 用法：
#   start-worker.sh <后端根目录> <JAR> <profile> <worker-kind> <worker-code> <tenant-id> <consumer-group>
#     [--java-opt <JVM 参数>]... [-- <应用参数>...]
set -euo pipefail

BACKEND_ROOT="$1"
JAR="$2"
PROFILE="$3"
WORKER_KIND="$4"
WORKER_CODE="$5"
TENANT_ID="$6"
CONSUMER_GROUP="$7"
shift 7

JAVA_OPTS=()
APP_ARGS=()
while (($#)); do
  case "$1" in
    --java-opt)
      JAVA_OPTS+=("$2")
      shift 2
      ;;
    --)
      shift
      APP_ARGS=("$@")
      break
      ;;
    *)
      APP_ARGS+=("$1")
      shift
      ;;
  esac
done

cd "$BACKEND_ROOT"
# shellcheck disable=SC1090 # 路径来自配对后端仓库，shellcheck 无法静态解析
source "$BACKEND_ROOT/scripts/lib/env-common.sh"
batch_configure_local_jvm_control_plane_env
batch_configure_local_jvm_runtime_env

exec java \
  --enable-native-access=ALL-UNNAMED \
  -XX:TieredStopAtLevel=1 \
  -XX:+UseSerialGC \
  -Xshare:off \
  ${JAVA_OPTS[@]+"${JAVA_OPTS[@]}"} \
  -jar "$JAR" \
  --spring.profiles.active="$PROFILE" \
  "--batch.worker.${WORKER_KIND}.worker-code=$WORKER_CODE" \
  "--batch.worker.${WORKER_KIND}.tenant-id=$TENANT_ID" \
  "--batch.worker.${WORKER_KIND}.consumer-group-id=$CONSUMER_GROUP" \
  --batch.worker.kafka.subscribe-mode=TENANT_SCOPED \
  "--batch.worker.kafka.tenant-allowlist=$TENANT_ID" \
  --server.port=0 \
  ${APP_ARGS[@]+"${APP_ARGS[@]}"}
