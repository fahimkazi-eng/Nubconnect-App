-- ============================================================================
-- NUBCONNECT — Migration 018: voice notes, pinned messages, presence prefs
--
-- Required by the PART 19 messenger features. Apply after 016 and 017.
--
--   1. message-photos bucket gains audio mime types (voice notes).
--   2. New user_preferences columns: synced presence preference and a
--      per-account switch for incoming message notifications.
--   3. New pinned_messages table — any participant may pin or unpin any
--      message in their own conversation (WhatsApp-style), enforced by RLS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Allow voice-note audio in the private message bucket (8 MiB cap kept).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-photos',
  'message-photos',
  FALSE,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. user_preferences additions (defaults chosen for privacy-first).
-- ---------------------------------------------------------------------------
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS show_online BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_messages BOOLEAN NOT NULL DEFAULT TRUE;

-- ---------------------------------------------------------------------------
-- 3. Pinned messages — any participant of the conversation may pin/unpin.
--    One pin per message. Deleting the message cascades the pin away.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pinned_messages (
  message_id UUID PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pinned_messages_conversation_idx
  ON pinned_messages (conversation_id, pinned_at);

ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can read pinned messages" ON pinned_messages;
CREATE POLICY "Participants can read pinned messages"
  ON pinned_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Participants can pin messages in their conversations" ON pinned_messages;
CREATE POLICY "Participants can pin messages in their conversations"
  ON pinned_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = pinned_by
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Participants can unpin messages in their conversations" ON pinned_messages;
CREATE POLICY "Participants can unpin messages in their conversations"
  ON pinned_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

-- ---------------------------------------------------------------------------
-- Verification queries (run AFTER applying)
-- ---------------------------------------------------------------------------
-- 1. Bucket now accepts audio:
--    SELECT allowed_mime_types FROM storage.buckets WHERE id = 'message-photos';
-- 2. New preference columns:
--    SELECT show_online, notify_messages FROM user_preferences LIMIT 1;
-- 3. Pinned message policies:
--    SELECT policyname, cmd FROM pg_policies WHERE tablename = 'pinned_messages';
-- 4. Pin round-trip as a participant (as user A):
--    INSERT INTO pinned_messages (message_id, conversation_id, pinned_by)
--      VALUES ('<message-id>', '<conversation-id>', '<your-user-id>');   -- ok
--    INSERT INTO pinned_messages (message_id, conversation_id, pinned_by)
--      VALUES ('<message-id>', '<conversation-id>', '<other-user-id>'); -- ERROR: not your conversation
--    DELETE FROM pinned_messages WHERE message_id = '<message-id>';     -- ok
