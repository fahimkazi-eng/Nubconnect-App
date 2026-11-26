-- ============================================================================
-- NUBCONNECT — Pages, page-authored content and launch provenance
-- Migration: 011_pages_and_provenance.sql
--
-- WHY THIS EXISTS
-- ---------------
-- The platform needs an identity that is not a student account: the official
-- "NUB Connect" Page, and later club and department Pages. A Page publishes
-- on its own behalf, so an announcement never appears to come from a random
-- student's profile.
--
-- Launch content also has to be attributable and removable later without
-- touching genuine student contributions. Every launch post therefore records
-- where it came from, who reviewed it, what rights the image carries, which
-- seed batch it belongs to and whether it may be archived.
--
-- Additive only: no row is deleted or rewritten.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Pages
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id       UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  slug                TEXT NOT NULL,
  name                TEXT NOT NULL,
  -- platform  → the official NUB Connect Page
  -- club      → an approved club's Page (linked through organization_id)
  -- department→ a department's Page
  -- community → a student-led community Page
  kind                TEXT NOT NULL DEFAULT 'community',
  organization_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  description         TEXT,
  avatar_url          TEXT,
  cover_url           TEXT,
  verification_status verification_status_enum NOT NULL DEFAULT 'awaiting_verification',
  owner_id            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pages_university_slug_key UNIQUE (university_id, slug),
  CONSTRAINT pages_kind_check CHECK (kind IN ('platform', 'club', 'department', 'community'))
);

CREATE TABLE IF NOT EXISTS public.page_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id    UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page_role  TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT page_members_page_user_key UNIQUE (page_id, user_id),
  CONSTRAINT page_members_role_check CHECK (page_role IN ('owner', 'admin', 'editor', 'moderator'))
);

CREATE INDEX IF NOT EXISTS pages_organization_idx ON public.pages(organization_id);
CREATE INDEX IF NOT EXISTS page_members_user_idx ON public.page_members(user_id);

-- ----------------------------------------------------------------------------
-- 2. Who may manage a Page
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_page(target_page UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  page_row  public.pages%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO page_row FROM public.pages WHERE id = target_page;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF page_row.owner_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.page_members pm
     WHERE pm.page_id = target_page
       AND pm.user_id = auth.uid()
       AND pm.page_role IN ('owner', 'admin', 'editor')
  ) THEN
    RETURN TRUE;
  END IF;

  -- Platform administrators govern every Page.
  RETURN EXISTS (
    SELECT 1
      FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role IN ('university_admin', 'platform_super_admin')
  );
END
$$;

REVOKE ALL ON FUNCTION public.can_manage_page(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_page(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Launch provenance on posts
--    Every launch post keeps its source, its rights and its review trail, so
--    the owner can find and retire it later without touching student posts.
-- ----------------------------------------------------------------------------
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_seed_content BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS seed_batch TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS source_organization TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS original_published_at TIMESTAMPTZ;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_source TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_rights TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS internal_reviewer TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS removal_eligible BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_publication_status_check'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_publication_status_check
      CHECK (publication_status IN ('draft', 'scheduled', 'published', 'archived'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS posts_page_idx ON public.posts(page_id);
CREATE INDEX IF NOT EXISTS posts_seed_batch_idx ON public.posts(seed_batch) WHERE is_seed_content;

-- ----------------------------------------------------------------------------
-- 4. Page RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active pages are publicly readable" ON public.pages;
CREATE POLICY "Active pages are publicly readable"
  ON public.pages
  FOR SELECT
  USING (is_active);

DROP POLICY IF EXISTS "Page managers can create pages" ON public.pages;
CREATE POLICY "Page managers can create pages"
  ON public.pages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('university_admin', 'platform_super_admin')
    )
  );

DROP POLICY IF EXISTS "Page managers can update their pages" ON public.pages;
CREATE POLICY "Page managers can update their pages"
  ON public.pages
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_page(id))
  WITH CHECK (public.can_manage_page(id));

DROP POLICY IF EXISTS "Page managers can retire their pages" ON public.pages;
CREATE POLICY "Page managers can retire their pages"
  ON public.pages
  FOR DELETE
  TO authenticated
  USING (public.can_manage_page(id));

DROP POLICY IF EXISTS "Page membership is readable" ON public.page_members;
CREATE POLICY "Page membership is readable"
  ON public.page_members
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Page managers can manage membership" ON public.page_members;
CREATE POLICY "Page managers can manage membership"
  ON public.page_members
  FOR ALL
  TO authenticated
  USING (public.can_manage_page(page_id))
  WITH CHECK (public.can_manage_page(page_id));

-- ----------------------------------------------------------------------------
-- 5. Posts: a Page may publish on its own behalf
--    A student post is still pinned to `student_created` and to its author.
--    A Page post must name a Page the author actually manages.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can publish their own posts" ON public.posts;
CREATE POLICY "Students can publish their own posts"
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND university_id IN (
      SELECT uu.university_id
        FROM public.user_universities uu
       WHERE uu.user_id = auth.uid()
    )
    AND (
      -- A student post: no Page, student origin only.
      (
        page_id IS NULL
        AND content_origin = 'student_created'
      )
      OR
      -- A Page post: the author must manage the Page, and the origin must
      -- match what that Page is allowed to publish.
      (
        page_id IS NOT NULL
        AND public.can_manage_page(page_id)
        AND content_origin IN ('official_university', 'department_published', 'verified_club', 'recognized_organization')
      )
    )
    AND (department_id IS NULL OR department_id = (
      SELECT p.department_id FROM public.profiles p WHERE p.id = auth.uid()
    ))
    AND (organization_id IS NULL OR EXISTS (
      SELECT 1
        FROM public.organization_members om
       WHERE om.user_id = auth.uid()
         AND om.organization_id = posts.organization_id
         AND om.membership_status = 'approved'
    ))
    AND body <> ''
  );

