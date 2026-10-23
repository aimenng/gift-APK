-- SUPERSEDED by migration_20261024_invite_code_constraint_from_env.sql — do not rely on
-- the constraint this file creates.
--
-- This migration originally pinned two specific personal email addresses to two specific
-- invite codes inside the CHECK constraint. Those literals have been redacted: the
-- repository is public, and the reserved email -> code mapping now lives in the backend's
-- BACKEND_FIXED_INVITE_CODES environment variable instead of in source.
--
-- Fresh installs should run schema.sql (which carries the current, relaxed constraint) or
-- run this file followed by migration_20261024_invite_code_constraint_from_env.sql, which
-- replaces the constraint outright. Existing databases that already applied the original
-- version are unaffected — the 20261024 migration drops and recreates the constraint.
--
-- Restrict invitation_code rules:
-- 1) reserved addresses listed in BACKEND_FIXED_INVITE_CODES use their configured code
-- 2) all other users must use GIFT-XXXX (uppercase alnum)

begin;

alter table public.users
  drop constraint if exists users_invitation_code_format_check;

alter table public.users
  add constraint users_invitation_code_format_check
  check (
    invitation_code is null
    or invitation_code ~ '^GIFT-[A-Z0-9]{4}$'
  );

commit;
