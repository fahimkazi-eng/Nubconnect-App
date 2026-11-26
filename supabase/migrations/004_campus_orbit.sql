-- ============================================================================
-- NUBCONNECT — CAMPUS ORBIT
-- Migration: 004_campus_orbit.sql
--
-- Backward-compatible, purely ADDITIVE migration for the Campus Orbit
-- experience. Never drops or rewrites existing data (apply over 001 → 003):
--  • activity_plans + participants      — Make a Plan (§6.1)
--  • campus_now_statuses                — Campus Now (§6.2): opt-in, auto-
--                                          expiring, NO location tracking
--  • campus_introductions               — Introductions (§6.3): mutual
--                                          consent, silent decline
--  • community_groups expiry columns    — Temporary Circles (§6.4)
--  • organization_members verify token   — digital membership cards (§7.6)
--  • campus_honours                      — Campus Honours (§9)
--  • user_preferences.show_in_honours    — honours opt-out (§9)
--
-- Note on plan group chats: the existing message_requests.context_type is
-- free-form TEXT; plan chats reuse it with context_type = 'activity_plan'
-- (no schema change required).
--
-- All new tables enable RLS with university tenant isolation and owner-only
-- writes, mirroring the patterns of 002_rls_policies.sql / 003.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Make a Plan (§6.1): real-life meetups, 2–20 participants, public campus
--    spots only (meeting_spot is user-typed text; addresses are discouraged
--    by product copy and never geocoded).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Study', 'Sports', 'Food', 'Event', 'Errand')),
  meeting_spot TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  participant_limit INTEGER NOT NULL DEFAULT 5 CHECK (participant_limit BETWEEN 2 AND 20),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'full', 'cancelled', 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_plan_participants (
  plan_id UUID NOT NULL REFERENCES activity_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (plan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_plans_upcoming
  ON activity_plans(university_id, starts_at)
  WHERE status = 'open';

-- The creator is always a participant (enforced by trigger-free convention:
-- applications insert the creator row in the same transaction).

-- ---------------------------------------------------------------------------
-- 2. Campus Now (§6.2): a single opt-in status per student. The spot is
--    free text ("Central Library — 3rd floor"); NO geolocation, IP or
--    coordinates are ever stored. Rows auto-expire — the read policy below
--    hides anything past expires_at, and a scheduled cleanup may prune them.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campus_now_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity TEXT NOT NULL CHECK (activity IN ('Studying', 'Free', 'Eating', 'Walking', 'Club room', 'Gym')),
  spot_note TEXT NOT NULL,
  note TEXT,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- set to posted_at + 120 minutes on write
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id) -- one live status per student
);

CREATE INDEX IF NOT EXISTS idx_campus_now_active
  ON campus_now_statuses(university_id, expires_at);

-- ---------------------------------------------------------------------------
-- 3. Campus Introductions (§6.3): mutual-consent cards shown to ONE
--    recipient. Declining is silent — no notification row is ever created
--    for the other student (enforced by application flow, never by a
--    notification insert).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campus_introductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, -- who is introduced
  introduced_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, -- who sees the card
  basis TEXT NOT NULL, -- e.g. 'Same department', 'Both in Photography Circle'
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (person_id, introduced_to)
);

-- ---------------------------------------------------------------------------
-- 4. Temporary Circles (§6.4): community_groups gains an expiry and a
--    promotion timestamp. A group with expires_at in the past is hidden
--    unless made_permanent_at is set (members chose to keep it).
-- ---------------------------------------------------------------------------
ALTER TABLE community_groups
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE community_groups
  ADD COLUMN IF NOT EXISTS made_permanent_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 5. Club membership cards (§7.6): every approved organization member row
--    gets a random verification token. The token maps 1:1 to the public,
--    read-only /verify/{token} page which shows only what is printed on the
--    card. Revoking membership (status change) keeps the row but the page
--    resolves only approved members in the application layer.
-- ---------------------------------------------------------------------------
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS membership_verify_token TEXT;

-- Backfill existing members with distinct random tokens
UPDATE organization_members
  SET membership_verify_token = encode(gen_random_bytes(24), 'hex')
  WHERE membership_verify_token IS NULL;

