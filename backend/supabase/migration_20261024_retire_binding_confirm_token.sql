-- Incremental migration: retire the never-delivered email binding confirmation flow.
-- Run this in Supabase SQL Editor. Order does not matter relative to the backend deploy —
-- see the note below.
--
-- sendBindingConfirmEmail had zero call sites: confirm_token was generated and stored on
-- every binding request but never emailed to anybody, so GET /bindings/confirm could never
-- be reached legitimately. Accepting or rejecting inside the app (/bindings/:id/respond)
-- was and remains the only working path. That route, the token generation, the HTML email
-- template and the now-unused config.backendPublicUrl have all been deleted from the backend.
--
-- The column is made nullable rather than dropped, on purpose. Dropping it would break a
-- backend still running the old code (it inserts a token), while leaving it NOT NULL would
-- break the new code (it no longer supplies one). Nullable satisfies both, so there is no
-- unsafe deploy window.
--
-- The stored tokens were never sent to anyone and have no value, so the column can be
-- dropped later at leisure once every deployment is on the new code:
--
--   alter table public.binding_requests drop column if exists confirm_token;

begin;

alter table public.binding_requests
  alter column confirm_token drop not null;

commit;
