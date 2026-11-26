-- ============================================================================
-- NUBCONNECT — Real clubs, membership cards & Campus Honours (Phase 4)
-- Migration: 008_clubs_recognition.sql
--
-- Additive only. 002 enabled RLS on organization_members but never added a
-- single policy, so the table was deny-all. This migration gives clubs a real,
-- audited lifecycle without letting a club grant itself university-level
-- verification:
--   • organization_members  — applications, approval, roles, alumni, cards
--   • organization_*        — representatives, committees, aliases,
--                             verification requests and an activity log
--   • campus_honours        — club-verified recognition, opt-out enforced at
--                             the data layer, no self-award
--   • SECURITY DEFINER RPCs — safe reads/writes for students, club managers
--                             and the public card-verification page
--
-- No existing rows are deleted. Verification status remains university-only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Additive membership / recognition fields
-- ----------------------------------------------------------------------------
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS membership_role TEXT NOT NULL DEFAULT 'Member';
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS review_note TEXT;

ALTER TABLE campus_honours
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE campus_honours
  ADD COLUMN IF NOT EXISTS awarded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_members_org_status
  ON organization_members(organization_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_org_members_user_status
  ON organization_members(user_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_campus_honours_org
  ON campus_honours(organization_id, created_at DESC);

-- Old memberships created before 004 may still miss a card token. Keep the
-- existing rows; only fill the missing token.
UPDATE organization_members
   SET membership_verify_token = encode(gen_random_bytes(24), 'hex')
 WHERE membership_verify_token IS NULL;

-- One pending university-review request per club at a time. If a deployment
-- already has duplicates we keep them and let the application layer explain
-- the pending state instead of deleting anybody's request.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_org_verification_pending
    ON organization_verification_requests(organization_id)
    WHERE status = 'pending';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Skipped one-pending-verification index: duplicate pending requests already exist';
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Club activity log (Control Center audit trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_activity_org_created
  ON organization_activity_log(organization_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Helpers — membership, management and tenant resolution
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_club_member(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM organization_members
     WHERE organization_id = target_org
       AND user_id = auth.uid()
       AND membership_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.club_university(target_org UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT university_id FROM organizations WHERE id = target_org;
$$;

/** Club representative OR university admin. Used by RLS and RPCs. */
CREATE OR REPLACE FUNCTION public.is_club_manager(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_club_rep(target_org)
      OR EXISTS (
        SELECT 1
          FROM organizations o
         WHERE o.id = target_org
           AND public.user_has_role(
                 o.university_id,
                 ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
               )
      );
$$;

/** True when the caller belongs to the same university as the club. */
CREATE OR REPLACE FUNCTION public.shares_club_university(target_org UUID, target_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM organizations o
     WHERE o.id = target_org
       AND (
         EXISTS (
           SELECT 1 FROM user_universities uu
            WHERE uu.user_id = target_user
              AND uu.university_id = o.university_id
         )
         OR EXISTS (
           SELECT 1 FROM profiles p
            WHERE p.id = target_user
              AND p.primary_university_id = o.university_id
         )
       )
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. RLS — club tables
-- ----------------------------------------------------------------------------
ALTER TABLE organization_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_activity_log ENABLE ROW LEVEL SECURITY;

-- organization_members: own membership, or a manager. Approved members do not
-- get direct row access to classmates' motivation notes or card tokens; the
-- public club roster is served by get_club_detail() with only safe fields.
DROP POLICY IF EXISTS "Members can read their own membership or approved club roster" ON organization_members;
DROP POLICY IF EXISTS "Members can read their own membership; managers the roster" ON organization_members;
CREATE POLICY "Members can read their own membership; managers the roster"
  ON organization_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_club_manager(organization_id)
  );

DROP POLICY IF EXISTS "Students can apply to open clubs" ON organization_members;
CREATE POLICY "Students can apply to open clubs"
  ON organization_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND membership_status = 'pending'
    AND membership_role = 'Member'
    AND reviewed_by IS NULL
    AND EXISTS (
      SELECT 1 FROM organizations o
       WHERE o.id = organization_id
         AND COALESCE(o.membership_open, TRUE)
    )
    AND public.shares_club_university(organization_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = auth.uid()
         AND COALESCE(p.is_suspended, FALSE)
    )
  );

DROP POLICY IF EXISTS "Students can withdraw their own pending application" ON organization_members;
CREATE POLICY "Students can withdraw their own pending application"
  ON organization_members FOR DELETE
  USING (user_id = auth.uid() AND membership_status = 'pending');

-- Direct membership edits are university-admin only. Club managers use the
-- audited RPCs below, so every approve/hold/reject is written to the log.
DROP POLICY IF EXISTS "University admins can correct club memberships" ON organization_members;
CREATE POLICY "University admins can correct club memberships"
  ON organization_members FOR UPDATE
  USING (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  )
  WITH CHECK (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  );

-- Representatives: public leadership roster; only the university assigns them.
DROP POLICY IF EXISTS "Representatives are public" ON organization_representatives;
CREATE POLICY "Representatives are public"
  ON organization_representatives FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Club managers can add representatives" ON organization_representatives;
DROP POLICY IF EXISTS "University admins can add representatives" ON organization_representatives;
CREATE POLICY "University admins can add representatives"
  ON organization_representatives FOR INSERT
  WITH CHECK (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
    AND public.shares_club_university(organization_id, user_id)
  );

DROP POLICY IF EXISTS "Club managers can update representatives" ON organization_representatives;
DROP POLICY IF EXISTS "University admins can update representatives" ON organization_representatives;
CREATE POLICY "University admins can update representatives"
  ON organization_representatives FOR UPDATE
  USING (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  )
  WITH CHECK (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
    AND public.shares_club_university(organization_id, user_id)
  );

DROP POLICY IF EXISTS "Club managers can remove representatives" ON organization_representatives;
DROP POLICY IF EXISTS "University admins can remove representatives" ON organization_representatives;
CREATE POLICY "University admins can remove representatives"
  ON organization_representatives FOR DELETE
  USING (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  );

-- Committees: public roster; managers maintain it.
DROP POLICY IF EXISTS "Committees are public" ON organization_committees;
CREATE POLICY "Committees are public"
  ON organization_committees FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Club managers can maintain committees" ON organization_committees;
CREATE POLICY "Club managers can maintain committees"
  ON organization_committees FOR ALL
  USING (public.is_club_manager(organization_id))
  WITH CHECK (public.is_club_manager(organization_id));

-- Aliases: public reconciliation history; managers maintain it.
DROP POLICY IF EXISTS "Aliases are public" ON organization_aliases;
CREATE POLICY "Aliases are public"
  ON organization_aliases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Club managers can maintain aliases" ON organization_aliases;
CREATE POLICY "Club managers can maintain aliases"
  ON organization_aliases FOR ALL
  USING (public.is_club_manager(organization_id))
  WITH CHECK (public.is_club_manager(organization_id));

-- Verification requests: submitters/managers can read; only university
-- admins can change the review status. Clubs can never self-approve.
DROP POLICY IF EXISTS "Managers can read their club verification requests" ON organization_verification_requests;
CREATE POLICY "Managers can read their club verification requests"
  ON organization_verification_requests FOR SELECT
  USING (
    submitted_by = auth.uid()
    OR public.is_club_manager(organization_id)
    OR public.user_has_role(
         public.club_university(organization_id),
         ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
       )
  );

DROP POLICY IF EXISTS "Club managers can request verification" ON organization_verification_requests;
CREATE POLICY "Club managers can request verification"
  ON organization_verification_requests FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND public.is_club_manager(organization_id)
  );

DROP POLICY IF EXISTS "University admins review club verification" ON organization_verification_requests;
CREATE POLICY "University admins review club verification"
  ON organization_verification_requests FOR UPDATE
  USING (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  )
  WITH CHECK (
    public.user_has_role(
      public.club_university(organization_id),
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  );

-- Audit trail is readable by club managers. Writes happen through RPCs only.
DROP POLICY IF EXISTS "Club managers can read the activity log" ON organization_activity_log;
CREATE POLICY "Club managers can read the activity log"
  ON organization_activity_log FOR SELECT
  USING (public.is_club_manager(organization_id));

-- ----------------------------------------------------------------------------
-- 5. RLS — Campus Honours (replace 004's opt-out policy)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Honours are visible unless the student opted out" ON campus_honours;
CREATE POLICY "Honours are visible unless the student opted out"
  ON campus_honours FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_universities uu
       WHERE uu.user_id = auth.uid()
         AND uu.university_id = campus_honours.university_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_preferences up
       WHERE up.user_id = campus_honours.person_id
         AND up.show_in_honours = FALSE
    )
  );

DROP POLICY IF EXISTS "Club managers can award recognition to members" ON campus_honours;
CREATE POLICY "Club managers can award recognition to members"
  ON campus_honours FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND person_id <> auth.uid()
    AND awarded_by = auth.uid()
    AND points > 0
    AND (
      (
        verified_by = 'club'
        AND organization_id IS NOT NULL
        AND public.is_club_manager(organization_id)
        AND EXISTS (
          SELECT 1 FROM organization_members m
           WHERE m.organization_id = campus_honours.organization_id
             AND m.user_id = campus_honours.person_id
             AND m.membership_status = 'approved'
        )
      )
      OR (
        verified_by IN ('department', 'university')
        AND public.user_has_role(
              university_id,
              ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
            )
      )
    )
  );

DROP POLICY IF EXISTS "University admins can correct honours" ON campus_honours;
CREATE POLICY "University admins can correct honours"
  ON campus_honours FOR UPDATE
  USING (
    public.user_has_role(
      university_id,
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  )
  WITH CHECK (
    public.user_has_role(
      university_id,
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  );

DROP POLICY IF EXISTS "University admins can remove honours" ON campus_honours;
CREATE POLICY "University admins can remove honours"
  ON campus_honours FOR DELETE
  USING (
    public.user_has_role(
      university_id,
      ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
    )
  );

DROP POLICY IF EXISTS "Club managers can withdraw their own club recognition" ON campus_honours;
CREATE POLICY "Club managers can withdraw their own club recognition"
  ON campus_honours FOR DELETE
  USING (
    verified_by = 'club'
    AND organization_id IS NOT NULL
    AND public.is_club_manager(organization_id)
  );

-- ----------------------------------------------------------------------------
-- 6. Triggers — identity fields and university-only verification
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_club_membership_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A membership cannot be moved to another club or student';
  END IF;
  IF NEW.membership_status NOT IN ('pending', 'approved', 'rejected', 'alumni') THEN
    RAISE EXCEPTION 'Invalid membership status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_club_membership_identity_trg ON organization_members;
CREATE TRIGGER protect_club_membership_identity_trg
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_club_membership_identity();

CREATE OR REPLACE FUNCTION public.protect_club_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role / migration work has no auth.uid(); normal clients cannot
  -- update these rows without passing RLS first.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.user_has_role(
           OLD.university_id,
           ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
         ) THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      RAISE EXCEPTION 'Only the university can change a club verification level';
    END IF;
    IF NEW.university_id IS DISTINCT FROM OLD.university_id THEN
      RAISE EXCEPTION 'Only the university can move a club between tenants';
    END IF;
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'Only the university can change a club slug';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_club_identity_trg ON organizations;
CREATE TRIGGER protect_club_identity_trg
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.protect_club_identity();

CREATE OR REPLACE FUNCTION public.protect_club_committee_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uni UUID;
  v_was_verified BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'A committee record cannot be moved to another club';
    END IF;
    v_was_verified := COALESCE(OLD.is_verified_source, FALSE);
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT university_id INTO v_uni FROM organizations WHERE id = NEW.organization_id;

  IF NEW.is_verified_source = TRUE
     AND NOT v_was_verified
     AND NOT public.user_has_role(
               v_uni,
               ARRAY['university_admin', 'platform_super_admin']::app_role_enum[]
             ) THEN
    RAISE EXCEPTION 'Only the university can mark a committee record as a verified source';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_club_committee_source_trg ON organization_committees;
CREATE TRIGGER protect_club_committee_source_trg
  BEFORE INSERT OR UPDATE ON organization_committees
  FOR EACH ROW EXECUTE FUNCTION public.protect_club_committee_source();

CREATE OR REPLACE FUNCTION public.protect_club_representative_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A representative record cannot be moved to another club or student';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_club_representative_identity_trg ON organization_representatives;
CREATE TRIGGER protect_club_representative_identity_trg
  BEFORE UPDATE ON organization_representatives
  FOR EACH ROW EXECUTE FUNCTION public.protect_club_representative_identity();

-- ----------------------------------------------------------------------------
-- 7. Read RPCs
-- ----------------------------------------------------------------------------

/** Public club directory with approved member counts and caller manager flag. */
CREATE OR REPLACE FUNCTION public.get_clubs_directory()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'slug', o.slug,
        'name', o.name,
        'short_description', o.short_description,
        'about', o.about,
        'category', o.category,
        'scope_type', o.scope_type,
        'verification_status', o.verification_status,
        'membership_open', COALESCE(o.membership_open, TRUE),
        'membership_requirements', o.membership_requirements,
        'logo_url', o.logo_url,
        'cover_url', o.cover_url,
        'source_url', o.source_url,
        'official_website', o.official_website,
        'member_count', (
          SELECT count(*)::int
            FROM organization_members m
           WHERE m.organization_id = o.id
             AND m.membership_status = 'approved'
        ),
        'is_manager', public.is_club_manager(o.id)
      )
      ORDER BY o.name
    )
    FROM organizations o
    WHERE auth.uid() IS NOT NULL
      AND (
        o.university_id IN (
          SELECT uu.university_id
            FROM user_universities uu
           WHERE uu.user_id = auth.uid()
        )
        OR o.university_id = (
          SELECT p.primary_university_id
            FROM profiles p
           WHERE p.id = auth.uid()
        )
      )
  ), '[]'::jsonb);
END;
$$;

/** Public club identity, leadership, committee, aliases and caller state. */
CREATE OR REPLACE FUNCTION public.get_club_detail(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO v_org
    FROM organizations
   WHERE slug = p_slug
     AND v_uid IS NOT NULL
     AND (
       university_id IN (
         SELECT uu.university_id
           FROM user_universities uu
          WHERE uu.user_id = v_uid
       )
       OR university_id = (
         SELECT p.primary_university_id
           FROM profiles p
          WHERE p.id = v_uid
       )
     )
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'club', jsonb_build_object(
      'id', v_org.id,
      'slug', v_org.slug,
      'name', v_org.name,
      'short_description', v_org.short_description,
      'about', v_org.about,
      'category', v_org.category,
      'scope_type', v_org.scope_type,
      'verification_status', v_org.verification_status,
      'membership_open', COALESCE(v_org.membership_open, TRUE),
      'membership_requirements', v_org.membership_requirements,
      'logo_url', v_org.logo_url,
      'cover_url', v_org.cover_url,
      'source_url', v_org.source_url,
      'official_website', v_org.official_website
    ),
    'member_count', (
      SELECT count(*)::int
        FROM organization_members m
       WHERE m.organization_id = v_org.id
         AND m.membership_status = 'approved'
    ),
    'representatives', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', r.user_id,
          'name', p.display_name,
          'username', p.username,
          'avatar_url', p.avatar_url,
          'designation', r.designation
        )
        ORDER BY r.designation
      )
      FROM organization_representatives r
      JOIN profiles p ON p.id = r.user_id
      WHERE r.organization_id = v_org.id
    ), '[]'::jsonb),
    'committee', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'role_title', c.role_title,
          'member_name', c.member_name,
          'session_term', c.session_term,
          'is_verified_source', c.is_verified_source,
          'source_url', c.source_url
        )
        ORDER BY c.role_title
      )
      FROM organization_committees c
      WHERE c.organization_id = v_org.id
    ), '[]'::jsonb),
    'aliases', COALESCE((
      SELECT jsonb_agg(a.alias_name ORDER BY a.alias_name)
      FROM organization_aliases a
      WHERE a.organization_id = v_org.id
    ), '[]'::jsonb),
    'my_membership', (
      SELECT jsonb_build_object(
        'status', m.membership_status,
        'role', m.membership_role
      )
      FROM organization_members m
      WHERE m.organization_id = v_org.id
        AND m.user_id = v_uid
      LIMIT 1
    ),
    'is_manager', public.is_club_manager(v_org.id),
    'honours', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', h.id,
          'person_id', h.person_id,
          'person_name', p.display_name,
          'department_code', COALESCE(d.code, 'NUB'),
          'category', h.category,
          'title', h.title,
          'detail', h.detail,
          'points', h.points,
          'semester', h.semester,
          'created_at', h.created_at
        ) AS x
        FROM campus_honours h
        JOIN profiles p ON p.id = h.person_id
        LEFT JOIN departments d ON d.id = p.department_id
        WHERE h.organization_id = v_org.id
          AND NOT EXISTS (
            SELECT 1 FROM user_preferences up
             WHERE up.user_id = h.person_id
               AND up.show_in_honours = FALSE
          )
        ORDER BY h.created_at DESC
        LIMIT 10
      ) recent
    ), '[]'::jsonb)
  );
