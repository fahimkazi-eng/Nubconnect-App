-- ============================================================================
-- NUB Connect — Admin permission matrix correction
-- ----------------------------------------------------------------------------
-- Migration 013 granted `users.verify` to Department Admins and Support Admins
-- but left `users.view` (the permission behind `admin_search_users()`) limited
-- to the `admin` role. Those staff could see a "review verification" action in
-- principle, yet could not find the student to act on.
--
-- This migration makes the matrix coherent: anyone who can review a student
-- can search for that student. It changes no data and grants no new role.
-- ============================================================================

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
    -- People. Verification staff must be able to find the account they review.
    WHEN 'users.view'      THEN roles && ARRAY['admin', 'department_admin', 'support_admin']
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

COMMENT ON FUNCTION public.admin_can(TEXT) IS
  'Single permission matrix for the admin command centre. Verification staff can also search students.';
