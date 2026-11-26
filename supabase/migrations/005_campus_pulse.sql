-- ============================================================================
-- NUBCONNECT — CAMPUS PULSE ("Who's on Campus?") + expressive reactions
-- Migration: 005_campus_pulse.sql
--
-- Backward-compatible, purely ADDITIVE migration (apply over 001 → 004).
-- Never drops or rewrites existing data:
--  • campus_now_statuses.open_to_connect — optional "Open to Connect" signal
--    on the voluntary, auto-expiring campus presence (§7)
--  • comment_reactions                   — reactions on comments (§8),
--    mirroring the posts.reactions contract (one per user per comment)
--
-- Vocabulary documentation (no constraint changes needed — these columns
-- are free-form TEXT by design since 001/004):
--  • reactions.reaction_type now stores the NUBCONNECT universal set:
--    'love', 'fire', 'lol', 'respect', 'amazing', 'support', 'inspired',
--    'proud' (one reaction per user per post, unchanged).
--  • comment_reactions.reaction_type uses the same universal set.
--  • event_registrations.status may hold 'interested' or 'going' for the
--    contextual Event actions (§8) alongside the existing 'registered'.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Campus Now: "Open to Connect" — an opt-in, non-tracking signal that the
--    student is happy to be approached right now. FALSE by default; the row
--    still auto-expires via the 004 read policy (expires_at > NOW()).
--    No geolocation is ever involved.
-- ---------------------------------------------------------------------------
ALTER TABLE campus_now_statuses
  ADD COLUMN IF NOT EXISTS open_to_connect BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 2. Comment reactions (§8): one reaction per user per comment, same universal
--    vocabulary as posts.reactions. Public read (counts are visible to
--    everyone); writes strictly your own row — mirroring the reactions
--    policies from 003.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL, -- universal set: love/fire/lol/respect/amazing/support/inspired/proud
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment
  ON comment_reactions(comment_id);

ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comment reactions"
  ON comment_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users manage only their own comment reactions"
  ON comment_reactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
