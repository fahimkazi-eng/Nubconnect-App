-- ============================================================================
-- NUBCONNECT — Real conversations & messaging (Phase 3)
-- Migration: 007_messaging.sql
--
-- Additive only. Turns the Phase 1/2 chat UI into a real, private, consent-
-- based 1:1 messaging layer:
--   • conversations  — kind, requested_by, last_message_at, item context
--   • messages       — photo attachments + replies
--   • message_reactions / conversation_settings (pin, mute, archive)
--   • RLS for every conversation table (002 only had partial policies)
--   • SECURITY DEFINER RPCs for the consent flow, read receipts, reactions,
--     blocking and the inbox query
--   • private message-photos bucket, readable only by the two participants
--
-- Group/plan chats stay local to the current browser session until group
-- messaging ships; this migration intentionally models the real 1:1
-- conversation only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Conversation & message additions
-- ----------------------------------------------------------------------------
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS context JSONB;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_kind_check;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_kind_check
  CHECK (kind IN ('direct', 'room', 'marketplace', 'group', 'plan'));

-- Backfill the sort timestamp from existing history. No rows are removed.
UPDATE conversations c
   SET last_message_at = COALESCE(
         (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id),
         c.created_at
       )
 WHERE c.last_message_at IS NULL;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE INDEX IF NOT EXISTS conversations_participant_one_idx
  ON conversations (participant_one, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_participant_two_idx
  ON conversations (participant_two, last_message_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_sender_created_idx
  ON messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS message_requests_recipient_idx
  ON message_requests (recipient_id, status);

-- A direct pair must be unique regardless of participant order. If an older
-- deployment already contains reversed duplicates we skip the index rather
-- than deleting anybody's history; start_conversation() also serialises
-- creation with an advisory lock.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS conversations_canonical_pair_idx
    ON conversations (
      least(participant_one, participant_two),
      greatest(participant_one, participant_two)
    )
    WHERE kind = 'direct';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Skipped canonical pair index: reversed duplicate conversations already exist';
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Per-user conversation settings (pin / mute / archive)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_settings (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, conversation_id)
);

-- ----------------------------------------------------------------------------
-- 3. Message reactions (one row per emoji per person per message)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji),
  CONSTRAINT message_reactions_emoji_length CHECK (char_length(emoji) BETWEEN 1 AND 16)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_idx
  ON message_reactions (message_id);

