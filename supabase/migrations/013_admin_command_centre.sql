-- ============================================================================
-- NUBCONNECT — Admin command centre
-- Migration: 013_admin_command_centre.sql
--
-- WHY THIS EXISTS
-- ---------------
-- PART 13/28 of the master prompt asks for one administrative command centre
-- backed by the same database as the student app. The schema already has
-- `user_roles`, `reports`, `moderation_actions`, `system_settings`,
-- `student_verifications` and `admin_audit_logs`; this migration adds the
-- missing pieces rather than a second admin system:
--
--   * `admin_roles`  — the six operational roles in the spec, with a clear
--                      permission matrix, layered on top of the legacy enum
--                      grants so existing `platform_super_admin` rows keep
--                      working.
--   * audited RPCs   — every sensitive read/write goes through a SECURITY
--                      DEFINER function that checks the caller server-side.
--                      Hiding a button is never the security boundary.
--   * audit trail    — writes to `admin_audit_logs` are append-only (a trigger
--                      rejects UPDATE/DELETE) and only reachable through the
--                      audited functions.
--   * feature flags  — stored in `system_settings`, toggled only by a Super
--                      Admin, and read back by the app so a switch has a real
--                      effect.
--
-- Additive only. No student content is deleted or rewritten.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Operational roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  granted_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_roles_role_check CHECK (
    role IN ('super_admin', 'admin', 'moderator', 'department_admin', 'club_admin', 'support_admin')
  ),
  CONSTRAINT admin_roles_user_role_key UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS admin_roles_user_idx ON public.admin_roles(user_id);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Who is an administrator, and what may they do?
--    SECURITY DEFINER keeps these checks out of RLS recursion and makes them
--    the single authorization authority for every admin RPC.
-- ----------------------------------------------------------------------------
/**
 * The effective operational roles for the caller. Legacy enum grants from
 * migration 001 remain honoured, so an existing `university_admin` or
 * `platform_super_admin` does not lose access when this migration lands.
 */
CREATE OR REPLACE FUNCTION public.admin_role_names()
RETURNS TEXT[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH effective AS (
    SELECT ar.role
    FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid()
    UNION
    SELECT CASE ur.role
      WHEN 'platform_super_admin'    THEN 'super_admin'
      WHEN 'university_admin'        THEN 'admin'
      WHEN 'university_content_admin' THEN 'moderator'
      WHEN 'department_editor'       THEN 'department_admin'
      WHEN 'club_representative'     THEN 'club_admin'
    END
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'platform_super_admin', 'university_admin',
        'university_content_admin', 'department_editor', 'club_representative'
      )
  )
  SELECT COALESCE(array_agg(DISTINCT role), '{}')
  FROM effective
  WHERE role IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('university_admin', 'platform_super_admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'platform_super_admin'
    );
$$;

/**
 * The permission matrix. Keep this in one place so the app and the database
 * cannot drift: the app asks `admin_my_access()` for the same answers.
 */