END;
$$;

/** The signed-in student's memberships + clubs they can manage. */
CREATE OR REPLACE FUNCTION public.get_my_club_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('memberships', '[]'::jsonb, 'managed', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'memberships', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'organization_id', m.organization_id,
          'slug', o.slug,
          'name', o.name,
          'status', m.membership_status,
          'role', m.membership_role,
          'joined_at', m.joined_at,
          'verify_token', m.membership_verify_token,
          'category', o.category,
          'verification_status', o.verification_status
        )
        ORDER BY o.name
      )
      FROM organization_members m
      JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = v_uid
    ), '[]'::jsonb),
    'managed', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'organization_id', r.organization_id,
          'slug', o.slug,
          'name', o.name,
          'designation', r.designation
        )
        ORDER BY o.name
      )
      FROM organization_representatives r
      JOIN organizations o ON o.id = r.organization_id
      WHERE r.user_id = v_uid
    ), '[]'::jsonb)
  );
END;
$$;

/** Recognition feed — university-scoped and opt-out aware. */
CREATE OR REPLACE FUNCTION public.get_honours_feed(p_semester TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'person_id', h.person_id,
        'person_name', p.display_name,
        'department_code', COALESCE(d.code, 'NUB'),
        'category', h.category,
        'title', h.title,
        'detail', h.detail,
        'points', h.points,
        'semester', h.semester,
        'verified_by', h.verified_by,
        'organization_name', o.name,
        'created_at', h.created_at
      )
      ORDER BY h.created_at DESC
    )
    FROM campus_honours h
    JOIN profiles p ON p.id = h.person_id
    LEFT JOIN departments d ON d.id = p.department_id
    LEFT JOIN organizations o ON o.id = h.organization_id
    WHERE (p_semester IS NULL OR h.semester = p_semester)
      AND (
        h.university_id IN (
          SELECT uu.university_id
            FROM user_universities uu
           WHERE uu.user_id = auth.uid()
        )
        OR h.university_id = (
          SELECT p.primary_university_id
            FROM profiles p
           WHERE p.id = auth.uid()
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_preferences up
         WHERE up.user_id = h.person_id
           AND up.show_in_honours = FALSE
      )
  ), '[]'::jsonb);