-- ----------------------------------------------------------------------------
-- 4. Helpers — blocking, consent, rate limiting, last-message timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_blocked_between(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM blocked_users
     WHERE (blocker_id = a AND blocked_id = b)
        OR (blocker_id = b AND blocked_id = a)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_with(other UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM blocked_users
     WHERE (blocker_id = auth.uid() AND blocked_id = other)
        OR (blocker_id = other AND blocked_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.conversation_has_suspended_participant(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM conversations c
      JOIN profiles p ON p.id IN (c.participant_one, c.participant_two)
     WHERE c.id = p_conversation_id
       AND auth.uid() IN (c.participant_one, c.participant_two)
       AND COALESCE(p.is_suspended, FALSE) = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.may_message(sender UUID, recipient UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  pref            TEXT;
  sender_uni      UUID;
  recipient_uni   UUID;
BEGIN
  IF sender IS NULL OR recipient IS NULL OR sender = recipient THEN
    RETURN FALSE;
  END IF;

  IF public.is_blocked_between(sender, recipient) THEN
    RETURN FALSE;
  END IF;

  -- A suspended account can neither send nor receive direct messages.
  IF EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.id IN (sender, recipient)
       AND COALESCE(p.is_suspended, FALSE) = TRUE
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(up.allow_direct_messages, 'requests_only')
    INTO pref
    FROM user_preferences up
   WHERE up.user_id = recipient;

  pref := COALESCE(pref, 'requests_only');

  IF pref = 'none' THEN
    RETURN FALSE;
  END IF;

  -- "Anyone" is the only choice that crosses the university boundary.
  IF pref = 'anyone' THEN
    RETURN TRUE;
  END IF;

  SELECT p.primary_university_id INTO sender_uni
    FROM profiles p WHERE p.id = sender;
  SELECT p.primary_university_id INTO recipient_uni
    FROM profiles p WHERE p.id = recipient;

  IF sender_uni IS NULL OR recipient_uni IS NULL OR sender_uni <> recipient_uni THEN
    RETURN FALSE;
  END IF;

  -- 'verified_students' (UI: University Students Only) and 'requests_only'
  -- both allow a same-university student; the latter still needs consent.
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.message_request_required(sender UUID, recipient UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  pref TEXT;
BEGIN
  IF NOT public.may_message(sender, recipient) THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(up.allow_direct_messages, 'requests_only')
    INTO pref
    FROM user_preferences up
   WHERE up.user_id = recipient;

  RETURN COALESCE(pref, 'requests_only') = 'requests_only';
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target := OLD.conversation_id;
  ELSE
    target := NEW.conversation_id;
  END IF;

  UPDATE conversations
     SET last_message_at = COALESCE(
           (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = target),
           NOW()
         )
   WHERE id = target;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_touch_conversation ON messages;
CREATE TRIGGER messages_touch_conversation
  AFTER INSERT OR UPDATE OR DELETE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_conversation_last_message();

-- A simple database-level ceiling. The app is the primary rate limiter; this
-- guard keeps a compromised client from flooding a conversation.
CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT COUNT(*)
      FROM messages
     WHERE sender_id = NEW.sender_id
       AND created_at > NOW() - INTERVAL '1 minute'
  ) >= 60 THEN
    RAISE EXCEPTION 'Too many messages — please slow down';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_rate_limit ON messages;
CREATE TRIGGER messages_rate_limit
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_message_rate_limit();

-- ----------------------------------------------------------------------------
-- 5. Consent-based start / accept / decline
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_conversation(UUID, TEXT, JSONB, TEXT);
CREATE FUNCTION public.start_conversation(
  p_other_id UUID,
  p_initial_note TEXT,
  p_context JSONB DEFAULT NULL,
  p_kind TEXT DEFAULT 'direct'
)
RETURNS TABLE (conversation_id UUID, status TEXT, request_state TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me           UUID := auth.uid();
  v_kind       TEXT := COALESCE(NULLIF(p_kind, ''), 'direct');
  v_note       TEXT := NULLIF(btrim(COALESCE(p_initial_note, '')), '');
  v_uni        UUID;
  other_uni    UUID;
  v_status     TEXT;
  v_requires   BOOLEAN;
  v_id         UUID;
  v_existing   conversations%ROWTYPE;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF p_other_id IS NULL OR p_other_id = me THEN
    RAISE EXCEPTION 'Choose another student';
  END IF;
  IF v_kind NOT IN ('direct', 'room', 'marketplace') THEN
    RAISE EXCEPTION 'Unsupported conversation type';
  END IF;
  IF v_note IS NULL THEN
    v_note := 'Hi!';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'Opening message is too long';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = p_other_id) THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  IF NOT public.may_message(me, p_other_id) THEN
    RAISE EXCEPTION 'This student is not accepting messages from you';
  END IF;

  SELECT p.primary_university_id INTO v_uni FROM profiles p WHERE p.id = me;
  SELECT p.primary_university_id INTO other_uni FROM profiles p WHERE p.id = p_other_id;
  IF other_uni IS NULL THEN
    RAISE EXCEPTION 'That student has not set a university yet';
  END IF;
  v_uni := COALESCE(v_uni, other_uni);

  -- Serialise creation for this pair so a double tap cannot create two rows.
  PERFORM pg_advisory_xact_lock(
    hashtext(least(me, p_other_id)::text || ':' || greatest(me, p_other_id)::text)
  );

  -- One conversation per pair, regardless of which item it started from.
  -- The 001 UNIQUE(participant_one, participant_two) constraint enforces this,
  -- so look up the pair without filtering by kind.
  SELECT * INTO v_existing
    FROM conversations c
   WHERE (
       (c.participant_one = me AND c.participant_two = p_other_id)
       OR (c.participant_one = p_other_id AND c.participant_two = me)
     )
   LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'active' THEN
      IF p_context IS NOT NULL THEN
        UPDATE conversations SET context = p_context, kind = v_kind
         WHERE id = v_existing.id;
      END IF;

      -- Sending the opening note into an existing chat is useful (marketplace
      -- "Message seller", profile "Message"), but a double tap must not create
      -- an identical duplicate.
      IF NOT EXISTS (
        SELECT 1 FROM messages m
         WHERE m.conversation_id = v_existing.id
           AND m.sender_id = me
           AND m.body = v_note
           AND m.created_at > NOW() - INTERVAL '5 minutes'
      ) THEN
        INSERT INTO messages (conversation_id, sender_id, body)
        VALUES (v_existing.id, me, v_note);
      END IF;

      RETURN QUERY SELECT v_existing.id, v_existing.status, 'none'::TEXT;
      RETURN;
    END IF;

    IF v_existing.status = 'archived' THEN
      UPDATE conversations
         SET status = 'active',
             last_message_at = NOW(),
             context = COALESCE(p_context, context),
             kind = CASE WHEN p_context IS NOT NULL THEN v_kind ELSE kind END
       WHERE id = v_existing.id;
      INSERT INTO messages (conversation_id, sender_id, body)
      VALUES (v_existing.id, me, v_note);
      RETURN QUERY SELECT v_existing.id, 'active'::TEXT, 'none'::TEXT;
      RETURN;
    END IF;

    IF v_existing.status = 'request_pending' THEN
      IF p_context IS NOT NULL THEN
        UPDATE conversations SET context = p_context, kind = v_kind
         WHERE id = v_existing.id;
      END IF;
      RETURN QUERY SELECT
        v_existing.id,
        v_existing.status,
        CASE WHEN v_existing.requested_by = me THEN 'sent' ELSE 'incoming' END;
      RETURN;
    END IF;

    -- Declined earlier: allow a fresh, explicit request. The old history and
    -- the old request row stay for the record.
    UPDATE conversations
       SET status = 'request_pending',
           requested_by = me,
           kind = v_kind,
           context = COALESCE(p_context, context),
           last_message_at = NOW()
     WHERE id = v_existing.id;

    INSERT INTO messages (conversation_id, sender_id, body)
    VALUES (v_existing.id, me, v_note);

    INSERT INTO message_requests
      (conversation_id, sender_id, recipient_id, context_type, initial_note, status)
    VALUES (v_existing.id, me, p_other_id, v_kind, v_note, 'pending');

    RETURN QUERY SELECT v_existing.id, 'request_pending'::TEXT, 'sent'::TEXT;
    RETURN;
  END IF;

  v_requires := public.message_request_required(me, p_other_id);
  v_status := CASE WHEN v_requires THEN 'request_pending' ELSE 'active' END;

  INSERT INTO conversations
    (university_id, participant_one, participant_two, status, kind, requested_by, last_message_at, context)
  VALUES
    (v_uni, least(me, p_other_id), greatest(me, p_other_id), v_status, v_kind, me, NOW(), p_context)
  RETURNING id INTO v_id;

  INSERT INTO messages (conversation_id, sender_id, body)
  VALUES (v_id, me, v_note);

  INSERT INTO message_requests
    (conversation_id, sender_id, recipient_id, context_type, initial_note, status)
  VALUES
    (v_id, me, p_other_id, v_kind, v_note, CASE WHEN v_requires THEN 'pending' ELSE 'accepted' END);

  RETURN QUERY SELECT
    v_id,
    v_status,
    CASE WHEN v_requires THEN 'sent' ELSE 'none' END;
END;
$$;

DROP FUNCTION IF EXISTS public.respond_to_message_request(UUID, BOOLEAN);
CREATE FUNCTION public.respond_to_message_request(
  p_conversation_id UUID,
  p_accept BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me          UUID := auth.uid();
  v_status    TEXT;
  v_requested UUID;
  v_result    TEXT;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT c.status, c.requested_by
    INTO v_status, v_requested
    FROM conversations c
   WHERE c.id = p_conversation_id
     AND me IN (c.participant_one, c.participant_two)
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  IF v_status <> 'request_pending' THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;
  IF v_requested = me THEN
    RAISE EXCEPTION 'You cannot respond to your own request';
  END IF;

  v_result := CASE WHEN p_accept THEN 'active' ELSE 'declined' END;

  UPDATE conversations SET status = v_result WHERE id = p_conversation_id;

  UPDATE message_requests
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END
   WHERE conversation_id = p_conversation_id
     AND recipient_id = me
     AND status = 'pending';

  IF p_accept THEN
    UPDATE messages
       SET is_read = TRUE
     WHERE conversation_id = p_conversation_id
       AND sender_id <> me
       AND COALESCE(is_read, FALSE) = FALSE;
  END IF;

  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Read receipts, reactions, blocking
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.mark_conversation_read(UUID);
CREATE FUNCTION public.mark_conversation_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM conversations c
     WHERE c.id = p_conversation_id
       AND me IN (c.participant_one, c.participant_two)
  ) THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  UPDATE messages
     SET is_read = TRUE
   WHERE conversation_id = p_conversation_id
     AND sender_id <> me
     AND COALESCE(is_read, FALSE) = FALSE;
END;
$$;

DROP FUNCTION IF EXISTS public.toggle_message_reaction(UUID, TEXT);
CREATE FUNCTION public.toggle_message_reaction(
  p_message_id UUID,
  p_emoji TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me       UUID := auth.uid();
  v_conv   UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF p_emoji IS NULL OR char_length(p_emoji) NOT BETWEEN 1 AND 16 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;

  SELECT m.conversation_id INTO v_conv FROM messages m WHERE m.id = p_message_id;
  IF v_conv IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM conversations c
     WHERE c.id = v_conv
       AND me IN (c.participant_one, c.participant_two)
  ) THEN
    RAISE EXCEPTION 'Not your conversation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM message_reactions r
     WHERE r.message_id = p_message_id AND r.user_id = me AND r.emoji = p_emoji
  ) THEN
    DELETE FROM message_reactions r
     WHERE r.message_id = p_message_id AND r.user_id = me AND r.emoji = p_emoji;
    RETURN FALSE;
  END IF;

  INSERT INTO message_reactions (message_id, user_id, emoji)
  VALUES (p_message_id, me, p_emoji);
  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.block_user(UUID);
CREATE FUNCTION public.block_user(p_blocked_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF p_blocked_id IS NULL OR p_blocked_id = me THEN
    RAISE EXCEPTION 'Invalid account';
  END IF;

  INSERT INTO blocked_users (blocker_id, blocked_id)
  VALUES (me, p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS public.unblock_user(UUID);
CREATE FUNCTION public.unblock_user(p_blocked_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  DELETE FROM blocked_users
   WHERE blocker_id = me AND blocked_id = p_blocked_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Inbox query — one round trip, no N+1, only the signed-in student's rows
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_inbox();
CREATE FUNCTION public.get_inbox()
RETURNS TABLE (
  conversation_id UUID,
  status TEXT,
  request_state TEXT,
  kind TEXT,
  context JSONB,
  created_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  other_id UUID,
  other_username TEXT,
  other_display_name TEXT,
  other_avatar_url TEXT,
  other_is_verified BOOLEAN,
  last_message_id UUID,
  last_message_sender UUID,
  last_message_body TEXT,
  last_message_photo TEXT,
  last_message_created_at TIMESTAMPTZ,
  unread_count BIGINT,
  pinned BOOLEAN,
  muted BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH mine AS (
    SELECT
      c.*,
      CASE
        WHEN c.participant_one = auth.uid() THEN c.participant_two
        ELSE c.participant_one
      END AS other_id
    FROM conversations c
    WHERE auth.uid() IN (c.participant_one, c.participant_two)
  )
  SELECT
    m.id,
    m.status,
    CASE
      WHEN m.status = 'request_pending' AND m.requested_by = auth.uid() THEN 'sent'
      WHEN m.status = 'request_pending' THEN 'incoming'
      WHEN m.status = 'declined' THEN 'declined'
      ELSE 'none'
    END AS request_state,
    COALESCE(m.kind, 'direct'),
    m.context,
    m.created_at,
    COALESCE(m.last_message_at, m.created_at),
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(p.is_verified_student, FALSE),
    lm.id,
    lm.sender_id,
    lm.body,
    lm.photo_url,
    lm.created_at,
    COALESCE(u.cnt, 0),
    COALESCE(s.pinned, FALSE),
    COALESCE(s.muted, FALSE)
  FROM mine m
  JOIN profiles p ON p.id = m.other_id
  LEFT JOIN LATERAL (
    SELECT msg.id, msg.sender_id, msg.body, msg.photo_url, msg.created_at
      FROM messages msg
     WHERE msg.conversation_id = m.id
     ORDER BY msg.created_at DESC
     LIMIT 1
  ) lm ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::BIGINT AS cnt
      FROM messages msg
     WHERE msg.conversation_id = m.id
       AND msg.sender_id <> auth.uid()
       AND COALESCE(msg.is_read, FALSE) = FALSE
  ) u ON TRUE
  LEFT JOIN conversation_settings s
    ON s.conversation_id = m.id
   AND s.user_id = auth.uid()
  WHERE COALESCE(s.archived, FALSE) = FALSE
    AND NOT public.is_blocked_between(m.participant_one, m.participant_two)
    AND NOT public.conversation_has_suspended_participant(m.id)
  ORDER BY COALESCE(m.last_message_at, m.created_at) DESC;
$$;

-- ----------------------------------------------------------------------------
-- 8. RLS — replace the partial Phase 1 policies
-- ----------------------------------------------------------------------------
ALTER TABLE message_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Conversations keep the 002 SELECT policy (participants only). Creation and
-- status changes go through the RPCs above, so no INSERT/UPDATE policy exists.
DROP POLICY IF EXISTS "Participants can read messages" ON messages;
CREATE POLICY "Participants can read messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
       WHERE c.id = conversation_id
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Send message only in active conversations and when not blocked" ON messages;
DROP POLICY IF EXISTS "Participants can send messages in active conversations" ON messages;
CREATE POLICY "Participants can send messages in active conversations"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
       WHERE c.id = conversation_id
         AND c.status = 'active'
         AND auth.uid() IN (c.participant_one, c.participant_two)
         AND NOT public.is_blocked_with(
           CASE
             WHEN c.participant_one = auth.uid() THEN c.participant_two
             ELSE c.participant_one
           END
         )
         AND NOT public.conversation_has_suspended_participant(c.id)
    )
  );

-- Read receipts are written by mark_conversation_read(); no client UPDATE.

DROP POLICY IF EXISTS "Participants can read message requests" ON message_requests;
CREATE POLICY "Participants can read message requests"
  ON message_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can read their own blocks" ON blocked_users;
CREATE POLICY "Users can read their own blocks"
  ON blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can block others" ON blocked_users;
CREATE POLICY "Users can block others"
  ON blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id AND blocked_id <> auth.uid());

DROP POLICY IF EXISTS "Users can unblock others" ON blocked_users;
CREATE POLICY "Users can unblock others"
  ON blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users manage their own conversation settings" ON conversation_settings;
CREATE POLICY "Users manage their own conversation settings"
  ON conversation_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM conversations c
       WHERE c.id = conversation_id
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Participants can read message reactions" ON message_reactions;
CREATE POLICY "Participants can read message reactions"
  ON message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = message_id
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Participants can add their own reactions" ON message_reactions;
CREATE POLICY "Participants can add their own reactions"
  ON message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = message_id
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Users can remove their own reactions" ON message_reactions;
CREATE POLICY "Users can remove their own reactions"
  ON message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 9. Private message-photo storage
-- Path: <conversation_id>/<user_id>/<file>
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-photos',
  'message-photos',
  FALSE,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Conversation participants can read message photos" ON storage.objects;
CREATE POLICY "Conversation participants can read message photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'message-photos'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id::text = (storage.foldername(name))[1]
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Participants can upload message photos" ON storage.objects;
CREATE POLICY "Participants can upload message photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'message-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id::text = (storage.foldername(name))[1]
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

DROP POLICY IF EXISTS "Participants can delete their own message photos" ON storage.objects;
CREATE POLICY "Participants can delete their own message photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'message-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id::text = (storage.foldername(name))[1]
         AND auth.uid() IN (c.participant_one, c.participant_two)
    )
  );

-- ----------------------------------------------------------------------------
-- 10. Realtime — new messages and consent/status changes
-- RLS still decides which rows each subscriber can see. If the publication is
-- unavailable (self-hosted without Realtime) the migration continues.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. Function grants — authenticated students only
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_blocked_between(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_blocked_with(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.conversation_has_suspended_participant(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.may_message(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.message_request_required(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_conversation(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_message_request(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_message_reaction(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unblock_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_inbox() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_blocked_with(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_has_suspended_participant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation(UUID, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_message_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inbox() TO authenticated;
