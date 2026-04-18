#!/bin/zsh

set -euo pipefail

ACTION="${1:-}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

NPM_BIN="${NPM:-npm}"
DEV_HOST="${DEV_HOST:-0.0.0.0}"
PORT="${PORT:-5173}"
EXTRA_PORTS="${EXTRA_PORTS:-5174}"
PID_FILE="${DEV_PID_FILE:-$ROOT_DIR/.vite-dev.pid}"
LOG_FILE="${DEV_LOG_FILE:-$ROOT_DIR/.vite-dev.log}"
STOP_WAIT_SECONDS="${STOP_WAIT_SECONDS:-10}"
START_WAIT_SECONDS="${START_WAIT_SECONDS:-15}"

is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

wait_for_exit() {
  local pid="$1"
  local deadline=$((SECONDS + STOP_WAIT_SECONDS))

  while kill -0 "$pid" 2>/dev/null; do
    if (( SECONDS >= deadline )); then
      return 1
    fi
    sleep 1
  done

  return 0
}

wait_for_start() {
  local pid="$1"
  local deadline=$((SECONDS + START_WAIT_SECONDS))

  while (( SECONDS < deadline )); do
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done

  return 1
}

remove_stale_pid() {
  if [[ -f "$PID_FILE" ]] && ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Removing stale PID file: $PID_FILE"
    rm -f "$PID_FILE"
  fi
}

target_ports() {
  printf '%s\n' "$PORT"
  printf '%s\n' "$EXTRA_PORTS" | tr ', ' '\n' | sed '/^$/d'
}

port_pids() {
  target_ports | while IFS= read -r target_port; do
    [[ -z "$target_port" ]] && continue
    lsof -ti tcp:"$target_port" 2>/dev/null || true
  done | tr ' ' '\n' | sed '/^$/d' | sort -u
}

kill_port_processes() {
  local pids
  pids="$(port_pids || true)"

  if [[ -z "$pids" ]]; then
    return 0
  fi

  echo "Cleaning up processes on target ports: $(echo "$pids" | tr '\n' ' ')"
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    kill "$pid" 2>/dev/null || true
  done <<< "$pids"

  sleep 1

  pids="$(port_pids || true)"
  if [[ -n "$pids" ]]; then
    echo "Force killing remaining processes on target ports: $(echo "$pids" | tr '\n' ' ')"
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      kill -9 "$pid" 2>/dev/null || true
    done <<< "$pids"
  fi
}

start_foreground() {
  cd "$ROOT_DIR"
  remove_stale_pid

  if is_running; then
    echo "Frontend dev server is already running in background with PID $(cat "$PID_FILE"). Stop it first with 'make stop'."
    exit 1
  fi

  kill_port_processes
  exec "$NPM_BIN" run dev -- --host "$DEV_HOST" --port "$PORT"
}

start_background() {
  cd "$ROOT_DIR"
  remove_stale_pid

  if is_running; then
    echo "Frontend dev server is already running with PID $(cat "$PID_FILE")"
    return 0
  fi

  kill_port_processes

  echo "Starting frontend dev server on http://$DEV_HOST:$PORT"
  nohup "$NPM_BIN" run dev -- --host "$DEV_HOST" --port "$PORT" > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  if ! wait_for_start "$(cat "$PID_FILE")"; then
    echo "Frontend dev server failed to stay running"
    rm -f "$PID_FILE"
    exit 1
  fi
  echo "Started with PID $(cat "$PID_FILE")"
  echo "Log file: $LOG_FILE"
}

stop_background() {
  remove_stale_pid

  if is_running; then
    echo "Stopping frontend dev server PID $(cat "$PID_FILE")"
    kill "$(cat "$PID_FILE")"
    if ! wait_for_exit "$(cat "$PID_FILE")"; then
      echo "Process did not exit after SIGTERM, force killing PID $(cat "$PID_FILE")"
      kill -9 "$(cat "$PID_FILE")" 2>/dev/null || true
      if ! wait_for_exit "$(cat "$PID_FILE")"; then
        echo "Failed to stop frontend dev server PID $(cat "$PID_FILE")"
        exit 1
      fi
    fi
    rm -f "$PID_FILE"
    kill_port_processes
    if [[ -n "$(port_pids || true)" ]]; then
      echo "Target ports are still occupied after stop"
      exit 1
    fi
    echo "Frontend dev server stopped"
  else
    echo "No running frontend dev server found"
    rm -f "$PID_FILE"
    kill_port_processes
  fi
}

show_status() {
  remove_stale_pid

  if is_running; then
    echo "Frontend dev server is running with PID $(cat "$PID_FILE")"
    echo "URL: http://$DEV_HOST:$PORT"
    echo "Log file: $LOG_FILE"
  else
    echo "Frontend dev server is not running"
  fi
}

show_logs() {
  if [[ -f "$LOG_FILE" ]]; then
    tail -f "$LOG_FILE"
  else
    echo "Log file not found: $LOG_FILE"
  fi
}

case "$ACTION" in
  dev)
    start_foreground
    ;;
  start)
    start_background
    ;;
  stop)
    stop_background
    ;;
  restart)
    stop_background
    start_background
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  *)
    echo "Usage: scripts/dev-server.sh {dev|start|stop|restart|status|logs}"
    exit 1
    ;;
esac