-- New members always get one
ALTER TABLE organization_members
  ALTER COLUMN membership_verify_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_verify_token
  ON organization_members(membership_verify_token);

-- ---------------------------------------------------------------------------
-- 6. Campus Honours (§9): contribution points with transparent criteria.
--    Entries are verified by clubs/departments/university — students never
--    self-report. The RLS read policy enforces the opt-out at the data layer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campus_honours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('Mentoring', 'Organizing', 'Community Help', 'Knowledge Sharing', 'Creative Contribution', 'Volunteering')
  ),
  title TEXT NOT NULL,
  detail TEXT,
  points INTEGER NOT NULL CHECK (points > 0),
  semester TEXT NOT NULL, -- e.g. 'Fall 2026'
  verified_by TEXT NOT NULL DEFAULT 'club', -- 'club', 'department', 'university'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_honours_person
  ON campus_honours(person_id, semester);

-- ---------------------------------------------------------------------------
-- 7. Honours opt-out (§9): default TRUE (visible); students can hide their
--    name from Campus Honours and the Top Campus Contributor at any time.
-- ---------------------------------------------------------------------------
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS show_in_honours BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================================
-- RLS for the new capabilities (mirrors 002 / 003 patterns)
-- ============================================================================
ALTER TABLE activity_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_plan_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_now_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_introductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_honours ENABLE ROW LEVEL SECURITY;

-- Make a Plan: tenant-isolated reads, creator-only writes, self join/leave
CREATE POLICY "University members can read plans"
  ON activity_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_universities uu
      WHERE uu.user_id = auth.uid() AND uu.university_id = activity_plans.university_id
    )
  );

CREATE POLICY "Students can create plans in their university"
  ON activity_plans FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM user_universities uu
      WHERE uu.user_id = auth.uid() AND uu.university_id = activity_plans.university_id
    )
  );

CREATE POLICY "Plan creators can update or cancel their own plans"
  ON activity_plans FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Plan creators can delete their own plans"
  ON activity_plans FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "University members can read plan participants"
  ON activity_plan_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activity_plans p
      JOIN user_universities uu ON uu.university_id = p.university_id
      WHERE p.id = plan_id AND uu.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can join plans themselves"
  ON activity_plan_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can leave plans themselves"
  ON activity_plan_participants FOR DELETE
  USING (auth.uid() = user_id);

-- Campus Now: only LIVE statuses are readable (auto-expiry at the data
-- layer), writes are strictly your own row — one status per student.
CREATE POLICY "University members can read live campus-now statuses"
  ON campus_now_statuses FOR SELECT
  USING (
    expires_at > NOW()
    AND EXISTS (
      SELECT 1 FROM user_universities uu
      WHERE uu.user_id = auth.uid() AND uu.university_id = campus_now_statuses.university_id
    )
  );

CREATE POLICY "Students can post only their own campus-now status"
  ON campus_now_statuses FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_universities uu
      WHERE uu.user_id = auth.uid() AND uu.university_id = campus_now_statuses.university_id
    )
  );

CREATE POLICY "Students can update only their own campus-now status"
  ON campus_now_statuses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can clear only their own campus-now status"
  ON campus_now_statuses FOR DELETE
  USING (auth.uid() = user_id);

-- Introductions: strictly private to the recipient — nobody else (including
-- the introduced person) can see a pending card. Recipients decide alone.
CREATE POLICY "Students can read introductions addressed to them"
  ON campus_introductions FOR SELECT
  USING (auth.uid() = introduced_to);

CREATE POLICY "Students can request introductions for themselves"
  ON campus_introductions FOR INSERT
  WITH CHECK (auth.uid() = introduced_to);

CREATE POLICY "Recipients can accept or silently decline"
  ON campus_introductions FOR UPDATE
  USING (auth.uid() = introduced_to)
  WITH CHECK (auth.uid() = introduced_to);

-- Campus Honours: public read WITHIN the app, but the data layer itself
-- enforces the student opt-out (§9). No student-facing INSERT/UPDATE —
-- entries are verified by clubs/departments/university via the service role.
CREATE POLICY "Honours are visible unless the student opted out"
  ON campus_honours FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_preferences up
      WHERE up.user_id = campus_honours.person_id
        AND (up.show_in_honours IS NULL OR up.show_in_honours)
    )
  );
