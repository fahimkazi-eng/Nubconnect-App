-- ============================================================================
-- NUBCONNECT — Migration 017: message edit & delete (author-only)
--
-- Adds the schema the app's Edit/Delete actions need. Until this is applied,
-- the app shows Edit/Delete only inside the 15-minute window and the RPC call
-- fails honestly with "Messaging is not configured yet…" — nothing half-works.
--
-- Design:
--   • Soft delete only. Other participants see "This message was deleted"
--     instead of erasing history silently; receipts and counts stay coherent.
--   • Author-only writes. No client UPDATE/DELETE policy is opened; everything
--     goes through SECURITY DEFINER RPCs with checks.
--   • 15-minute window on both edit and delete, matching common messenger
--     behavior and keeping moderation simple.
-- ============================================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- edit_message — author-only, 15 minutes, not already deleted, body required
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edit_message(p_message_id uuid, p_body text)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg public.messages;
BEGIN
  SELECT * INTO msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF msg.id IS NULL THEN
    RAISE EXCEPTION 'message not found';
  END IF;
  IF msg.sender_id <> auth.uid() THEN
    RAISE EXCEPTION 'not your message';
  END IF;
  IF msg.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'message deleted';
  END IF;
  IF now() - msg.created_at > interval '15 minutes' THEN
    RAISE EXCEPTION 'message too old to edit';
  END IF;
  IF char_length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'message cannot be empty';
  END IF;

  UPDATE public.messages
     SET body = trim(p_body),
         edited_at = now()
   WHERE id = msg.id
  RETURNING * INTO msg;

  RETURN msg;
END;
$$;

-- ---------------------------------------------------------------------------
-- delete_message — author-only, 15 minutes; soft delete (deleted_at set)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_message(p_message_id uuid)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg public.messages;
BEGIN
  SELECT * INTO msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF msg.id IS NULL THEN
    RAISE EXCEPTION 'message not found';
  END IF;
  IF msg.sender_id <> auth.uid() THEN
    RAISE EXCEPTION 'not your message';
  END IF;
  IF msg.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'message already deleted';
  END IF;
  IF now() - msg.created_at > interval '15 minutes' THEN
    RAISE EXCEPTION 'message too old to edit';
  END IF;

  UPDATE public.messages
     SET deleted_at = now()
   WHERE id = msg.id
  RETURNING * INTO msg;

  RETURN msg;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_message(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_message(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Verification queries (run AFTER applying)
-- ---------------------------------------------------------------------------
-- 1. Columns exist:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'messages' AND column_name IN ('edited_at', 'deleted_at');
-- 2. RPCs are callable as a participant:
--    -- as user A: select public.edit_message('<msg-id>', 'fixed typo');  -- ok
--    -- as user B: select public.edit_message('<msg-id>', 'hacked');     -- ERROR not your message
-- 3. Window enforced:
--    -- any edit on a >15-minute-old message → ERROR message too old to edit
-- 4. History loads with the new columns; older deployments still fall back to
--    the 9-column select automatically (implemented in the client).
