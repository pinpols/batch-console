#!/usr/bin/env bash
# Phase 1 API CRUD 公共函数库。被 api-crud.sh source。

API_BASE="${BC_API_BASE:-http://localhost:18080}"
TENANT="${BC_TX_TENANT:-tx}"
JAR="${BC_JAR:-/tmp/api-crud.jar}"
REPORT="${BC_REPORT:-/tmp/api-crud-report.md}"

# 统计
TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0

# 颜色(stderr 走 tty 才上色)
_red()  { printf '\033[31m%s\033[0m' "$1"; }
_grn()  { printf '\033[32m%s\033[0m' "$1"; }
_yel()  { printf '\033[33m%s\033[0m' "$1"; }

login_admin() {
  curl -sf -c "$JAR" -X POST "$API_BASE/api/console/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' > /dev/null
  if [ $? -ne 0 ]; then
    echo "FATAL: admin 登录失败" >&2
    exit 1
  fi
}

# api_call <method> <path> <body-or-empty> -> stdout: response body; stderr: HTTP code
# 用 -w 抓 HTTP 码,合并到响应末尾再用 sed 切
# 自动:
#   - 若 path 没带 tenantId,自动追加 ?tenantId=$TENANT(部分 BE 用 @RequestParam,不读 body)
#   - POST/PUT/DELETE 补 Idempotency-Key
api_call() {
  local method="$1"
  local path="$2"
  local body="$3"
  local hdrs=(-H "X-Tenant-Id: $TENANT" -H "Content-Type: application/json")
  if [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "DELETE" ]; then
    hdrs+=(-H "Idempotency-Key: $(uuidgen)")
  fi
  # 兼容两种 BE 风格:tenantId 可能在 body / 在 query。这里强制追加 query,
  # 已有 ?tenantId 不重复;已有 ? 但没 tenantId 就用 &
  if [[ "$path" != *"tenantId="* ]]; then
    if [[ "$path" == *"?"* ]]; then
      path="${path}&tenantId=$TENANT"
    else
      path="${path}?tenantId=$TENANT"
    fi
  fi
  local args=(-s -b "$JAR" -X "$method" "${hdrs[@]}" "$API_BASE$path" -w "\n@@HTTP@@%{http_code}")
  if [ -n "$body" ]; then
    args+=(-d "$body")
  fi
  curl "${args[@]}" 2>/dev/null
}

# extract <json> <python-expr>
extract() {
  echo "$1" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print($2)
except Exception as e:
  print('',end='')
"
}

# 拆 api_call 输出: $1 = full output, $2 = ref var name 'body', $3 = ref var name 'code'
split_response() {
  local raw="$1"
  local code="${raw##*@@HTTP@@}"
  local body="${raw%@@HTTP@@*}"
  body="${body%$'\n'}"  # 去末尾换行
  printf '%s' "$body"
  printf '\n@@CODE@@%s' "$code"
}

