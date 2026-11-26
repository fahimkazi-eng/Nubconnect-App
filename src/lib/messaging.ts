// ============================================================================
// NUBCONNECT — Messaging data layer (Phase 3).
//
// Real 1:1 conversations live in Supabase (migration 007). This module owns
// the row → view-model mapping and the small set of queries the store needs:
// inbox, history, reactions, blocks and private photo upload/signing.
//
// Everything here is honest about failure: callers receive an error string
// instead of silently pretending a message was sent or a photo was stored.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Conversation, Message } from './types';

export interface InboxRow {
  conversation_id: string;
  status: string;
  request_state: string;
  kind: string;
  context: Conversation['context'] | null;
  created_at: string;
  last_message_at: string | null;
  other_id: string;
  other_username: string;
  other_display_name: string;
  other_avatar_url: string | null;
  other_is_verified: boolean | null;
  last_message_id: string | null;
  last_message_sender: string | null;
  last_message_body: string | null;
  last_message_photo: string | null;
  last_message_created_at: string | null;
  unread_count: number | string;
  pinned: boolean | null;
  muted: boolean | null;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_read: boolean | null;
  created_at: string;
  photo_url: string | null;
  reply_to_id: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
}

export interface MessageReactionRow {
  message_id: string;
  emoji: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AUDIO_EXTENSIONS = new Set(['webm', 'ogg', 'oga', 'mp3', 'mp4', 'm4a', 'wav', 'opus', 'aac', 'flac']);

/** True when a stored message-media path is an audio clip, not a photograph. */
export function isAudioPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const clean = path.split('?')[0] ?? path;
  const ext = clean.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTENSIONS.has(ext);
}

/** True for a real Supabase row id; false for demo ids like `p-arif`. */
export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function conversationKind(value: string | null | undefined): Conversation['kind'] {
  if (value === 'room' || value === 'marketplace' || value === 'group' || value === 'plan') {
    return value;
  }
  return 'direct';
}

export function requestState(value: string | null | undefined): Conversation['request'] {
  if (value === 'incoming' || value === 'sent' || value === 'declined') return value;
  return 'none';
}

/** Map one `get_inbox()` row into the conversation shape the UI renders. */
export function mapInboxRow(row: InboxRow, currentUserId: string): Conversation {
  const lastMessage: Message | undefined = row.last_message_id
    ? {
        id: row.last_message_id,
        senderId: row.last_message_sender === currentUserId ? 'me' : (row.last_message_sender ?? ''),
        text: row.last_message_body ?? '',
        createdAt: row.last_message_created_at ?? row.created_at,
        // Inbox previews are text-only; the chat view resolves signed URLs.
        read: true,
      }
    : undefined;

  return {
    id: row.conversation_id,
    kind: conversationKind(row.kind),
    title: row.other_display_name || row.other_username || 'NUB student',
    participants: [row.other_id],
    avatarSeeds: [row.other_id],
    unread: Number(row.unread_count ?? 0),
    pinned: Boolean(row.pinned),
    muted: Boolean(row.muted),
    request: requestState(row.request_state),
    messages: [],
    messagesLoaded: false,
    lastMessage,
    context: row.context ?? undefined,
    other: {
      id: row.other_id,
      username: row.other_username,
      name: row.other_display_name,
      avatarUrl: row.other_avatar_url,
      isVerified: Boolean(row.other_is_verified),
    },
    isDemo: false,
  };
}

