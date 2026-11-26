-- ============================================================================
-- NUBCONNECT — Individual student accounts (Phase 2)
-- Migration: 006_student_accounts.sql
--
-- Additive only. Fixes the profiles table, which had RLS ENABLED in 002 but
-- no policies at all (deny-all), and wires the account-owned tables that the
-- auth experience needs:
--   • profiles        — read/write own row, privacy-aware reads, privilege guard
--   • user_preferences — owner-only read/write (privacy settings)
--   • student_verifications — students may request review (never self-approve)
--   • storage buckets  — avatars + covers, public read, owner-only writes
--   • new-user trigger — creates profile + preferences + tenant membership
--
-- Account ≠ NUB Verified: signing up creates a profile with
-- is_verified_student = FALSE. Verification is a separate, authorized review.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Profile additions
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- ----------------------------------------------------------------------------
-- 2. Privacy-aware profile reads
-- A SECURITY DEFINER helper keeps the policy from recursively querying
-- profiles under RLS. It is read-only and exposes no data itself.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_profile(target_profile UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  target_uni        UUID;
  target_suspended  BOOLEAN;
  target_visibility TEXT;
  viewer_uni        UUID;
  viewer_verified   BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF auth.uid() = target_profile THEN
    RETURN TRUE;
  END IF;

  SELECT p.primary_university_id, p.is_suspended
    INTO target_uni, target_suspended
    FROM public.profiles p
   WHERE p.id = target_profile;

  IF target_uni IS NULL AND target_suspended IS NULL THEN
    RETURN FALSE; -- no such profile
  END IF;

  IF COALESCE(target_suspended, FALSE) THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(up.profile_visibility, 'university_only')
    INTO target_visibility
    FROM public.user_preferences up
   WHERE up.user_id = target_profile;

  target_visibility := COALESCE(target_visibility, 'university_only');

  IF target_visibility = 'public' THEN
    RETURN TRUE;
  END IF;

  SELECT p.primary_university_id, p.is_verified_student
    INTO viewer_uni, viewer_verified
    FROM public.profiles p
   WHERE p.id = auth.uid();

  IF target_visibility = 'verified_only' THEN
    RETURN COALESCE(viewer_verified, FALSE);
  END IF;

  -- university_only (default)
  RETURN viewer_uni IS NOT NULL AND viewer_uni = target_uni;
END;
$$;

DROP POLICY IF EXISTS "Profiles are readable per privacy settings" ON profiles;
CREATE POLICY "Profiles are readable per privacy settings"
  ON profiles FOR SELECT
  USING (public.can_view_profile(id));

DROP POLICY IF EXISTS "Students can create their own profile" ON profiles;
CREATE POLICY "Students can create their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Students can update their own profile" ON profiles;
CREATE POLICY "Students can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 3. Privilege guard: a student may edit their own profile, but never grant
-- themselves NUB Verified status or lift a suspension. Only another
-- authorized actor (admin via the service role or an admin session updating
-- someone else's row) can change those columns.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id THEN
    IF NEW.is_verified_student IS DISTINCT FROM OLD.is_verified_student THEN
      RAISE EXCEPTION 'NUB Verified status is granted only through an authorized review';
    END IF;
    IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended THEN
      RAISE EXCEPTION 'Suspension status can only be changed by university administrators';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- ----------------------------------------------------------------------------
-- 4. Privacy preferences — owner-only, always
-- ----------------------------------------------------------------------------
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own preferences" ON user_preferences;
CREATE POLICY "Users can read their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own preferences" ON user_preferences;
CREATE POLICY "Users can create their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. NUB Verified requests — students may submit, only admins may decide.
-- (002 already restricts SELECT to owner/admins and UPDATE to admins.)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can request their own verification" ON student_verifications;
CREATE POLICY "Students can request their own verification"
  ON student_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- ----------------------------------------------------------------------------
-- 6. Storage — avatars & covers
-- Public read (profile images are public); writes confined to the owner's
-- folder (<uid>/filename), enforced by the first path segment.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('covers',  'covers',  TRUE, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Avatar and cover images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar and cover images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars', 'covers'));

DROP POLICY IF EXISTS "Users can upload their own avatar or cover" ON storage.objects;
CREATE POLICY "Users can upload their own avatar or cover"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can replace their own avatar or cover" ON storage.objects;
CREATE POLICY "Users can replace their own avatar or cover"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id IN ('avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own avatar or cover" ON storage.objects;
CREATE POLICY "Users can delete their own avatar or cover"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- 7. New auth user → profile, preferences, tenant membership, base role.
-- Runs as SECURITY DEFINER because auth.users is outside the public schema.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username     TEXT;
  final_username    TEXT;
  nub_uni           UUID;
  chosen_department UUID;
BEGIN
  base_username := lower(
    regexp_replace(
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'username', ''),
        split_part(COALESCE(NEW.email, 'student'), '@', 1)
      ),
      '[^a-zA-Z0-9._-]', '', 'g'
    )
  );

  IF base_username IS NULL OR length(base_username) < 3 THEN
    base_username := 'student';
  END IF;

  final_username := left(base_username, 30);

  SELECT id INTO nub_uni FROM public.universities WHERE slug = 'nub' LIMIT 1;

  BEGIN
    chosen_department := NULLIF(NEW.raw_user_meta_data->>'department_id', '')::uuid;
  EXCEPTION WHEN others THEN
    chosen_department := NULL;
  END;

  BEGIN
    INSERT INTO public.profiles (id, username, display_name, primary_university_id, department_id)
    VALUES (
      NEW.id,
      final_username,
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        split_part(COALESCE(NEW.email, 'Student'), '@', 1)
      ),
      nub_uni,
      chosen_department
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    -- The chosen username was already taken; keep it recognisable and add a
    -- short suffix derived from the auth UUID.
    final_username := left(base_username, 20) || '-' || left(replace(NEW.id::text, '-', ''), 8);
    INSERT INTO public.profiles (id, username, display_name, primary_university_id, department_id)
    VALUES (
      NEW.id,
      final_username,
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        split_part(COALESCE(NEW.email, 'Student'), '@', 1)
      ),
      nub_uni,
      chosen_department
    )
    ON CONFLICT (id) DO NOTHING;
  END;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  IF nub_uni IS NOT NULL THEN
    INSERT INTO public.user_universities (user_id, university_id, membership_type, is_primary)
    VALUES (NEW.id, nub_uni, 'student', TRUE)
    ON CONFLICT (user_id, university_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, university_id, role)
    VALUES (NEW.id, nub_uni, 'registered_user')
    ON CONFLICT (user_id, university_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
