-- Incremental migration: atomic email verification attempt counting.
-- Run this in Supabase SQL Editor.
--
-- Both /auth/register/verify and /auth/password/reset used to guard the 6-digit code like
-- this: read the row, check `attempts >= 5`, and only on a wrong code write `attempts + 1`
-- back. That is a read-then-write, so N requests fired in parallel all read the same
-- pre-increment count, all passed the check, and each got a free guess — the attempt cap
-- multiplied by however much concurrency the attacker wanted.
--
-- Incrementing inside a single UPDATE makes Postgres take the row lock, so concurrent
-- callers serialize and each one sees the count left by the previous.

begin;

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

comment on function public.consume_verification_attempt(uuid) is
  'Atomically burns one verification attempt and returns the new count. Returns no row if the verification record is gone.';

-- PostgREST caches the schema, so a brand new function can 404 on /rpc/ until it reloads.
notify pgrst, 'reload schema';

commit;
