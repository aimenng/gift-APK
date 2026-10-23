-- Incremental migration: stop hardcoding personal emails in the invite-code constraint.
-- Run this in Supabase SQL Editor.
--
-- migration_20260211_invite_code_format_guard.sql pinned two real email addresses to two
-- specific invite codes inside a CHECK constraint, which put personal data in a public
-- repository. The mapping now lives in the backend's BACKEND_FIXED_INVITE_CODES
-- environment variable, so the database only needs a loose shape check to keep garbage
-- out. The application layer (assertInviteCode in backend/src/helpers.js) is what
-- enforces the real policy.
--
-- The new pattern still matches every code the old constraint allowed, so existing rows
-- validate cleanly: the 9-character GIFT-XXXX codes and the two reserved 7-character
-- XXX-XXX codes.

begin;

alter table public.users
  drop constraint if exists users_invitation_code_format_check;

alter table public.users
  add constraint users_invitation_code_format_check
  check (
    invitation_code is null
    or invitation_code ~ '^[A-Z0-9-]{4,16}$'
  );

commit;