CREATE OR REPLACE FUNCTION public.admin_can(permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  roles TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  roles := public.admin_role_names();

  RETURN CASE permission
    -- Platform-wide governance is reserved to the Super Admin.
    WHEN 'roles.manage'    THEN FALSE
    WHEN 'features.manage' THEN FALSE
    WHEN 'pages.manage'    THEN 'admin' = ANY(roles)
    -- People
    WHEN 'users.view'      THEN 'admin' = ANY(roles)
    WHEN 'users.verify'    THEN roles && ARRAY['admin', 'department_admin', 'support_admin']
    WHEN 'users.suspend'   THEN 'admin' = ANY(roles)
    -- Content, reports and Campus Pulse
    WHEN 'content.moderate' THEN roles && ARRAY['admin', 'moderator', 'department_admin', 'club_admin']
    WHEN 'reports.resolve'  THEN roles && ARRAY['admin', 'moderator', 'department_admin', 'support_admin']
    WHEN 'pulse.monitor'    THEN roles && ARRAY['admin', 'moderator']
    WHEN 'audit.read'       THEN roles && ARRAY['admin', 'moderator', 'department_admin', 'support_admin']
    ELSE FALSE
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_require(permission TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_can(permission) THEN
    RAISE EXCEPTION 'You do not have the % permission', permission
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Append-only audit trail
--    The existing table is kept; writes flow through admin_write_audit().
--    A trigger blocks UPDATE/DELETE so history cannot be rewritten from the
--    app, and no INSERT policy is created for clients.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_audit_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Administrative audit records are append-only';
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_logs_immutable ON public.admin_audit_logs;
CREATE TRIGGER admin_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_audit_immutable();

DROP POLICY IF EXISTS "Administrators can read the audit trail" ON public.admin_audit_logs;
CREATE POLICY "Administrators can read the audit trail"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_admin());

-- Existing legacy policy remains for university_admin rows; the new policy
-- covers the operational roles above.

CREATE OR REPLACE FUNCTION public.admin_actor_role()
RETURNS app_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  roles TEXT[];
BEGIN
  IF public.is_super_admin() THEN
    RETURN 'platform_super_admin'::app_role_enum;
  END IF;

  roles := public.admin_role_names();

  IF 'admin' = ANY(roles) THEN
    RETURN 'university_admin'::app_role_enum;
  END IF;
  IF 'department_admin' = ANY(roles) THEN
    RETURN 'department_editor'::app_role_enum;
  END IF;
  IF 'club_admin' = ANY(roles) THEN
    RETURN 'club_representative'::app_role_enum;
  END IF;

  RETURN 'university_content_admin'::app_role_enum;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_write_audit(
  p_action       TEXT,
  p_table        TEXT,
  p_record_id    TEXT,
  p_reason       TEXT,
  p_diff         JSONB DEFAULT '{}'::jsonb,
  p_university   UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audit_id UUID;
  uni_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = 'insufficient_privilege';
  END IF;

  uni_id := p_university;
  IF uni_id IS NULL THEN
    SELECT COALESCE(
      (SELECT primary_university_id FROM public.profiles WHERE id = auth.uid()),
      (SELECT university_id FROM public.admin_roles WHERE user_id = auth.uid() AND university_id IS NOT NULL LIMIT 1),
      (SELECT id FROM public.universities ORDER BY created_at LIMIT 1)
    ) INTO uni_id;
  END IF;

  IF uni_id IS NULL THEN
    RAISE EXCEPTION 'No university is configured for this audit record';
  END IF;

  INSERT INTO public.admin_audit_logs (
    university_id, actor_id, actor_role, action_type, target_table,
    target_record_id, reason, diff_summary
  ) VALUES (
    uni_id, auth.uid(), public.admin_actor_role(), p_action, p_table,
    p_record_id, NULLIF(btrim(COALESCE(p_reason, '')), ''), COALESCE(p_diff, '{}'::jsonb)
  )
  RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Dashboard: real aggregates, honest gaps
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result JSONB;
  storage_total BIGINT;
  storage_week BIGINT;
  storage_large BIGINT;
BEGIN
  PERFORM public.admin_require('audit.read');

  BEGIN
    SELECT COALESCE(SUM((o.metadata->>'size')::BIGINT), 0),
           COALESCE(SUM(CASE WHEN o.created_at > now() - interval '7 days'
                             THEN (o.metadata->>'size')::BIGINT ELSE 0 END), 0),
           COUNT(*) FILTER (WHERE (o.metadata->>'size')::BIGINT > 5 * 1024 * 1024)
      INTO storage_total, storage_week, storage_large
      FROM storage.objects o;
  EXCEPTION WHEN OTHERS THEN
    storage_total := NULL;
    storage_week := NULL;
    storage_large := NULL;
  END;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'people', jsonb_build_object(
      'registered_students', (SELECT COUNT(*) FROM public.profiles),
      'verified_students', (SELECT COUNT(*) FROM public.profiles WHERE is_verified_student),
      'suspended_accounts', (SELECT COUNT(*) FROM public.profiles WHERE is_suspended),
      'new_students_7d', (SELECT COUNT(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
      'active_30d', (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at > now() - interval '30 days'),
      'unconfirmed_signups', (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL),
      'administrators', (SELECT COUNT(DISTINCT user_id) FROM public.admin_roles)
    ),
    'content', jsonb_build_object(
      'posts', (SELECT COUNT(*) FROM public.posts WHERE NOT is_hidden),
      'comments', (SELECT COUNT(*) FROM public.comments),
      'reactions', (SELECT COUNT(*) FROM public.reactions),
      'pages', (SELECT COUNT(*) FROM public.pages WHERE is_active),
      'page_followers', (SELECT COUNT(*) FROM public.follows WHERE target_type = 'page'),
      'clubs', (SELECT COUNT(*) FROM public.organizations),
      'club_memberships', (SELECT COUNT(*) FROM public.organization_members WHERE membership_status = 'approved'),
      'events', (SELECT COUNT(*) FROM public.events),
      'marketplace_listings', (SELECT COUNT(*) FROM public.marketplace_listings),
      'room_listings', (SELECT COUNT(*) FROM public.roommate_listings),
      'launch_posts', (SELECT COUNT(*) FROM public.posts WHERE is_seed_content)
    ),
    'pulse', jsonb_build_object(
      'available_now', (SELECT COUNT(*) FROM public.campus_now_statuses WHERE expires_at > now()),
      'open_activities', (SELECT COUNT(*) FROM public.activity_plans WHERE starts_at > now() AND status = 'open'),
      'reported_activities', (
        SELECT COUNT(*) FROM public.reports r
        WHERE r.target_type = 'activity' AND r.status IN ('open', 'under_review')
      )
    ),
    'moderation', jsonb_build_object(
      'pending_reports', (SELECT COUNT(*) FROM public.reports WHERE status IN ('open', 'under_review')),
      'pending_student_verifications', (SELECT COUNT(*) FROM public.student_verifications WHERE status = 'pending'),
      'pending_club_verifications', (SELECT COUNT(*) FROM public.organization_verification_requests WHERE status = 'pending')
    ),
    'storage', jsonb_build_object(
      'bytes_total', storage_total,
      'bytes_uploaded_7d', storage_week,
      'large_files', storage_large
    ),
    'health', jsonb_build_object(
      'database_bytes', pg_database_size(current_database()),
      'server_time', now()
    ),
    'unavailable', jsonb_build_array(
      'Engagement rate — requires per-session analytics that is not collected.',
      'Failed uploads — upload failures are not logged yet.',
      'Precise location analytics — deliberately never collected.'
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. People: search, verification, suspension, roles
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_query TEXT DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  department_name TEXT,
  is_verified_student BOOLEAN,
  is_suspended BOOLEAN,
  roles TEXT[],
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('users.view');

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.display_name,
    au.email::TEXT,
    p.avatar_url,
    d.name,
    p.is_verified_student,
    p.is_suspended,
    public.admin_role_names_for(p.id),
    p.created_at,
    au.last_sign_in_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN public.departments d ON d.id = p.department_id
  WHERE p_query IS NULL
     OR btrim(p_query) = ''
     OR p.display_name ILIKE '%' || btrim(p_query) || '%'
     OR p.username ILIKE '%' || btrim(p_query) || '%'
     OR au.email ILIKE '%' || btrim(p_query) || '%'
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 100))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_role_names_for(target_user UUID)
RETURNS TEXT[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH effective AS (
    SELECT ar.role
    FROM public.admin_roles ar
    WHERE ar.user_id = target_user
    UNION
    SELECT CASE ur.role
      WHEN 'platform_super_admin'    THEN 'super_admin'
      WHEN 'university_admin'        THEN 'admin'
      WHEN 'university_content_admin' THEN 'moderator'
      WHEN 'department_editor'       THEN 'department_admin'
      WHEN 'club_representative'     THEN 'club_admin'
    END
    FROM public.user_roles ur
    WHERE ur.user_id = target_user
      AND ur.role IN (
        'platform_super_admin', 'university_admin',
        'university_content_admin', 'department_editor', 'club_representative'
      )
  )
  SELECT COALESCE(array_agg(DISTINCT role), '{}')
  FROM effective
  WHERE role IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_verification(
  p_user_id UUID,
  p_approve BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_uni UUID;
  target_dept UUID;
  verification_id UUID;
BEGIN
  PERFORM public.admin_require('users.verify');

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Choose a student to review';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required for verification decisions';
  END IF;

  SELECT primary_university_id, department_id INTO target_uni, target_dept
  FROM public.profiles WHERE id = p_user_id;

  IF target_uni IS NULL THEN
    RAISE EXCEPTION 'That student is not linked to a university';
  END IF;

  UPDATE public.profiles
     SET is_verified_student = p_approve
   WHERE id = p_user_id;

  SELECT id INTO verification_id
  FROM public.student_verifications
  WHERE user_id = p_user_id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF verification_id IS NOT NULL THEN
    UPDATE public.student_verifications
       SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
           reviewed_by = auth.uid(),
           reviewed_at = now()
     WHERE id = verification_id;
  ELSE
    INSERT INTO public.student_verifications (
      user_id, university_id, verification_method, status, reviewed_by, reviewed_at
    ) VALUES (
      p_user_id, target_uni, 'manual_admin_review',
      CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      auth.uid(), now()
    )
    RETURNING id INTO verification_id;
  END IF;

  PERFORM public.admin_write_audit(
    CASE WHEN p_approve THEN 'verification.approved' ELSE 'verification.rejected' END,
    'profiles', p_user_id::TEXT, p_reason,
    jsonb_build_object('verification_id', verification_id, 'department_id', target_dept),
    target_uni
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_suspension(
  p_user_id UUID,
  p_suspend BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_uni UUID;
BEGIN
  PERFORM public.admin_require('users.suspend');

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own account status';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to change an account status';
  END IF;

  SELECT primary_university_id INTO target_uni
  FROM public.profiles WHERE id = p_user_id;

  IF target_uni IS NULL THEN
    RAISE EXCEPTION 'That student is not linked to a university';
  END IF;

  UPDATE public.profiles SET is_suspended = p_suspend WHERE id = p_user_id;

  PERFORM public.admin_write_audit(
    CASE WHEN p_suspend THEN 'account.suspended' ELSE 'account.restored' END,
    'profiles', p_user_id::TEXT, p_reason,
    jsonb_build_object('suspended', p_suspend),
    target_uni
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_role(
  p_user_id UUID,
  p_role    TEXT,
  p_assign  BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_uni UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a Super Admin can change administrative roles'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_role NOT IN ('super_admin', 'admin', 'moderator', 'department_admin', 'club_admin', 'support_admin') THEN
    RAISE EXCEPTION 'Unknown administrative role: %', p_role;
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to change an administrative role';
  END IF;
  IF p_user_id = auth.uid() AND p_role = 'super_admin' AND NOT p_assign THEN
    RAISE EXCEPTION 'You cannot remove your own Super Admin role';
  END IF;

  SELECT primary_university_id INTO target_uni
  FROM public.profiles WHERE id = p_user_id;

  IF target_uni IS NULL THEN
    RAISE EXCEPTION 'That student is not linked to a university';
  END IF;

  IF p_assign THEN
    INSERT INTO public.admin_roles (user_id, role, university_id, granted_by, note)
    VALUES (p_user_id, p_role, target_uni, auth.uid(), p_reason)
    ON CONFLICT (user_id, role) DO nothing;
  ELSE
    DELETE FROM public.admin_roles WHERE user_id = p_user_id AND role = p_role;
  END IF;

  PERFORM public.admin_write_audit(
    CASE WHEN p_assign THEN 'role.granted' ELSE 'role.revoked' END,
    'admin_roles', p_user_id::TEXT || ':' || p_role, p_reason,
    jsonb_build_object('role', p_role, 'assigned', p_assign),
    target_uni
  );
END;
$$;

-- The app uses this to decide which controls to render. It grants nothing.
CREATE OR REPLACE FUNCTION public.admin_my_access()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'is_admin', public.is_admin(),
    'is_super_admin', public.is_super_admin(),
    'roles', public.admin_role_names(),
    'permissions', jsonb_build_object(
      'roles.manage', public.admin_can('roles.manage'),
      'features.manage', public.admin_can('features.manage'),
      'pages.manage', public.admin_can('pages.manage'),
      'users.view', public.admin_can('users.view'),
      'users.verify', public.admin_can('users.verify'),
      'users.suspend', public.admin_can('users.suspend'),
      'content.moderate', public.admin_can('content.moderate'),
      'reports.resolve', public.admin_can('reports.resolve'),
      'pulse.monitor', public.admin_can('pulse.monitor'),
      'audit.read', public.admin_can('audit.read')
    )
  );
$$;

-- ----------------------------------------------------------------------------
-- 6. Launch content: identify, filter, archive, restore
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_launch_content(
  p_batch TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  body_preview TEXT,
  page_name TEXT,
  seed_batch TEXT,
  source_organization TEXT,
  source_url TEXT,
  content_rights TEXT,
  internal_reviewer TEXT,
  publication_status TEXT,
  is_hidden BOOLEAN,
  removal_eligible BOOLEAN,
  original_published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('audit.read');

  RETURN QUERY
  SELECT
    p.id,
    p.title,
    left(p.body, 240),
    pg.name,
    p.seed_batch,
    p.source_organization,
    p.source_url,
    p.content_rights,
    p.internal_reviewer,
    p.publication_status,
    p.is_hidden,
    p.removal_eligible,
    p.original_published_at,
    p.created_at
  FROM public.posts p
  LEFT JOIN public.pages pg ON pg.id = p.page_id
  WHERE p.is_seed_content = TRUE
    AND (p_batch IS NULL OR p_batch = '' OR p.seed_batch = p_batch)
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_moderate_post(
  p_post_id UUID,
  p_action  TEXT,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_page UUID;
  target_seed BOOLEAN;
  target_eligible BOOLEAN;
  target_uni UUID;
BEGIN
  PERFORM public.admin_require('content.moderate');

  IF p_action NOT IN ('hide', 'restore', 'archive') THEN
    RAISE EXCEPTION 'Unknown moderation action: %', p_action;
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required for every moderation action';
  END IF;

  SELECT page_id, is_seed_content, removal_eligible, university_id
    INTO target_page, target_seed, target_eligible, target_uni
  FROM public.posts WHERE id = p_post_id;

  IF target_uni IS NULL THEN
    RAISE EXCEPTION 'That post no longer exists';
  END IF;

  -- A club/department administrator may only moderate content on Pages they
  -- manage. Platform-level moderators and admins can act anywhere.
  IF NOT (public.is_super_admin() OR 'admin' = ANY(public.admin_role_names()) OR 'moderator' = ANY(public.admin_role_names()))
     AND NOT public.can_manage_page(target_page) THEN
    RAISE EXCEPTION 'You can only moderate content on Pages you manage'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_action = 'archive' THEN
    IF NOT target_eligible AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'This item is protected from removal';
    END IF;
    UPDATE public.posts
       SET is_hidden = TRUE,
           publication_status = 'archived',
           updated_at = now()
     WHERE id = p_post_id;
  ELSIF p_action = 'hide' THEN
    UPDATE public.posts SET is_hidden = TRUE, updated_at = now() WHERE id = p_post_id;
  ELSE
    UPDATE public.posts
       SET is_hidden = FALSE,
           publication_status = 'published',
           updated_at = now()
     WHERE id = p_post_id;
  END IF;

  PERFORM public.admin_write_audit(
    'post.' || p_action,
    'posts', p_post_id::TEXT, p_reason,
    jsonb_build_object('is_seed_content', target_seed, 'page_id', target_page),
    target_uni
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Reports
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_reports(
  p_status TEXT DEFAULT NULL,
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  target_type TEXT,
  target_id TEXT,
  reason_category TEXT,
  details TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  reporter_name TEXT,
  reporter_username TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('reports.resolve');

  RETURN QUERY
  SELECT r.id, r.target_type, r.target_id, r.reason_category, r.details, r.status,
         r.created_at, p.display_name, p.username
  FROM public.reports r
  JOIN public.profiles p ON p.id = r.reporter_id
  WHERE p_status IS NULL OR p_status = '' OR r.status = p_status
  ORDER BY r.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  p_report_id UUID,
  p_status    TEXT,
  p_reason    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_uni UUID;
BEGIN
  PERFORM public.admin_require('reports.resolve');

  IF p_status NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'A report can only be resolved or dismissed';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to close a report';
  END IF;

  SELECT university_id INTO target_uni FROM public.reports WHERE id = p_report_id;
  IF target_uni IS NULL THEN
    RAISE EXCEPTION 'That report no longer exists';
  END IF;

  UPDATE public.reports SET status = p_status WHERE id = p_report_id;

  INSERT INTO public.moderation_actions (report_id, moderator_id, action_taken, reason)
  VALUES (p_report_id, auth.uid(), p_status, p_reason);

  PERFORM public.admin_write_audit(
    'report.' || p_status,
    'reports', p_report_id::TEXT, p_reason, '{}'::jsonb, target_uni
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Feature flags + platform announcement
--    Only switches the app actually enforces are exposed.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_feature_flags()
RETURNS TABLE (
  key TEXT,
  enabled BOOLEAN,
  updated_at TIMESTAMPTZ,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('audit.read');

  RETURN QUERY
  SELECT f.key,
         COALESCE((s.value->>'enabled')::BOOLEAN, TRUE),
         s.updated_at,
         f.description
  FROM (VALUES
    ('campus_pulse', 'Campus Pulse — opt-in presence, activities and the Home/Circle strips'),
    ('marketplace', 'Marketplace — listings, saves and enquiries'),
    ('roommates', 'Room — roommate listings and enquiries'),
    ('stories', 'Campus Stories — reserved until the Stories surface ships')
  ) AS f(key, description)
  LEFT JOIN public.system_settings s ON s.key = 'feature.' || f.key
  ORDER BY f.key;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_feature(
  p_key     TEXT,
  p_enabled BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a Super Admin can change platform features'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_key NOT IN ('campus_pulse', 'marketplace', 'roommates', 'stories') THEN
    RAISE EXCEPTION 'Unknown feature key: %', p_key;
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to change a feature';
  END IF;

  INSERT INTO public.system_settings (key, value, updated_at)
  VALUES ('feature.' || p_key, jsonb_build_object('enabled', p_enabled), now())
  ON CONFLICT (key) DO UPDATE
    SET value = jsonb_build_object('enabled', p_enabled), updated_at = now();

  PERFORM public.admin_write_audit(
    'feature.' || CASE WHEN p_enabled THEN 'enabled' ELSE 'disabled' END,
    'system_settings', 'feature.' || p_key, p_reason,
    jsonb_build_object('enabled', p_enabled)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_announcement(
  p_message TEXT,
  p_active  BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a Super Admin can publish a platform announcement'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_active AND NULLIF(btrim(COALESCE(p_message, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Write the announcement before switching it on';
  END IF;

  INSERT INTO public.system_settings (key, value, updated_at)
  VALUES ('platform.announcement',
          jsonb_build_object('message', COALESCE(btrim(p_message), ''), 'active', p_active),
          now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();

  PERFORM public.admin_write_audit(
    CASE WHEN p_active THEN 'announcement.published' ELSE 'announcement.cleared' END,
    'system_settings', 'platform.announcement', p_reason,
    jsonb_build_object('active', p_active)
  );
END;
$$;

/**
 * Public flags read by the student app. Deliberately limited to the switches
 * the app enforces, and never exposes administrative metadata.
 */
CREATE OR REPLACE FUNCTION public.platform_flags()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'campus_pulse', COALESCE((SELECT (value->>'enabled')::BOOLEAN FROM public.system_settings WHERE key = 'feature.campus_pulse'), TRUE),
    'marketplace', COALESCE((SELECT (value->>'enabled')::BOOLEAN FROM public.system_settings WHERE key = 'feature.marketplace'), TRUE),
    'roommates', COALESCE((SELECT (value->>'enabled')::BOOLEAN FROM public.system_settings WHERE key = 'feature.roommates'), TRUE),
    'stories', COALESCE((SELECT (value->>'enabled')::BOOLEAN FROM public.system_settings WHERE key = 'feature.stories'), FALSE),
    'announcement', (
      SELECT CASE WHEN COALESCE((value->>'active')::BOOLEAN, FALSE)
                  THEN jsonb_build_object('message', value->>'message')
                  ELSE NULL END
      FROM public.system_settings WHERE key = 'platform.announcement'
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Audit list for the command centre
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_audit(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  action_type TEXT,
  target_table TEXT,
  target_record_id TEXT,
  reason TEXT,
  actor_name TEXT,
  actor_role app_role_enum,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('audit.read');

  RETURN QUERY
  SELECT a.id, a.action_type, a.target_table, a.target_record_id, a.reason,
         COALESCE(p.display_name, 'Former administrator'), a.actor_role, a.created_at
  FROM public.admin_audit_logs a
  LEFT JOIN public.profiles p ON p.id = a.actor_id
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Policies, grants and least privilege
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Administrators can read admin roles" ON public.admin_roles;
CREATE POLICY "Administrators can read admin roles"
  ON public.admin_roles FOR SELECT
  USING (public.is_admin());

-- system_settings previously had no RLS. Feature flags and the announcement
-- are readable only through `platform_flags()`; direct writes stay closed.
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only administrators read raw settings" ON public.system_settings;
CREATE POLICY "Only administrators read raw settings"
  ON public.system_settings FOR SELECT
  USING (public.is_admin());

-- Function grants: authenticated only, never anon.
REVOKE ALL ON FUNCTION public.admin_dashboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_search_users(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_role_names_for(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_verification(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_suspension(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_role(UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_my_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_launch_content(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_moderate_post(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_reports(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_resolve_report(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_feature_flags() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_feature(TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_announcement(TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_flags() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_audit(INT, INT) FROM PUBLIC;
-- Internal helpers: not callable from the API surface at all.
REVOKE ALL ON FUNCTION public.admin_write_audit(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_require(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_actor_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_can(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_role_names() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_users(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_role_names_for(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_verification(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_suspension(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_my_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_launch_content(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_post(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_feature_flags() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_feature(TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_announcement(TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_flags() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit(INT, INT) TO authenticated;
-- admin_require/admin_can/is_admin are used inside the definer functions above;
-- they are not granted to clients directly. `admin_require` is also called by
-- functions that run as the same owner, so no client grant is needed.

COMMENT ON TABLE public.admin_roles IS
  'Operational administrative roles (PART 13). Writes go through admin_assign_role().';
COMMENT ON FUNCTION public.admin_dashboard() IS
  'Platform aggregates for the admin command centre. Real counts only; unavailable metrics are listed explicitly.';
COMMENT ON FUNCTION public.platform_flags() IS
  'The feature switches the student app enforces. Never exposes admin metadata.';