/** Map a messages row; `me` is the signed-in student's profile id. */
export function mapMessageRow(
  row: MessageRow,
  currentUserId: string,
  myReactions: string[] = [],
): Message {
  return {
    id: row.id,
    senderId: row.sender_id === currentUserId ? 'me' : row.sender_id,
    text: row.body,
    createdAt: row.created_at,
    photo: row.photo_url ?? undefined,
    audio: isAudioPath(row.photo_url),
    replyToId: row.reply_to_id ?? undefined,
    reactions: myReactions,
    read: Boolean(row.is_read),
    editedAt: row.edited_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

export async function loadInbox(
  client: SupabaseClient,
  currentUserId: string,
): Promise<{ conversations: Conversation[]; error: string | null }> {
  const { data, error } = await client.rpc('get_inbox');
  if (error) {
    return { conversations: [], error: friendlyMessagingError(error.message) };
  }
  const rows = (data ?? []) as unknown as InboxRow[];
  return {
    conversations: rows.map((row) => mapInboxRow(row, currentUserId)),
    error: null,
  };
}

export async function loadMessages(
  client: SupabaseClient,
  conversationId: string,
  currentUserId: string,
): Promise<{ messages: Message[]; error: string | null }> {
  // Prefer the migration-017 columns when they exist; fall back to the base
  // columns so history still loads on deployments that haven't applied 017.
  const with017 = 'id, conversation_id, sender_id, body, is_read, created_at, photo_url, reply_to_id, edited_at, deleted_at';
  const withBase = 'id, conversation_id, sender_id, body, is_read, created_at, photo_url, reply_to_id';
  const primary = await client
    .from('messages')
    .select(with017)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(300);

  let data: unknown[] | null = primary.data;
  let error = primary.error;
  if (primary.error) {
    const fallback = await client
      .from('messages')
      .select(withBase)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(300);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return { messages: [], error: friendlyMessagingError(error.message) };
  }

  const rows = ((data ?? []) as unknown as MessageRow[]).slice().reverse();
  if (rows.length === 0) return { messages: [], error: null };

  const ids = rows.map((row) => row.id);
  const reactionRows: MessageReactionRow[] = [];
  // PostgREST URLs have a practical length limit, so fetch reactions in
  // batches instead of sending 300 UUIDs in one `in()` filter.
  for (let start = 0; start < ids.length; start += 100) {
    const chunk = ids.slice(start, start + 100);
    const { data: reactionData, error: reactionError } = await client
      .from('message_reactions')
      .select('message_id, emoji')
      .in('message_id', chunk)
      .eq('user_id', currentUserId);

    if (reactionError) {
      // History is still useful without my reaction chips; report nothing to
      // the user for this non-critical read, but keep the messages.
      return { messages: rows.map((row) => mapMessageRow(row, currentUserId)), error: null };
    }
    reactionRows.push(...((reactionData ?? []) as unknown as MessageReactionRow[]));
  }

  const reactionsByMessage = new Map<string, string[]>();
  for (const reaction of reactionRows) {
    const list = reactionsByMessage.get(reaction.message_id) ?? [];
    list.push(reaction.emoji);
    reactionsByMessage.set(reaction.message_id, list);
  }

  return {
    messages: rows.map((row) =>
      mapMessageRow(row, currentUserId, reactionsByMessage.get(row.id) ?? []),
    ),
    error: null,
  };
}

export async function loadBlockedIds(
  client: SupabaseClient,
  currentUserId: string,
): Promise<{ ids: string[]; error: string | null }> {
  const { data, error } = await client
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', currentUserId);

  if (error) {
    return { ids: [], error: friendlyMessagingError(error.message) };
  }
  return {
    ids: ((data ?? []) as { blocked_id: string }[]).map((row) => row.blocked_id),
    error: null,
  };
}

/** Private bucket path: <conversation_id>/<user_id>/<timestamp>.<ext>. */
export async function uploadMessagePhoto(
  client: SupabaseClient,
  conversationId: string,
  currentUserId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const extension = (file.name.split('.').pop() ?? 'jpg')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 5) || 'jpg';
  const unique =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${conversationId}/${currentUserId}/${unique}.${extension}`;

  const { error } = await client.storage
    .from('message-photos')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });

  if (error) {
    return { path: null, error: friendlyMessagingError(error.message) };
  }
  return { path, error: null };
}

/** Resolve a private message-photo path to a short-lived signed URL. */
export async function signedMessagePhoto(
  client: SupabaseClient,
  path: string,
): Promise<string | null> {
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  const { data, error } = await client.storage
    .from('message-photos')
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Turn Supabase/Postgres errors into calm, honest copy. */
/** The conversation ids the signed-in student archived (own rows only). */
export async function loadArchivedIds(
  client: SupabaseClient,
  currentUserId: string,
): Promise<{ ids: string[]; error: string | null }> {
  const { data, error } = await client
    .from('conversation_settings')
    .select('conversation_id')
    .eq('user_id', currentUserId)
    .eq('archived', true);
  if (error) return { ids: [], error: friendlyMessagingError(error.message) };
  return { ids: (data ?? []).map((row) => String((row as { conversation_id: string }).conversation_id)), error: null };
}

export function friendlyMessagingError(message?: string | null): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('too many messages')) return 'Too many messages — please slow down for a moment.';
  if (m.includes('not accepting messages')) return 'This student is not accepting messages from you.';
  if (m.includes('cannot respond to your own request')) return 'You cannot respond to your own request.';
  if (m.includes('no longer pending')) return 'This message request is no longer pending.';
  if (m.includes('choose another student')) return 'Choose another student to message.';
  if (m.includes('student not found')) return 'That student account could not be found.';
  if (m.includes('has not set a university')) {
    return 'That student has not set their university yet.';
  }
  if (m.includes('not signed in')) return 'Sign in to continue.';
  if (m.includes('conversation not found')) return 'That conversation is not available.';
  if (m.includes('not your conversation')) return 'You do not have access to that conversation.';
  if (m.includes('message not found')) return 'That message is no longer available.';
  if (m.includes('invalid reaction')) return 'That reaction is not supported.';
  if (m.includes('invalid account')) return 'That account cannot be blocked.';
  if (m.includes('opening message is too long')) {
    return 'Your opening message is too long (2,000 characters max).';
  }
  if (m.includes('unsupported conversation type')) {
    return 'That conversation type is not supported yet.';
  }
  if (m.includes('message too old to edit')) {
    return 'That message is outside the edit window.';
  }
  if (m.includes('not your message')) return 'You can only edit or delete your own messages.';
  if (m.includes('message already deleted')) return 'That message was already deleted.';
  if (m.includes('message deleted')) return 'That message was deleted.';
  if (m.includes('could not find the function') || m.includes('schema cache')) {
    return 'Messaging is not configured yet. Ask an administrator to apply migration 007.';
  }
  if (m.includes('duplicate key') || m.includes('already exists')) {
    return 'A conversation with this student already exists.';
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return 'You do not have permission to do that.';
  }
  if (m.includes('bucket not found')) {
    return 'Photo storage is not configured yet. Ask an administrator to apply migration 007.';
  }
  if (m.includes('payload too large') || m.includes('exceeded the maximum allowed size')) {
    return 'That photo is too large. Choose one under 8 MB.';
  }
  if (m.includes('mime type')) return 'That file type is not supported. Use JPG, PNG or WebP.';
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return message || 'Something went wrong. Please try again.';
}