END;
$$;

/** Public read-only membership card lookup. Safe fields only. */
CREATE OR REPLACE FUNCTION public.get_membership_card(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'club_slug', o.slug,
      'club_name', o.name,
      'person_name', p.display_name,
      'person_department',
        COALESCE(d.code, 'NUB') ||
        CASE WHEN p.semester_label IS NOT NULL AND length(btrim(p.semester_label)) > 0
             THEN ' • ' || p.semester_label ELSE '' END,
      'role', COALESCE(NULLIF(btrim(m.membership_role), ''), 'Member'),
      'since', to_char(COALESCE(m.joined_at, m.reviewed_at, NOW()), 'Mon YYYY'),
      'status', m.membership_status
    )
    FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id
    JOIN profiles p ON p.id = m.user_id
    LEFT JOIN departments d ON d.id = p.department_id
    WHERE m.membership_verify_token = p_token
      AND m.membership_status = 'approved'
    LIMIT 1
  );
END;
$$;

/** Full Control Center payload. Managers only. */
CREATE OR REPLACE FUNCTION public.get_club_manage_data(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;
  IF NOT public.is_club_manager(p_org_id) THEN
    RAISE EXCEPTION 'Only club representatives can open the Control Center';
  END IF;

  RETURN jsonb_build_object(
    'club', jsonb_build_object(
      'id', v_org.id,
      'slug', v_org.slug,
      'name', v_org.name,
      'short_description', v_org.short_description,
      'about', v_org.about,
      'category', v_org.category,
      'scope_type', v_org.scope_type,
      'verification_status', v_org.verification_status,
      'membership_open', COALESCE(v_org.membership_open, TRUE),
      'membership_requirements', v_org.membership_requirements,
      'logo_url', v_org.logo_url,
      'cover_url', v_org.cover_url,
      'source_url', v_org.source_url
    ),
    'member_count', (
      SELECT count(*)::int
        FROM organization_members m
       WHERE m.organization_id = p_org_id
         AND m.membership_status = 'approved'
    ),
    'applications', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'membership_id', m.id,
          'user_id', m.user_id,
          'name', p.display_name,
          'username', p.username,
          'department_code', COALESCE(d.code, 'NUB'),
          'semester', p.semester_label,
          'motivation', m.motivation_note,
          'applied_at', m.joined_at
        )
        ORDER BY m.joined_at
      )
      FROM organization_members m
      JOIN profiles p ON p.id = m.user_id
      LEFT JOIN departments d ON d.id = p.department_id
      WHERE m.organization_id = p_org_id
        AND m.membership_status = 'pending'
    ), '[]'::jsonb),
    'members', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'membership_id', m.id,
          'user_id', m.user_id,
          'name', p.display_name,
          'username', p.username,
          'department_code', COALESCE(d.code, 'NUB'),
          'semester', p.semester_label,
          'role', m.membership_role,
          'status', m.membership_status,
          'joined_at', m.joined_at
        )
        ORDER BY p.display_name
      )
      FROM organization_members m
      JOIN profiles p ON p.id = m.user_id
      LEFT JOIN departments d ON d.id = p.department_id
      WHERE m.organization_id = p_org_id
        AND m.membership_status = 'approved'
    ), '[]'::jsonb),
    'representatives', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', r.user_id,
          'name', p.display_name,
          'username', p.username,
          'avatar_url', p.avatar_url,
          'designation', r.designation
        )
        ORDER BY r.designation
      )
      FROM organization_representatives r
      JOIN profiles p ON p.id = r.user_id
      WHERE r.organization_id = p_org_id
    ), '[]'::jsonb),
    'committee', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'role_title', c.role_title,
          'member_name', c.member_name,
          'session_term', c.session_term,
          'is_verified_source', c.is_verified_source,
          'source_url', c.source_url
        )
        ORDER BY c.role_title
      )
      FROM organization_committees c
      WHERE c.organization_id = p_org_id
    ), '[]'::jsonb),
    'honours', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'person_id', h.person_id,
          'person_name', p.display_name,
          'department_code', COALESCE(d.code, 'NUB'),
          'category', h.category,
          'title', h.title,
          'detail', h.detail,
          'points', h.points,
          'semester', h.semester,
          'created_at', h.created_at
        )
        ORDER BY h.created_at DESC
      )
      FROM campus_honours h
      JOIN profiles p ON p.id = h.person_id
      LEFT JOIN departments d ON d.id = p.department_id
      WHERE h.organization_id = p_org_id
        AND NOT EXISTS (
          SELECT 1 FROM user_preferences up
           WHERE up.user_id = h.person_id
             AND up.show_in_honours = FALSE
        )
    ), '[]'::jsonb),
    'verification_requests', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'status', v.status,
          'notes', v.notes,
          'advisor_name', v.advisor_name,
          'evidence_urls', v.evidence_urls,
          'created_at', v.created_at,
          'reviewed_at', v.reviewed_at
        )
        ORDER BY v.created_at DESC
      )
      FROM organization_verification_requests v
      WHERE v.organization_id = p_org_id
    ), '[]'::jsonb),
    'audit', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'action', a.action,
          'detail', a.detail,
          'actor_name', p.display_name,
          'created_at', a.created_at
        )
        ORDER BY a.created_at DESC
      )
      FROM (
        SELECT * FROM organization_activity_log
         WHERE organization_id = p_org_id
         ORDER BY created_at DESC
         LIMIT 50
      ) a
      LEFT JOIN profiles p ON p.id = a.actor_id
    ), '[]'::jsonb)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Write RPCs — students
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_to_organization(p_org_id UUID, p_note TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_org organizations%ROWTYPE;
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to apply to a club';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;
  IF NOT COALESCE(v_org.membership_open, TRUE) THEN
    RAISE EXCEPTION 'This club is not accepting applications right now';
  END IF;
  IF NOT public.shares_club_university(p_org_id, v_uid) THEN
    RAISE EXCEPTION 'This club is for students of its own university';
  END IF;
  IF EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.id = v_uid AND COALESCE(p.is_suspended, FALSE)
  ) THEN
    RAISE EXCEPTION 'Your account is suspended';
  END IF;
  IF p_note IS NOT NULL AND length(btrim(p_note)) > 1000 THEN
    RAISE EXCEPTION 'Keep your application note to 1000 characters or fewer';
  END IF;
  IF (
    SELECT count(*)
      FROM organization_activity_log
     WHERE organization_id = p_org_id
       AND actor_id = v_uid
       AND action = 'application_submitted'
       AND created_at > NOW() - INTERVAL '1 day'
  ) >= 5 THEN
    RAISE EXCEPTION 'Too many applications in a short time. Please try again tomorrow.';
  END IF;

  SELECT membership_status INTO v_status
    FROM organization_members
   WHERE organization_id = p_org_id AND user_id = v_uid;

  IF v_status = 'approved' THEN
    RAISE EXCEPTION 'You are already a member of this club';
  END IF;
  IF v_status = 'pending' THEN
    RAISE EXCEPTION 'Your application is already pending';
  END IF;

  INSERT INTO organization_members (
    organization_id, user_id, membership_status, motivation_note,
    reviewed_by, reviewed_at, review_note
  )
  VALUES (
    p_org_id, v_uid, 'pending', NULLIF(btrim(p_note), ''),
    NULL, NULL, NULL
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET membership_status = 'pending',
        membership_role = 'Member',
        motivation_note = EXCLUDED.motivation_note,
        reviewed_by = NULL,
        reviewed_at = NULL,
        review_note = NULL,
        joined_at = NOW();

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (p_org_id, v_uid, 'application_submitted', 'Membership application submitted');

  RETURN 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_club_application(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deleted UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to withdraw an application';
  END IF;

  DELETE FROM organization_members
   WHERE organization_id = p_org_id
     AND user_id = v_uid
     AND membership_status = 'pending'
  RETURNING organization_id INTO v_deleted;

  IF v_deleted IS NULL THEN
    RAISE EXCEPTION 'No pending application to withdraw';
  END IF;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (p_org_id, v_uid, 'application_withdrawn', 'Membership application withdrawn');

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_organization(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to leave a club';
  END IF;

  SELECT membership_status INTO v_status
    FROM organization_members
   WHERE organization_id = p_org_id AND user_id = v_uid
   FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this club';
  END IF;

  IF v_status = 'pending' THEN
    DELETE FROM organization_members
     WHERE organization_id = p_org_id AND user_id = v_uid;
    INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
    VALUES (p_org_id, v_uid, 'application_withdrawn', 'Membership application withdrawn');
    RETURN 'withdrawn';
  END IF;

  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'You are not an active member of this club';
  END IF;

  UPDATE organization_members
     SET membership_status = 'alumni'
   WHERE organization_id = p_org_id AND user_id = v_uid;

  -- A student who leaves must not keep representative powers over the club.
  DELETE FROM organization_representatives
   WHERE organization_id = p_org_id
     AND user_id = v_uid;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (p_org_id, v_uid, 'membership_left', 'Member left the club');

  RETURN 'alumni';
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Write RPCs — club managers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_club_application(
  p_membership_id UUID,
  p_decision TEXT,
  p_role TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_org UUID;
  v_status TEXT;
  v_person UUID;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to review applications';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Invalid review decision';
  END IF;
  IF p_role IS NOT NULL AND length(btrim(p_role)) > 60 THEN
    RAISE EXCEPTION 'Keep the role to 60 characters or fewer';
  END IF;

  SELECT organization_id, membership_status, user_id
    INTO v_org, v_status, v_person
    FROM organization_members
   WHERE id = p_membership_id
   FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  IF NOT public.is_club_manager(v_org) THEN
    RAISE EXCEPTION 'Only club representatives can review applications';
  END IF;
  IF v_person = v_uid THEN
    RAISE EXCEPTION 'You cannot review your own application';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'This application is no longer pending';
  END IF;

  UPDATE organization_members
     SET membership_status = p_decision,
         reviewed_by = v_uid,
         reviewed_at = NOW(),
         review_note = NULLIF(btrim(p_note), ''),
         membership_role = CASE
           WHEN p_decision = 'approved'
             THEN COALESCE(NULLIF(btrim(p_role), ''), membership_role, 'Member')
           ELSE membership_role
         END
   WHERE id = p_membership_id;

  SELECT display_name INTO v_name FROM profiles WHERE id = v_person;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (
    v_org,
    v_uid,
    CASE p_decision
      WHEN 'approved' THEN 'membership_approved'
      WHEN 'rejected' THEN 'membership_rejected'
      ELSE 'application_held'
    END,
    COALESCE(v_name, 'A student')
  );

  RETURN p_decision;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_club_member_role(
  p_membership_id UUID,
  p_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_org UUID;
  v_status TEXT;
  v_person UUID;
  v_name TEXT;
  v_role TEXT := btrim(p_role);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to update a member role';
  END IF;
  IF v_role IS NULL OR length(v_role) = 0 OR length(v_role) > 60 THEN
    RAISE EXCEPTION 'Enter a role name of 60 characters or fewer';
  END IF;

  SELECT organization_id, membership_status, user_id
    INTO v_org, v_status, v_person
    FROM organization_members
   WHERE id = p_membership_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;
  IF NOT public.is_club_manager(v_org) THEN
    RAISE EXCEPTION 'Only club representatives can update member roles';
  END IF;
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved members can hold a club role';
  END IF;

  UPDATE organization_members
     SET membership_role = v_role
   WHERE id = p_membership_id;

  SELECT display_name INTO v_name FROM profiles WHERE id = v_person;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (v_org, v_uid, 'member_role_updated', COALESCE(v_name, 'A member') || ' → ' || v_role);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_club_honour(
  p_org_id UUID,
  p_person_id UUID,
  p_category TEXT,
  p_title TEXT,
  p_detail TEXT DEFAULT NULL,
  p_points INTEGER DEFAULT 10,
  p_semester TEXT DEFAULT 'Fall 2026'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_org organizations%ROWTYPE;
  v_name TEXT;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to award recognition';
  END IF;
  IF p_category NOT IN (
    'Mentoring', 'Organizing', 'Community Help',
    'Knowledge Sharing', 'Creative Contribution', 'Volunteering'
  ) THEN
    RAISE EXCEPTION 'Invalid recognition category';
  END IF;
  IF p_points IS NULL OR p_points < 1 OR p_points > 100 THEN
    RAISE EXCEPTION 'Points must be between 1 and 100';
  END IF;
  IF p_title IS NULL OR length(btrim(p_title)) < 3 THEN
    RAISE EXCEPTION 'Enter a recognition title';
  END IF;
  IF length(btrim(p_title)) > 120 THEN
    RAISE EXCEPTION 'Keep the title to 120 characters or fewer';
  END IF;
  IF p_detail IS NOT NULL AND length(btrim(p_detail)) > 500 THEN
    RAISE EXCEPTION 'Keep the detail to 500 characters or fewer';
  END IF;
  IF p_semester IS NULL OR length(btrim(p_semester)) = 0 THEN
    RAISE EXCEPTION 'Choose a semester';
  END IF;
  IF length(btrim(p_semester)) > 40 THEN
    RAISE EXCEPTION 'Keep the semester label to 40 characters or fewer';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club not found';
  END IF;
  IF NOT public.is_club_manager(p_org_id) THEN
    RAISE EXCEPTION 'Only club representatives can award recognition';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organization_members m
     WHERE m.organization_id = p_org_id
       AND m.user_id = p_person_id
       AND m.membership_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Recognition can only be awarded to approved club members';
  END IF;
  IF p_person_id = v_uid THEN
    RAISE EXCEPTION 'You cannot award recognition to yourself';
  END IF;

  INSERT INTO campus_honours (
    university_id, person_id, category, title, detail,
    points, semester, verified_by, organization_id, awarded_by
  )
  VALUES (
    v_org.university_id, p_person_id, p_category, btrim(p_title),
    NULLIF(btrim(p_detail), ''), p_points, btrim(p_semester),
    'club', p_org_id, v_uid
  )
  RETURNING id INTO v_id;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_person_id;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (
    p_org_id, v_uid, 'recognition_awarded',
    COALESCE(v_name, 'A member') || ' · ' || p_category || ' · +' || p_points
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_club_verification(
  p_org_id UUID,
  p_evidence_urls TEXT[] DEFAULT '{}',
  p_notes TEXT DEFAULT NULL,
  p_advisor TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a verification review';
  END IF;
  IF NOT public.is_club_manager(p_org_id) THEN
    RAISE EXCEPTION 'Only club representatives can request a verification review';
  END IF;
  IF p_notes IS NOT NULL AND length(btrim(p_notes)) > 1000 THEN
    RAISE EXCEPTION 'Keep the review notes to 1000 characters or fewer';
  END IF;
  IF p_advisor IS NOT NULL AND length(btrim(p_advisor)) > 120 THEN
    RAISE EXCEPTION 'Keep the advisor name to 120 characters or fewer';
  END IF;
  IF p_evidence_urls IS NOT NULL THEN
    IF array_length(p_evidence_urls, 1) > 5 THEN
      RAISE EXCEPTION 'Add at most five evidence links';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(p_evidence_urls) u
       WHERE u IS NULL OR u !~* '^https?://'
    ) THEN
      RAISE EXCEPTION 'Evidence links must start with http:// or https://';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM organization_verification_requests
     WHERE organization_id = p_org_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A verification review is already pending';
  END IF;

  INSERT INTO organization_verification_requests (
    organization_id, submitted_by, evidence_urls, advisor_name, notes, status
  )
  VALUES (
    p_org_id, v_uid, COALESCE(p_evidence_urls, '{}'), NULLIF(btrim(p_advisor), ''),
    NULLIF(btrim(p_notes), ''), 'pending'
  )
  RETURNING id INTO v_id;

  INSERT INTO organization_activity_log (organization_id, actor_id, action, detail)
  VALUES (p_org_id, v_uid, 'verification_requested', 'University re-verification review requested');

  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Grants — public reads only where safe, writes to authenticated students
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_clubs_directory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_club_detail(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_membership_card(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_club_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_honours_feed(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_club_manage_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_to_organization(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_club_application(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_organization(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_club_application(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_club_member_role(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_club_honour(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_club_verification(UUID, TEXT[], TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_clubs_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_detail(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_membership_card(TEXT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_club_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_honours_feed(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_manage_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_to_organization(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_club_application(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_organization(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_club_application(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_club_member_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_club_honour(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_club_verification(UUID, TEXT[], TEXT, TEXT) TO authenticated;
