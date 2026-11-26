// ============================================================================
// NUBCONNECT — messaging.ts unit tests (Phase 3)
// Row mapping, consent-state mapping and honest error copy. These guard the
// boundary between Supabase rows and the conversation/message UI.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  conversationKind,
  friendlyMessagingError,
  isUuid,
  mapInboxRow,
  mapMessageRow,
  requestState,
  type InboxRow,
  type MessageRow,
} from '@/lib/messaging';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const INBOX: InboxRow = {
  conversation_id: '33333333-3333-4333-8333-333333333333',
  status: 'request_pending',
  request_state: 'incoming',
  kind: 'marketplace',
  context: {
    href: '/marketplace/mk-1',
    thumb: 'https://example.test/photo.jpg',
    title: 'Calculus textbook',
    price: '৳450',
    status: 'Available',
  },
  created_at: '2026-11-01T10:00:00.000Z',
  last_message_at: '2026-11-02T10:00:00.000Z',
  other_id: OTHER,
  other_username: 'farhana.pharm',
  other_display_name: 'Farhana Akter',
  other_avatar_url: 'https://example.test/farhana.jpg',
  other_is_verified: true,
  last_message_id: '44444444-4444-4444-8444-444444444444',
  last_message_sender: OTHER,
  last_message_body: 'Is the book still available?',
  last_message_photo: null,
  last_message_created_at: '2026-11-02T10:00:00.000Z',
  unread_count: '3',
  pinned: true,
  muted: null,
};

const MESSAGE: MessageRow = {
  id: '55555555-5555-4555-8555-555555555555',
  conversation_id: INBOX.conversation_id,
  sender_id: OTHER,
  body: 'See you at the library.',
  is_read: false,
  created_at: '2026-11-02T11:00:00.000Z',
  photo_url: 'conversation/user/photo.jpg',
  reply_to_id: null,
};

describe('id helpers', () => {
  it('recognises real Supabase ids and rejects demo ids', () => {
    expect(isUuid(ME)).toBe(true);
    expect(isUuid('p-arif')).toBe(false);
    expect(isUuid('cv-plan-plan-4')).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe('conversation mapping', () => {
  it('maps the other student, unread count, settings and context', () => {
    const conversation = mapInboxRow(INBOX, ME);
    expect(conversation.id).toBe(INBOX.conversation_id);
    expect(conversation.kind).toBe('marketplace');
    expect(conversation.title).toBe('Farhana Akter');
    expect(conversation.participants).toEqual([OTHER]);
    expect(conversation.unread).toBe(3);
    expect(conversation.pinned).toBe(true);
    expect(conversation.muted).toBe(false);
    expect(conversation.request).toBe('incoming');
    expect(conversation.messages).toEqual([]);
    expect(conversation.messagesLoaded).toBe(false);
    expect(conversation.lastMessage?.text).toBe('Is the book still available?');
    expect(conversation.other?.username).toBe('farhana.pharm');
    expect(conversation.other?.isVerified).toBe(true);
    expect(conversation.context?.href).toBe('/marketplace/mk-1');
    expect(conversation.isDemo).toBe(false);
  });

  it('maps request states without inventing consent', () => {
    expect(requestState('incoming')).toBe('incoming');
    expect(requestState('sent')).toBe('sent');
    expect(requestState('declined')).toBe('declined');
    expect(requestState('none')).toBe('none');
    expect(requestState(null)).toBe('none');
  });

  it('keeps only supported conversation kinds', () => {
    expect(conversationKind('direct')).toBe('direct');
    expect(conversationKind('room')).toBe('room');
    expect(conversationKind('marketplace')).toBe('marketplace');
    expect(conversationKind('plan')).toBe('plan');
    expect(conversationKind('unexpected')).toBe('direct');
  });
});

describe('message mapping', () => {
  it('marks my messages as "me" and keeps the other sender id', () => {
    const mine = mapMessageRow({ ...MESSAGE, sender_id: ME }, ME);
    expect(mine.senderId).toBe('me');

    const theirs = mapMessageRow(MESSAGE, ME, ['❤️']);
    expect(theirs.senderId).toBe(OTHER);
    expect(theirs.reactions).toEqual(['❤️']);
    expect(theirs.photo).toBe('conversation/user/photo.jpg');
    expect(theirs.read).toBe(false);
  });
});

describe('honest error copy', () => {
  it('translates consent, blocking and rate-limit errors', () => {
    expect(friendlyMessagingError('This student is not accepting messages from you')).toContain(
      'not accepting messages',
    );
    expect(friendlyMessagingError('Too many messages — please slow down')).toContain('slow down');
    expect(friendlyMessagingError('You cannot respond to your own request')).toContain(
      'your own request',
    );
    expect(friendlyMessagingError('new row violates row-level security policy')).toContain(
      'permission',
    );
    expect(friendlyMessagingError('Bucket not found')).toContain('migration 007');
  });

  it('falls back to the server message rather than a generic lie', () => {
    expect(friendlyMessagingError('Something specific broke')).toBe('Something specific broke');
    expect(friendlyMessagingError(null)).toContain('Something went wrong');
  });
});
