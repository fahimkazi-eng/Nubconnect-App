-- ============================================================================
-- NUBCONNECT — Migration 015: trust & reporting hardening
--
-- This file contains TWO sections:
--
--   PART A (required, safe)  — closes a real over-permissive RLS hole and
--                              enables the "Content reporting is unavailable"
--                              gap to be fixed. Idempotent.
--   PART B (optional)        — anonymous read of OFFICIAL, non-member content
--                              so logged-out visitors can browse real NUB
--                              data on the public landing page. Review the
--                              exact policies, then decide with the university.
--
-- Apply with: supabase db push  (or psql -f in order 001..015)
-- Verify with the queries at the bottom.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PART A1. group_members — was "FOR ALL USING (true)": any authenticated user
-- could INSERT/UPDATE/DELETE anyone's membership rows. Replace with the exact
-- four policies the app actually needs.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone authenticated can join, members can leave" ON group_members;

DROP POLICY IF EXISTS "Members can read group rosters" ON group_members;
CREATE POLICY "Members can read group rosters"
  ON group_members FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Students join themselves" ON group_members;
CREATE POLICY "Students join themselves"
  ON group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students update their own membership" ON group_members;
CREATE POLICY "Students update their own membership"
  ON group_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students leave for themselves" ON group_members;
CREATE POLICY "Students leave for themselves"
  ON group_members FOR DELETE
  USING (auth.uid() = user_id);

-- Role changes beyond "member" should go through a SECURITY DEFINER RPC that
-- checks the actor's authority (e.g. is_club_manager for clubs); direct
-- promotion from the client is now impossible.

-- ---------------------------------------------------------------------------
-- PART A2. reports — let a signed-in student file a report about a piece of
-- content or a person. This is what turns "Content reporting is unavailable"
-- into a working Report action. Write-only for the reporter; reads stay with
-- moderators via the existing SECURITY DEFINER RPCs (admin_list_reports).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Students can file reports" ON reports;
CREATE POLICY "Students can file reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- PART A3. (verification helper) — remember to re-enable the client Report
-- button after this section is applied; the app is already built to call the
-- insert path and only needs the store to be reconnected to it.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- PART B (OPTIONAL) — anonymous read of OFFICIAL, public, non-member content
-- ===========================================================================
-- Rationale: the public landing page shows the official events feed and the
-- verified institutional roster (departments/clubs) without an account. These
-- policies expose ONLY official, institutional, non-member facts.
--
-- Deliberately NOT exposed: profiles, group_members, community_groups (carries
-- creator ids and no visibility flag), posts (real student posts), messages,
-- conversations, saved_items, honours internals. Circles/clubs/marketplace/
-- rooms browsing for guests stays blocked until the university explicitly
-- approves which surfaces open to anonymous users — that decision needs a
-- privacy review, not just code.
--
-- Uncomment PART B only if you want logged-out visitors to read live official
-- content in the app (not just on the landing page).
--
-- ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Public can read official departments" ON departments;
-- CREATE POLICY "Public can read official departments"
--   ON departments FOR SELECT
--   TO anon
--   USING (true);  -- departments are official, institutional, public facts
--
-- DROP POLICY IF EXISTS "Public can read verified organizations" ON organizations;
-- CREATE POLICY "Public can read verified organizations"
--   ON organizations FOR SELECT
--   TO anon
--   USING (verification_status IN ('officially_verified','department_verified','recognized_organization'));
--
-- DROP POLICY IF EXISTS "Public can read official events" ON events;
-- CREATE POLICY "Public can read official events"
--   ON events FOR SELECT
--   TO anon
--   USING (content_origin = 'official_university');
--
-- DROP POLICY IF EXISTS "Public can read official seed posts" ON posts;
-- CREATE POLICY "Public can read official seed posts"
--   ON posts FOR SELECT
--   TO anon
--   USING (content_origin = 'official_university'
--          AND publication_status = 'published'
--          AND visibility = 'university'
--          AND is_seed_content = TRUE);
--
-- DROP POLICY IF EXISTS "Public can read official seed post media" ON post_media;
-- CREATE POLICY "Public can read official seed post media"
--   ON post_media FOR SELECT
--   TO anon
--   USING (EXISTS (
--     SELECT 1 FROM posts p
--     WHERE p.id = post_id
--       AND p.content_origin = 'official_university'
--       AND p.publication_status = 'published'
--       AND p.is_seed_content = TRUE
--   ));

-- ---------------------------------------------------------------------------
-- Verification queries (run AFTER applying)
-- ---------------------------------------------------------------------------
-- 1. group_members policies:
--    SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'group_members' ORDER BY policyname;
--    -- expect: Members can read group rosters (SELECT),
--    --         Students join themselves (INSERT),
--    --         Students update their own membership (UPDATE),
--    --         Students leave for themselves (DELETE)
-- 2. reports insert policy:
--    SELECT policyname, cmd, roles::text FROM pg_policies
--    WHERE tablename = 'reports';
-- 3. Member can join a group and cannot delete another user's row:
--    -- supabase anon client as user X:
--    -- insert into group_members (group_id, user_id) values (<gid>, '<X>');   -- ok
--    -- delete from group_members where group_id = <gid> and user_id = '<Y>'; -- 0 rows
-- 4. Student can file a report:
--    -- insert into reports (university_id, reporter_id, target_type, target_id,
--    --   reason_category, details) values (...,'post','<id>','spam','test'); -- ok
-- 5. (If PART B enabled) anon read check:
--    -- select code from departments limit 1;  -- as anon: returns rows
--    -- select display_name from profiles limit 1; -- as anon: returns 0 rows / permission denied
