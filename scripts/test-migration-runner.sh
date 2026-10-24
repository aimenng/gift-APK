#!/usr/bin/env bash
# 用桩 psql 验证 scripts/apply-supabase-migrations.sh 的选择、顺序、记录与失败中止逻辑。
# 不连任何数据库，也不会改动 backend/supabase 里的真实文件。
#
#   npm run test:migrations
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/apply-supabase-migrations.sh"
FIXTURE_DIR="$REPO_ROOT/scripts/test-fixtures"

WORK="$(mktemp -d)"
export STUB_STATE="$WORK/ledger.txt"
export STUB_LOG="$WORK/calls.txt"

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

pass=0
fail=0
check() {
  if [ "$2" = "1" ]; then
    pass=$((pass + 1))
    echo "  PASS  $1"
  else
    fail=$((fail + 1))
    echo "  FAIL  $1  ${3:-}"
  fi
}

reset_state() { rm -f "$STUB_STATE" "$STUB_LOG"; touch "$STUB_STATE"; }
# grep -c 在无匹配时会打印 0 并以 1 退出，所以不能用 `|| echo 0`（会得到 "0\n0"）。
count_executed() {
  if [ ! -f "$STUB_LOG" ]; then
    echo 0
    return
  fi
  grep -c '\[stub\] EXECUTE' "$STUB_LOG" || true
}
reset_url() { export SUPABASE_DB_URL="postgresql://postgres:secret@db.example.supabase.co:5432/postgres"; }

command -v node >/dev/null || { echo "需要 node 来解析连接串"; exit 1; }

# 桩必须排在真实 psql 前面。
export PATH="$FIXTURE_DIR:$PATH"
reset_url

echo "=== 桩就位 ==="
which psql

echo
echo "[1] list：空账本时不执行任何 SQL"
reset_state
out=$(cd "$REPO_ROOT" && bash "$SCRIPT" list 2>&1); rc=$?
check "exit 0" "$([ $rc -eq 0 ] && echo 1 || echo 0)" "rc=$rc"
check "没有执行任何 SQL 文件" "$([ "$(count_executed)" = "0" ] && echo 1 || echo 0)"
check "列出了待执行文件" "$(grep -q '待执行：' <<<"$out" && echo 1 || echo 0)" "$out"

total="$(cd "$REPO_ROOT/backend/supabase" && ls -1 migration_*.sql | wc -l)"
check "待执行数量等于文件总数($total)" "$(grep -q "待执行：$total 个文件" <<<"$out" && echo 1 || echo 0)" "$out"

echo
echo "[2] bootstrap：标记全部但不执行"
reset_state
out=$(cd "$REPO_ROOT" && bash "$SCRIPT" bootstrap 2>&1); rc=$?
check "exit 0" "$([ $rc -eq 0 ] && echo 1 || echo 0)" "rc=$rc"
check "没有执行任何 SQL 文件" "$([ "$(count_executed)" = "0" ] && echo 1 || echo 0)"
check "账本写入 $total 条" "$([ "$(grep -c . "$STUB_STATE")" = "$total" ] && echo 1 || echo 0)" "$(grep -c . "$STUB_STATE")"
out=$(cd "$REPO_ROOT" && bash "$SCRIPT" list 2>&1)
check "之后 list 显示已最新" "$(grep -q '数据库已是最新' <<<"$out" && echo 1 || echo 0)" "$out"

