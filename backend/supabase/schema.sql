create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  invitation_code text null,
  bound_invitation_code text null,
  email_verified boolean not null default false,
  token_version integer not null default 0 check (token_version >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  name text null,
  avatar text null,
  gender text not null default 'male' check (gender in ('male', 'female')),
  partner_id uuid null references public.users(id) on delete set null
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  together_date date not null default '2021-10-12',
  is_connected boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  date text not null,
  image text not null,
  rotation text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  subtitle text null,
  date text not null,
  type text not null,
  image text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.period_tracker_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  entry_date date not null,
  is_period boolean not null default false,
  mood text null,
  flow text null check (flow in ('light', 'medium', 'heavy')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, entry_date)
);

create table if not exists public.focus_stats (
  user_id uuid primary key references public.users(id) on delete cascade,
  today_focus_minutes integer not null default 0,
  today_sessions integer not null default 0,
  streak integer not null default 0,
  total_sessions integer not null default 0,
  last_focus_date date null,
  updated_at timestamptz not null default timezone('utc', now()),
  check (today_focus_minutes >= 0),
  check (today_sessions >= 0),
  check (streak >= 0),
  check (total_sessions >= 0)
);

create table if not exists public.focus_timer_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  mode text not null default 'countdown' check (mode in ('countdown', 'countup')),
  initial_seconds integer not null default 1500 check (initial_seconds >= 1 and initial_seconds <= 7200),
  current_seconds integer not null default 1500 check (current_seconds >= 0 and current_seconds <= 86400),
  is_active boolean not null default false,
  started_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'system' check (type in ('system', 'interaction')),
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('signup', 'reset_password')),
  code_hash text not null,
  password_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  last_sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (email, purpose)
);

create table if not exists public.binding_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  invite_code text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  confirmed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.users add column if not exists invitation_code text null;
alter table public.users add column if not exists bound_invitation_code text null;
alter table public.users add column if not exists email_verified boolean not null default false;
alter table public.users add column if not exists token_version integer not null default 0;
update public.users set token_version = 0 where token_version is null;
alter table public.users drop constraint if exists users_token_version_non_negative;
alter table public.users add constraint users_token_version_non_negative check (token_version >= 0);

-- Loose shape check only. The real policy (GIFT-XXXX plus any reserved codes configured
-- via BACKEND_FIXED_INVITE_CODES) is enforced by assertInviteCode in the backend. Kept in
-- sync with migration_20261024_invite_code_constraint_from_env.sql so a fresh install
-- behaves like a migrated one.
alter table public.users drop constraint if exists users_invitation_code_format_check;
alter table public.users add constraint users_invitation_code_format_check
  check (invitation_code is null or invitation_code ~ '^[A-Z0-9-]{4,16}$');

create unique index if not exists idx_users_invitation_code_unique on public.users (invitation_code) where invitation_code is not null;
create index if not exists idx_users_partner_id on public.users (partner_id);
create index if not exists idx_users_bound_invitation_code on public.users (bound_invitation_code);
create index if not exists idx_memories_user_id on public.memories (user_id);
create index if not exists idx_events_user_id on public.events (user_id);
create index if not exists idx_period_tracker_user_date on public.period_tracker_entries (user_id, entry_date desc);
create index if not exists idx_period_tracker_entry_date on public.period_tracker_entries (entry_date desc);
create index if not exists idx_focus_stats_last_focus_date on public.focus_stats (last_focus_date desc nulls last);
create index if not exists idx_focus_timer_state_active on public.focus_timer_state (is_active, updated_at desc);
create index if not exists idx_notifications_user_id on public.notifications (user_id);
create index if not exists idx_email_verifications_expires_at on public.email_verifications (expires_at);
create unique index if not exists idx_binding_requests_requester_pending_unique on public.binding_requests (requester_user_id) where status = 'pending';
create unique index if not exists idx_binding_requests_target_pending_unique on public.binding_requests (target_user_id) where status = 'pending';
create index if not exists idx_binding_requests_pending_expires_at on public.binding_requests (expires_at) where status = 'pending';

-- Atomic focus session completion. See migration_20261024_focus_session_atomic.sql for
-- why the read-modify-write has to happen inside a single locked transaction.
create or replace function public.complete_focus_session(
  p_user_id uuid,
  p_focus_minutes integer,
  p_today date
)
returns public.focus_stats
language plpgsql
set search_path = public
as $$
declare
  v_row public.focus_stats%rowtype;
  v_prev_date date;
  v_prev_streak integer;
  v_today_focus integer;
  v_today_sessions integer;
  v_streak integer;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_focus_minutes is null or p_focus_minutes < 1 then
    raise exception 'p_focus_minutes must be at least 1';
  end if;

  if p_today is null then
    raise exception 'p_today is required';
  end if;

  select * into v_row
    from public.focus_stats
   where user_id = p_user_id
     for update;

  if not found then
    insert into public.focus_stats (
      user_id,
      today_focus_minutes,
      today_sessions,
      streak,
      total_sessions,
      last_focus_date,
      updated_at
    ) values (
      p_user_id, 0, 0, 0, 0, null, timezone('utc', now())
    )
    on conflict (user_id) do update
       set user_id = excluded.user_id
    returning * into v_row;

    select * into v_row
      from public.focus_stats
     where user_id = p_user_id
       for update;
  end if;

  v_prev_date := v_row.last_focus_date;
  v_prev_streak := coalesce(v_row.streak, 0);

  if v_prev_date = p_today then
    v_today_focus := coalesce(v_row.today_focus_minutes, 0) + p_focus_minutes;
    v_today_sessions := coalesce(v_row.today_sessions, 0) + 1;
    v_streak := case when v_prev_streak > 0 then v_prev_streak else 1 end;
  else
    v_today_focus := p_focus_minutes;
    v_today_sessions := 1;
    v_streak := case
                  when v_prev_date is not null and (p_today - v_prev_date) = 1
                    then greatest(1, v_prev_streak + 1)
                  else 1
                end;
  end if;

  update public.focus_stats
     set today_focus_minutes = v_today_focus,
         today_sessions = v_today_sessions,
         streak = v_streak,
         total_sessions = coalesce(total_sessions, 0) + 1,
         last_focus_date = p_today,
         updated_at = timezone('utc', now())
   where user_id = p_user_id
  returning * into v_row;

  return v_row;
end;
$$;

-- PostgREST caches the schema, so a brand new function can 404 on /rpc/ until it reloads.
notify pgrst, 'reload schema';

-- Atomic verification attempt counting. See
-- migration_20261024_atomic_verification_attempts.sql for why this has to be one UPDATE.
create or replace function public.consume_verification_attempt(p_id uuid)
returns integer
language sql
set search_path = public
as $$
  update public.email_verifications
     set attempts = coalesce(attempts, 0) + 1,
         updated_at = timezone('utc', now())
   where id = p_id
  returning attempts;
$$;

-- Applied-migration ledger for scripts/apply-supabase-migrations.sh. Declared here as well
-- so a database created from schema.sql can use the migration workflow immediately; the
-- script also creates it idempotently. RLS is enabled with no policies, matching the
-- lockdown migration — only the backend service role and direct psql may touch it.
create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default timezone('utc', now())
);
alter table public.schema_migrations enable row level security;
