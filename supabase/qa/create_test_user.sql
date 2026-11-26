-- ============================================================================
-- NUBCONNECT — QA: create a sign-in-capable test student
-- File: supabase/qa/create_test_user.sql
--
-- WHY THIS FILE EXISTS
-- --------------------
-- Supabase Auth can only sign in accounts it can read back. GoTrue scans
-- `auth.users` into plain Go strings for most token columns, so a row that
-- leaves those columns NULL makes EVERY sign-in for that account fail with
-- HTTP 500 "Database error querying schema". Migration 009 gives the columns
-- the right defaults; this script writes a row in exactly that shape.
--
-- ALWAYS prefer the app's own sign-up form (/auth/register). Use this script
-- only for QA accounts when the mailer is rate-limited or confirmation
-- emails are unavailable.
--
-- HOW TO USE
-- ----------
-- 1. Edit the three values in the `settings` block below.
-- 2. Run it in the Supabase SQL editor, or with psql:
--      psql "$DATABASE_URL" -f supabase/qa/create_test_user.sql
-- 3. Sign in at /auth/login with those credentials.
--
-- The account is created unverified and unconfirmed: it has a profile and
-- preferences row (via the new-user trigger), but it is NOT NUB Verified and
-- it can never grant itself that status.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- settings -- edit these
-- ---------------------------------------------------------------------------
-- NOTE: GoTrue rejects @example.com addresses at sign-up. Use a real domain
-- you control, or an address your campus can receive mail at.
-- ---------------------------------------------------------------------------
-- email:    qa.student@nub.edu.bd
-- password: QaStudent123!
-- username: qa.student

DO $$
DECLARE
  v_email    TEXT := 'qa.student@nub.edu.bd';
  v_password TEXT := 'QaStudent123!';
  v_username TEXT := 'qa.student';
  v_user_id  UUID := gen_random_uuid();
  v_uni      UUID;
BEGIN
  -- Refuse to run twice for the same address.
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'A user with email % already exists.', v_email;
  END IF;

  SELECT id INTO v_uni FROM public.universities WHERE slug = 'nub' LIMIT 1;

  -- The user row itself. Every column GoTrue scans into a plain string is
  -- written explicitly, exactly as GoTrue's own signup does.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_current,
    email_change_token_new, email_change, phone_change_token, phone_change,
    reauthentication_token, email_change_confirm_status, is_super_admin,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
    '', '', '', '', '', '', '', '', 0, false,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', 'QA Student', 'username', v_username),
    now(), now()
  );

  -- The matching identity row. `auth.identities.email` is generated from
  -- identity_data, so the email must live inside identity_data.
  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id::text, v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'provider', 'email'
    ),
    'email', now(), now(), now()
  );

  -- The public.profile + public.user_preferences rows are created by the
  -- on_auth_user_created trigger; this only fills in the username when the
  -- trigger could not derive one.
  UPDATE public.profiles
     SET username = COALESCE(NULLIF(username, ''), v_username)
   WHERE id = v_user_id;

  RAISE NOTICE 'Created QA account % (id %) for %', v_username, v_user_id, v_email;
END
$$;