echo
echo "[3] apply：只执行未记录的那个"
reset_state
cd "$REPO_ROOT" && bash "$SCRIPT" bootstrap >/dev/null 2>&1
dropped="$(cd "$REPO_ROOT/backend/supabase" && ls -1 migration_*.sql | tail -1)"
sed -i "\|^${dropped}\$|d" "$STUB_STATE"
out=$(cd "$REPO_ROOT" && bash "$SCRIPT" list 2>&1)
check "list 只列出被删记录的那个" "$(grep -q '待执行：1 个文件' <<<"$out" && grep -qF "$dropped" <<<"$out" && echo 1 || echo 0)" "$out"
out=$(cd "$REPO_ROOT" && bash "$SCRIPT" apply 2>&1); rc=$?
check "apply exit 0" "$([ $rc -eq 0 ] && echo 1 || echo 0)" "rc=$rc"
check "只执行了一个文件" "$([ "$(count_executed)" = "1" ] && echo 1 || echo 0)" "$(cat "$STUB_LOG")"
check "执行的是那个文件" "$(grep -qF "EXECUTE $dropped" "$STUB_LOG" && echo 1 || echo 0)" "$(cat "$STUB_LOG")"
check "执行后写入账本" "$(grep -qxF "$dropped" "$STUB_STATE" && echo 1 || echo 0)"
check "触发了 schema reload" "$(grep -q 'reload schema' "$STUB_LOG" && echo 1 || echo 0)"
out=$(cd "$REPO_ROOT" && bash "$SCRIPT" list 2>&1)
check "再次 list 已最新" "$(grep -q '数据库已是最新' <<<"$out" && echo 1 || echo 0)"

echo
echo "[4] apply 失败即中止，不写记录、不继续"
reset_state
FAKE="$WORK/fake-migrations"
mkdir -p "$FAKE"
printf 'begin;\nselect 1;\ncommit;\n' > "$FAKE/migration_20260101_aaa.sql"
printf 'begin;\nselect 1;\ncommit;\n' > "$FAKE/migration_20260102_explode_bbb.sql"
printf 'begin;\nselect 1;\ncommit;\n' > "$FAKE/migration_20260103_ccc.sql"
out=$(cd "$REPO_ROOT" && bash "$SCRIPT" apply "$FAKE" 2>&1); rc=$?
check "exit 非 0" "$([ $rc -ne 0 ] && echo 1 || echo 0)" "rc=$rc"
check "第一个已记录" "$(grep -qx 'migration_20260101_aaa.sql' "$STUB_STATE" && echo 1 || echo 0)" "$(cat "$STUB_STATE")"
check "失败的未记录" "$(! grep -q 'explode' "$STUB_STATE" && echo 1 || echo 0)" "$(cat "$STUB_STATE")"
check "没有继续执行第三个" "$(! grep -q 'EXECUTE migration_20260103_ccc.sql' "$STUB_LOG" && echo 1 || echo 0)" "$(cat "$STUB_LOG")"
check "没有触发 reload" "$(! grep -q 'reload schema' "$STUB_LOG" && echo 1 || echo 0)"

echo
echo "[5] 参数校验"
out=$(cd "$REPO_ROOT" && SUPABASE_DB_URL="" bash "$SCRIPT" list 2>&1); rc=$?
check "缺连接串时 exit 非 0" "$([ $rc -ne 0 ] && echo 1 || echo 0)" "rc=$rc"
check "提示 SUPABASE_DB_URL" "$(grep -q 'SUPABASE_DB_URL' <<<"$out" && echo 1 || echo 0)"
out=$(cd "$REPO_ROOT" && bash "$SCRIPT" destroy 2>&1); rc=$?
check "未知模式被拒绝" "$([ $rc -ne 0 ] && echo 1 || echo 0)" "rc=$rc"
check "提示可用模式" "$(grep -q 'list / apply / bootstrap' <<<"$out" && echo 1 || echo 0)"

echo
echo "[6] 没有把 psql 变量塞进 -c 字符串"
# 真 psql 不对 -c 的字符串做变量插值：`-c "... values (:'v')"` 会被原样发给服务端并报
# syntax error。这个 bug 真实发生过一次，而当时的桩「好心」帮脚本补了变量，所以没测出来。
bad="$(grep -n -- '-c "' "$SCRIPT" | grep ":'" || true)"
check "脚本里没有 -c + 变量组合" "$([ -z "$bad" ] && echo 1 || echo 0)" "$bad"

echo
echo "[7] 输出不泄露连接串里的密码"
reset_state
cd "$REPO_ROOT" && bash "$SCRIPT" list > "$WORK/out.txt" 2>&1
check "不含密码" "$(! grep -q 'secret' "$WORK/out.txt" && echo 1 || echo 0)" "$(cat "$WORK/out.txt")"
check "打印了主机与库名" "$(grep -q 'db.example.supabase.co:5432/postgres' "$WORK/out.txt" && echo 1 || echo 0)"

echo
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
