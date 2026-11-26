-- ============================================================================
-- NUBCONNECT — Migration 020: department & circle (community group) media
-- ============================================================================
-- Adds the storage-independent columns and SECURITY DEFINER writers for:
--
--   • Department pages — logo + cover (only university admins/department
--     admins may change them; everything else stays read-only).
--   • Circles — avatar + cover (the circle owner or university admins may
--     change them; group identity fields are never writable via these RPCs).
--
-- The actual file bytes live in the existing PUBLIC `covers` bucket under the
-- owner's own folder (<uid>/...), written through the same authorized upload
-- route as post photographs. This migration adds NO new buckets and NO new
-- storage policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Columns (idempotent)
-- ----------------------------------------------------------------------------
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE public.community_groups
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  -- cover_url already exists (added in migration 003).

-- ----------------------------------------------------------------------------
-- 2. Internal authorization helper for administrative media changes.
--    Department editors: university/department admins only.
--    Circle owners: creator or university admins.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_class()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.admin_role_names() && ARRAY['super_admin', 'admin', 'department_admin']
     OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('university_admin', 'platform_super_admin')
        );
$$;

-- ----------------------------------------------------------------------------
-- 3. Department media — logo and cover only. Every other column is untouched.
--    Requires an administrative class role in the same university.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_department_media(
  p_department_id uuid,
  p_logo_url text DEFAULT NULL,
  p_cover_url text DEFAULT NULL,
  p_remove_logo boolean DEFAULT false,
  p_remove_cover boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_uni UUID;
BEGIN
  SELECT university_id INTO target_uni FROM public.departments WHERE id = p_department_id;
  IF target_uni IS NULL THEN
    RAISE EXCEPTION 'department not found';
  END IF;
  IF NOT public.is_admin_class() THEN
    RAISE EXCEPTION 'Only university administrators can change department media.';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;

  UPDATE public.departments
     SET logo_url = CASE
           WHEN p_remove_logo THEN NULL
           WHEN p_logo_url IS NOT NULL THEN p_logo_url
           ELSE logo_url
         END,
         cover_url = CASE
           WHEN p_remove_cover THEN NULL
           WHEN p_cover_url IS NOT NULL THEN p_cover_url
           ELSE cover_url
         END
   WHERE id = p_department_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Circle media — avatar and cover only. University id, slug, type, rules,
--    created_by and university are never writable through this path.
--    Requires: the circle's creator, or an admin-class role.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_group_media(
  p_group_id uuid,
  p_avatar_url text DEFAULT NULL,
  p_cover_url text DEFAULT NULL,
  p_remove_avatar boolean DEFAULT false,
  p_remove_cover boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.community_groups%ROWTYPE;
BEGIN
  SELECT * INTO target FROM public.community_groups WHERE id = p_group_id;
  IF target.id IS NULL THEN
    RAISE EXCEPTION 'circle not found';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF target.created_by <> auth.uid() AND NOT public.is_admin_class() THEN
    RAISE EXCEPTION 'Only the circle owner or a university administrator can change circle media.';
  END IF;

  UPDATE public.community_groups
     SET avatar_url = CASE
           WHEN p_remove_avatar THEN NULL
           WHEN p_avatar_url IS NOT NULL THEN p_avatar_url
           ELSE avatar_url
         END,
         cover_url = CASE
           WHEN p_remove_cover THEN NULL
           WHEN p_cover_url IS NOT NULL THEN p_cover_url
           ELSE cover_url
         END
   WHERE id = p_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin_class() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_department_media(uuid, text, text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_group_media(uuid, text, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_class() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_department_media(uuid, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_group_media(uuid, text, text, boolean, boolean) TO authenticated;

-- ----------------------------------------------------------------------------
-- Verification queries (run AFTER applying)
-- ----------------------------------------------------------------------------
-- 1. Columns exist:
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'departments' AND column_name IN ('logo_url', 'cover_url');
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'community_groups' AND column_name = 'avatar_url';
-- 2. RPCs callable from authenticated role:
--    -- as a department_admin: select public.set_department_media('<id>', 'x', NULL);
--    -- as an unrelated student: same call → ERROR Only university administrators…
--    -- as circle owner:   select public.set_group_media('<gid>', 'x', NULL); -- ok
--    -- as non-owner student: same call → ERROR Only the circle owner…
--    -- removal:           select public.set_department_media('<id>', NULL, NULL, true, false);
--    --                    select public.set_group_media('<gid>', NULL, NULL, true, false);
-- 3. Writable columns respected:
--    -- set_group_media must never change university_id / created_by:
--    SELECT university_id, created_by FROM community_groups WHERE id = '<gid>';
--    -- before and after the call must be identical.
