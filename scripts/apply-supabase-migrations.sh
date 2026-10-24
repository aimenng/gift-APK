#!/usr/bin/env bash
# 把 backend/supabase 下尚未执行的 migration 应用到数据库。
#
# 用法：
#   SUPABASE_DB_URL=postgres://... bash scripts/apply-supabase-migrations.sh list
#   SUPABASE_DB_URL=postgres://... bash scripts/apply-supabase-migrations.sh apply
#   SUPABASE_DB_URL=postgres://... bash scripts/apply-supabase-migrations.sh bootstrap
#
# 三个模式：
#   list      只列出「已应用」和「待执行」，不碰数据库结构（默认）
#   apply     按文件名顺序执行所有未记录的文件，每个文件单独一个 psql 会话，
#             成功后才写入记录表；任何一个失败就中止，不会继续往下跑
#   bootstrap 首次接入自动化时使用：把当前所有 migration 文件标记为「已应用」但**不执行**。
#             这一步是必要的——这些文件此前已在 Supabase 控制台手工执行过，
#             重复执行 20260211 的严格邀请码约束会因存量数据而失败。
#
# 账本表 public.schema_migrations 由本脚本自动创建（幂等）。

set -euo pipefail

MODE="${1:-list}"
MIGRATION_DIR="${2:-backend/supabase}"

case "$MODE" in
  list|apply|bootstrap) ;;
  *)
    echo "未知模式：$MODE（可用：list / apply / bootstrap）" >&2
    exit 2
    ;;
esac

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "缺少环境变量 SUPABASE_DB_URL" >&2
  exit 2
fi

if [ ! -d "$MIGRATION_DIR" ]; then
  echo "找不到 migration 目录：$MIGRATION_DIR" >&2
  exit 2
fi

describe_url() {
  # 只打印主机和库名，避免把密码写进 CI 日志。
  node -e '
    const u = new URL(process.argv[1]);
    console.log(`${u.hostname}:${u.port || 5432}${u.pathname}`);
  ' "$SUPABASE_DB_URL" 2>/dev/null || echo "(无法解析连接串)"
}

echo "目标数据库：$(describe_url)"
echo "migration 目录：$MIGRATION_DIR"
echo "模式：$MODE"
echo

# 文件名即执行顺序：migration_YYYYMMDD_*.sql
mapfile -t FILES < <(cd "$MIGRATION_DIR" && ls -1 migration_*.sql 2>/dev/null | sort)
if [ "${#FILES[@]}" -eq 0 ]; then
  echo "目录里没有任何 migration_*.sql 文件" >&2
  exit 1
fi

echo "确保账本表存在…"
psql "$SUPABASE_DB_URL" -q -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default timezone('utc', now())
);
-- 与 20260211 的 lockdown 保持一致：后端用 service role 访问，匿名客户端不应能读写。
alter table public.schema_migrations enable row level security;
SQL
echo

applied_list=$(psql "$SUPABASE_DB_URL" -At -v ON_ERROR_STOP=1 \
  -c "select version from public.schema_migrations order by version")

is_applied() {
  [ -n "$applied_list" ] && grep -Fxq -- "$1" <<<"$applied_list"
}

record() {
  # psql 不对 `-c` 传入的字符串做变量插值，`values (:'v')` 会被原样发给服务端并报
  # `syntax error at or near ":"`（确实踩过）。改成从 stdin 送入，psql 才会把 :'v'
  # 替换成被正确引用和转义的字符串字面量。
  printf "insert into public.schema_migrations (version) values (:'v') on conflict (version) do nothing;\n" \
    | psql "$SUPABASE_DB_URL" -q -v ON_ERROR_STOP=1 -v "v=$1"
}

pending=()
for f in "${FILES[@]}"; do
  is_applied "$f" || pending+=("$f")
done

case "$MODE" in
  list)
    echo "已应用：$(printf '%s\n' "$applied_list" | grep -c . || true) 个文件"
    if [ "${#pending[@]}" -eq 0 ]; then
      echo "待执行：无，数据库已是最新。"
    else
      echo "待执行：${#pending[@]} 个文件"
      printf '  - %s\n' "${pending[@]}"
      echo
      echo "确认无误后，把 mode 改成 apply 再运行一次。"
    fi
    ;;

  bootstrap)
    echo "把以下 ${#FILES[@]} 个文件标记为已应用（不会执行其中的 SQL）："
    printf '  - %s\n' "${FILES[@]}"
    echo
    for f in "${FILES[@]}"; do
      record "$f"
    done
    echo "完成。之后的运行只会执行新增的文件。"
    ;;

  apply)
    if [ "${#pending[@]}" -eq 0 ]; then
      echo "待执行：无，数据库已是最新。"
      exit 0
    fi
    echo "将按顺序执行 ${#pending[@]} 个文件。"
    echo
    for f in "${pending[@]}"; do
      echo "──> 执行 $f"
      # 每个文件单独一个会话：文件内部自带 begin/commit，失败即中断，不写记录。
      psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_DIR/$f"
      record "$f"
      echo "    已记录"
    done
    # 新增或替换了函数/表之后，PostgREST 需要重载 schema 才能识别。
    psql "$SUPABASE_DB_URL" -q -v ON_ERROR_STOP=1 -c "notify pgrst, 'reload schema'"
    echo
    echo "全部完成（${#pending[@]} 个文件）。"
    ;;
esac