# 跑一个实体的完整 CRUD,可选步骤通过 flags 控制
# crud_entity <label> <path> <create-payload> <update-payload> [flags] [list-path-override]
#   flags = 字符串组合: L(LIST) C(CREATE) R(READ) U(UPDATE) T(TOGGLE) D(DELETE)
#   list-path-override: 若 LIST 走另一个路径(比如 /api/console/queries/X),传入完整路径
crud_entity() {
  local label="$1"
  local path="$2"
  local create_payload="$3"
  local update_payload="$4"
  local flags="${5:-LCRUTD}"
  local list_path="${6:-$path}"
  local has_list=$([[ "$flags" == *L* ]] && echo 1 || echo 0)
  local has_create=$([[ "$flags" == *C* ]] && echo 1 || echo 0)
  local has_read=$([[ "$flags" == *R* ]] && echo 1 || echo 0)
  local has_update=$([[ "$flags" == *U* ]] && echo 1 || echo 0)
  local has_toggle=$([[ "$flags" == *T* ]] && echo 1 || echo 0)
  local has_delete=$([[ "$flags" == *D* ]] && echo 1 || echo 0)

  printf '\n=== %s (%s) ===\n' "$label" "$path"
  local step_pass=0 step_fail=0
  local entity_id=""
  local fail_log=""

  # 1. LIST
  local raw code body
  if [ "$has_list" = "1" ]; then
    raw=$(api_call GET "$list_path?tenantId=$TENANT&pageNo=1&pageSize=10" "")
    body="${raw%@@HTTP@@*}"
    code="${raw##*@@HTTP@@}"
    if [ "$code" = "200" ]; then
      printf "  [LIST]      "; _grn "PASS"; printf " HTTP %s\n" "$code"
      step_pass=$((step_pass+1))
    else
      printf "  [LIST]      "; _red "FAIL"; printf " HTTP %s\n" "$code"
      step_fail=$((step_fail+1))
      fail_log+="\n- LIST $path returned $code: $(echo "$body" | head -c 200)"
    fi
  fi

  # 2. CREATE
  if [ "$has_create" = "1" ]; then
    raw=$(api_call POST "$path" "$create_payload")
    body="${raw%@@HTTP@@*}"
    code="${raw##*@@HTTP@@}"
    if [ "$code" = "200" ] || [ "$code" = "201" ]; then
      entity_id=$(extract "$body" "(d.get('data') or {}).get('id','')")
      if [ -n "$entity_id" ]; then
        printf "  [CREATE]    "; _grn "PASS"; printf " HTTP %s id=%s\n" "$code" "$entity_id"
        step_pass=$((step_pass+1))
      else
        printf "  [CREATE]    "; _yel "WARN"; printf " HTTP %s 但响应无 id\n" "$code"
        step_pass=$((step_pass+1))
      fi
    else
      printf "  [CREATE]    "; _red "FAIL"; printf " HTTP %s\n" "$code"
      step_fail=$((step_fail+1))
      fail_log+="\n- CREATE $path returned $code:\n  payload: $(echo "$create_payload" | head -c 250)\n  response: $(echo "$body" | head -c 300)"
    fi
  fi

  if [ "$has_create" = "1" ] && [ -z "$entity_id" ]; then
    # CREATE 失败:后面依赖 id 的 step 都跳
    [ "$has_read" = "1" ]   && { printf "  [READ]      "; _yel "SKIP"; printf " (无 id)\n"; TOTAL_SKIP=$((TOTAL_SKIP+1)); }
    [ "$has_update" = "1" ] && { printf "  [UPDATE]    "; _yel "SKIP"; printf "\n";       TOTAL_SKIP=$((TOTAL_SKIP+1)); }
    [ "$has_toggle" = "1" ] && { printf "  [TOGGLE]    "; _yel "SKIP"; printf "\n";       TOTAL_SKIP=$((TOTAL_SKIP+1)); }
    [ "$has_delete" = "1" ] && { printf "  [DELETE]    "; _yel "SKIP"; printf "\n";       TOTAL_SKIP=$((TOTAL_SKIP+1)); }
    TOTAL_FAIL=$((TOTAL_FAIL + step_fail))
    TOTAL_PASS=$((TOTAL_PASS + step_pass))
    [ -n "$fail_log" ] && echo -e "### $label\n$fail_log" >> "$REPORT"
    return
  fi

  # 3. READ
  if [ "$has_read" = "1" ]; then
    raw=$(api_call GET "$path/$entity_id?tenantId=$TENANT" "")
    body="${raw%@@HTTP@@*}"
    code="${raw##*@@HTTP@@}"
    if [ "$code" = "200" ]; then
      printf "  [READ]      "; _grn "PASS"; printf " HTTP %s\n" "$code"
      step_pass=$((step_pass+1))
    else
      printf "  [READ]      "; _red "FAIL"; printf " HTTP %s\n" "$code"
      step_fail=$((step_fail+1))
      fail_log+="\n- READ $path/$entity_id returned $code: $(echo "$body" | head -c 200)"
    fi
  fi

  # 4. UPDATE
  if [ "$has_update" = "1" ]; then
    raw=$(api_call PUT "$path/$entity_id" "$update_payload")
    body="${raw%@@HTTP@@*}"
    code="${raw##*@@HTTP@@}"
    if [ "$code" = "200" ]; then
      printf "  [UPDATE]    "; _grn "PASS"; printf " HTTP %s\n" "$code"
      step_pass=$((step_pass+1))
    else
      printf "  [UPDATE]    "; _red "FAIL"; printf " HTTP %s\n" "$code"
      step_fail=$((step_fail+1))
      fail_log+="\n- UPDATE $path/$entity_id returned $code:\n  payload: $(echo "$update_payload" | head -c 250)\n  response: $(echo "$body" | head -c 300)"
    fi
  fi

  # 5. TOGGLE
  if [ "$has_toggle" = "1" ]; then
    raw=$(api_call POST "$path/$entity_id/toggle?tenantId=$TENANT&enabled=false" "")
    body="${raw%@@HTTP@@*}"
    code="${raw##*@@HTTP@@}"
    if [ "$code" = "200" ]; then
      printf "  [TOGGLE]    "; _grn "PASS"; printf " HTTP %s\n" "$code"
      step_pass=$((step_pass+1))
    else
      printf "  [TOGGLE]    "; _red "FAIL"; printf " HTTP %s\n" "$code"
      step_fail=$((step_fail+1))
      fail_log+="\n- TOGGLE $path/$entity_id/toggle returned $code: $(echo "$body" | head -c 200)"
    fi
  fi

  # 6. DELETE
  if [ "$has_delete" = "1" ]; then
    raw=$(api_call DELETE "$path/$entity_id?tenantId=$TENANT" "")
    body="${raw%@@HTTP@@*}"
    code="${raw##*@@HTTP@@}"
    if [ "$code" = "200" ] || [ "$code" = "204" ]; then
      printf "  [DELETE]    "; _grn "PASS"; printf " HTTP %s\n" "$code"
      step_pass=$((step_pass+1))
    else
      printf "  [DELETE]    "; _red "FAIL"; printf " HTTP %s\n" "$code"
      step_fail=$((step_fail+1))
      fail_log+="\n- DELETE $path/$entity_id returned $code: $(echo "$body" | head -c 200)"
    fi
  fi

  TOTAL_PASS=$((TOTAL_PASS + step_pass))
  TOTAL_FAIL=$((TOTAL_FAIL + step_fail))

  if [ -n "$fail_log" ]; then
    {
      echo
      echo "### $label"
      echo -e "$fail_log"
    } >> "$REPORT"
  fi
}
