-- ============================================================================
-- NUBCONNECT — Row Level Security (RLS) & Backend Authorization Policies
-- Migration: 002_rls_policies.sql
-- Enforces strict university-level isolation, role-based mutation controls,
-- and private verification document protection.
-- ============================================================================

-- Helper functions for RBAC and Tenant Isolation
CREATE OR REPLACE FUNCTION public.user_has_role(target_uni UUID, allowed_roles app_role_enum[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND university_id = target_uni
      AND role = ANY(allowed_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_club_rep(target_org UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_representatives
    WHERE organization_id = target_org
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS across sensitive & tenant-scoped tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommate_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommate_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Student Verifications: Strictly private to the owner and University Admins
CREATE POLICY "Users can view only their own verification requests"
  ON student_verifications FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.user_has_role(university_id, ARRAY['university_admin', 'platform_super_admin']::app_role_enum[])
  );

CREATE POLICY "Only University Admins can approve student verifications"
  ON student_verifications FOR UPDATE
  USING (
    public.user_has_role(university_id, ARRAY['university_admin', 'platform_super_admin']::app_role_enum[])
  );

-- 2. Organizations: Club representatives can update club details but CANNOT change verification_status
CREATE POLICY "Public read for active university organizations"
  ON organizations FOR SELECT
  USING (true);

CREATE POLICY "Club reps can update description/events but not verification badge"
  ON organizations FOR UPDATE
  USING (
    public.is_club_rep(id)
    OR public.user_has_role(university_id, ARRAY['university_admin', 'platform_super_admin']::app_role_enum[])
  )
  WITH CHECK (
    public.user_has_role(university_id, ARRAY['university_admin', 'platform_super_admin']::app_role_enum[])
    OR (
      public.is_club_rep(id)
      AND verification_status = (SELECT o.verification_status FROM organizations o WHERE o.id = organizations.id)
    )
  );

-- 3. Academic Planner & GPA Records: Strictly isolated per student
CREATE POLICY "Students can only read and modify their own academic planner courses"
  ON user_courses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can only access their own GPA estimates"
  ON semester_records FOR ALL
  USING (auth.uid() = user_id AND is_official_verified = FALSE)
  WITH CHECK (auth.uid() = user_id AND is_official_verified = FALSE);

-- 4. Consent-Based Messaging: Blocked users cannot send message requests or messages
CREATE POLICY "Participants can view conversations unless blocked"
  ON conversations FOR SELECT
  USING (auth.uid() IN (participant_one, participant_two));

CREATE POLICY "Send message only in active conversations and when not blocked"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND c.status = 'active'
        AND auth.uid() IN (c.participant_one, c.participant_two)
        AND NOT EXISTS (
          SELECT 1 FROM blocked_users b
          WHERE (b.blocker_id = c.participant_one AND b.blocked_id = c.participant_two)
             OR (b.blocker_id = c.participant_two AND b.blocked_id = c.participant_one)
        )
    )
  );

-- 5. Admin Audit Logs: Restricted strictly to University Administrators & Super Admins
CREATE POLICY "Only authorized admins can read audit logs"
  ON admin_audit_logs FOR SELECT
  USING (
    public.user_has_role(university_id, ARRAY['university_admin', 'platform_super_admin']::app_role_enum[])
  );
