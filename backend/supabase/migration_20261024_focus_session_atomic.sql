-- Incremental migration: atomic focus session completion.
-- Run this in Supabase SQL Editor.
--
-- PATCH /api/focus/stats/complete-session used to read the focus_stats row, compute the
-- new counters in JavaScript, then write them back. Two devices finishing a session at
-- the same time would both read the same row, and one increment of today_sessions /
-- total_sessions would be silently lost, with the streak computed from a stale value.
-- This moves the read-modify-write into a single transaction that locks the row first.
--
-- The "today" boundary is passed in by the backend (it owns the APP_TIMEZONE setting),
-- so the timezone logic stays in one place.

begin;

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

  -- Serialize concurrent completions for this user. Without the lock, two transactions
  -- can both read the pre-increment counters and the second write wins outright.
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
    -- Same day: accumulate.
    v_today_focus := coalesce(v_row.today_focus_minutes, 0) + p_focus_minutes;
    v_today_sessions := coalesce(v_row.today_sessions, 0) + 1;
    v_streak := case when v_prev_streak > 0 then v_prev_streak else 1 end;
  else
    -- New day (or first ever session): the stale today_* counters reset implicitly,
    -- matching what GET /focus/stats does when it detects a day rollover.
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

comment on function public.complete_focus_session(uuid, integer, date) is
  'Atomically records a finished focus session: increments today_* and total_sessions and recomputes the streak. p_today is the caller-local calendar day.';

-- PostgREST caches the schema, so a brand new function can 404 on /rpc/ until it reloads.
notify pgrst, 'reload schema';

commit;
