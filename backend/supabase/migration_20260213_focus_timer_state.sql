-- Incremental migration for cloud focus timer state.
-- Run this in Supabase SQL Editor.

begin;

create table if not exists public.focus_timer_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  mode text not null default 'countdown' check (mode in ('countdown', 'countup')),
  initial_seconds integer not null default 1500 check (initial_seconds >= 1 and initial_seconds <= 7200),
  current_seconds integer not null default 1500 check (current_seconds >= 0 and current_seconds <= 86400),
  is_active boolean not null default false,
  started_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_focus_timer_state_active
  on public.focus_timer_state (is_active, updated_at desc);

commit;

