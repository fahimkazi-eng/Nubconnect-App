-- ============================================================================
-- NUBCONNECT — Auth row hardening (Phase 5 groundwork)
-- Migration: 009_auth_user_defaults.sql
--
-- WHY THIS EXISTS
-- ---------------
-- Supabase Auth (GoTrue) reads `auth.users` into a Go struct where most token
-- columns are plain strings. A row that stores NULL in those columns cannot
-- be scanned, so `findUser` fails and every sign-in attempt for that account
-- returns HTTP 500 "Database error querying schema" — a silent, total
-- sign-out failure with no useful server-side message.
--
-- GoTrue always writes those columns explicitly, so a normal sign-up is fine.
-- The failure appears whenever an account is created outside the sign-up path
-- (QA tooling, an admin script, a restored backup): the INSERT omits the
-- token columns, so they stay NULL instead of ''.
--
-- This migration makes the table match the shape GoTrue expects:
--   1. Existing NULL rows are normalised to the values GoTrue writes.
--   2. The columns get those values as DEFAULTS, so future inserts are safe
--      too. Step 2 needs ownership of auth.users, which only the project's
--      SQL owner has; step 1 only needs UPDATE and always runs.
--
-- Additive and non-destructive: no row is deleted, no real value is
-- overwritten (only NULL becomes the value GoTrue would have written), and no
-- RLS policy, trigger or function is touched. Re-running it is safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Normalise rows that predate the expected shape.
--    UPDATE on auth.users is granted to the project database role, so this
--    part runs for anyone applying the bundle.
-- ----------------------------------------------------------------------------
UPDATE auth.users
   SET aud                          = COALESCE(aud, 'authenticated'),
       role                         = COALESCE(role, 'authenticated'),
       confirmation_token           = COALESCE(confirmation_token, ''),
       recovery_token               = COALESCE(recovery_token, ''),
       email_change_token_current   = COALESCE(email_change_token_current, ''),
       email_change_token_new       = COALESCE(email_change_token_new, ''),
       email_change                 = COALESCE(email_change, ''),
       phone_change_token           = COALESCE(phone_change_token, ''),
       phone_change                 = COALESCE(phone_change, ''),
       reauthentication_token       = COALESCE(reauthentication_token, ''),
       email_change_confirm_status  = COALESCE(email_change_confirm_status, 0),
       is_super_admin               = COALESCE(is_super_admin, false),
       raw_app_meta_data            = COALESCE(raw_app_meta_data, '{}'::jsonb),
       raw_user_meta_data           = COALESCE(raw_user_meta_data, '{}'::jsonb)
 WHERE aud IS NULL
    OR role IS NULL
    OR confirmation_token IS NULL
    OR recovery_token IS NULL
    OR email_change_token_current IS NULL
    OR email_change_token_new IS NULL
    OR email_change IS NULL
    OR phone_change_token IS NULL
    OR phone_change IS NULL
    OR reauthentication_token IS NULL
    OR email_change_confirm_status IS NULL
    OR is_super_admin IS NULL
    OR raw_app_meta_data IS NULL
    OR raw_user_meta_data IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Give the same columns those values as DEFAULTS, so an account inserted
--    by tooling is never left with NULLs again.
--
--    auth.users is owned by Supabase Auth, so ALTER TABLE needs the project
--    owner. When this migration is applied by a role that does not own the
--    table the step is skipped with a notice instead of failing the whole
--    bundle; run it once from the Supabase SQL editor to enable it.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  SELECT EXISTS (
           SELECT 1
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'auth'
              AND c.relname = 'users'
              AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
         ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE NOTICE
      '009: skipping auth.users defaults — current role % does not own auth.users. Run this file from the Supabase SQL editor as the project owner to enable them.',
      current_user;
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN aud SET DEFAULT ''authenticated''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN role SET DEFAULT ''authenticated''';

  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN confirmation_token SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN recovery_token SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN email_change_token_current SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN email_change_token_new SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN email_change SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN phone_change_token SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN phone_change SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN reauthentication_token SET DEFAULT ''''';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN email_change_confirm_status SET DEFAULT 0';

  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN is_super_admin SET DEFAULT false';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN raw_app_meta_data SET DEFAULT ''{}''::jsonb';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN raw_user_meta_data SET DEFAULT ''{}''::jsonb';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN created_at SET DEFAULT now()';
  EXECUTE 'ALTER TABLE auth.users ALTER COLUMN updated_at SET DEFAULT now()';

  RAISE NOTICE '009: auth.users defaults applied.';
END
$$;

-- ----------------------------------------------------------------------------
-- 3. Identities always carry the owner's email.
--    `auth.identities.email` is generated from identity_data, so an identity
--    row without an email produces NULL there. This mirrors the backfill
--    Supabase Auth runs for invited users.
-- ----------------------------------------------------------------------------
UPDATE auth.identities AS i
   SET identity_data = i.identity_data || jsonb_build_object('email', u.email)
  FROM auth.users AS u
 WHERE u.id = i.user_id
   AND u.email IS NOT NULL
   AND i.identity_data ->> 'email' IS NULL;