DROP POLICY IF EXISTS "Authors can update their own posts" ON public.posts;
CREATE POLICY "Authors can update their own posts"
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR (page_id IS NOT NULL AND public.can_manage_page(page_id))
  )
  WITH CHECK (
    author_id = auth.uid()
    AND (
      (page_id IS NULL AND content_origin = 'student_created')
      OR
      (page_id IS NOT NULL
       AND public.can_manage_page(page_id)
       AND content_origin IN ('official_university', 'department_published', 'verified_club', 'recognized_organization'))
    )
  );

-- ----------------------------------------------------------------------------
-- 6. The Page follower list
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.page_follows (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id    UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT page_follows_page_user_key UNIQUE (page_id, user_id)
);

ALTER TABLE public.page_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Page follows are readable" ON public.page_follows;
CREATE POLICY "Page follows are readable"
  ON public.page_follows
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Students manage their own page follows" ON public.page_follows;
CREATE POLICY "Students manage their own page follows"
  ON public.page_follows
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. The official platform Page
--    The platform itself needs an identity that survives every student's
--    account. It is created here so the launch content always has a real
--    publisher, even on a brand-new database.
-- ----------------------------------------------------------------------------
INSERT INTO public.pages (university_id, slug, name, kind, description, verification_status, is_active)
SELECT u.id,
       'nub-connect',
       'NUB Connect',
       'platform',
       'The official NUB Connect page — campus announcements, verified university information and platform news.',
       'officially_verified',
       TRUE
  FROM public.universities u
 WHERE u.slug = 'nub'
ON CONFLICT (university_id, slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      verification_status = EXCLUDED.verification_status,
      is_active = EXCLUDED.is_active,
      updated_at = now();

-- The platform Page posts as itself: a dedicated, non-personal identity.
-- It is an account that cannot be signed into — its password is random and
-- never published — so no student can impersonate the platform.
DO $$
DECLARE
  v_uni   UUID;
  v_page  UUID;
  v_user  UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_uni FROM public.universities WHERE slug = 'nub' LIMIT 1;
  SELECT id INTO v_page FROM public.pages WHERE university_id = v_uni AND slug = 'nub-connect' LIMIT 1;

  IF v_page IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_user FROM auth.users WHERE email = 'nub-connect-official@platform.invalid' LIMIT 1;

  IF v_user IS NULL THEN
    v_user := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_current, email_change_token_new,
      email_change, phone_change_token, phone_change, reauthentication_token,
      email_change_confirm_status, is_super_admin, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
      'nub-connect-official@platform.invalid',
      extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
      '', '', '', '', '', '', '', '', 0, false,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"NUB Connect","username":"nub-connect-official"}'::jsonb,
      now(), now()
    );
  END IF;

  -- The new-user trigger creates the matching profile and preferences row.
  UPDATE public.pages
     SET owner_id = (SELECT id FROM public.profiles WHERE username = 'nub-connect-official' LIMIT 1),
         updated_at = now()
   WHERE id = v_page;
END
$$;
