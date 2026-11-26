// ============================================================================
// NUBCONNECT — posts.ts unit tests (Phase 5)
//
// The feed's mappers decide how a database row becomes something a student
// reads: which badge a post earns, who it was visible to, how reactions are
// counted and what a comment looks like. These tests hold that mapping still.
// ============================================================================
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FEED_POST_TYPES,
  audienceFor,
  categoryFor,
  isFeedPostTypeAvailable,
  mapPostRow,
  originBadgeFor,
  postTypeByKey,
  publishFeedPost,
  unavailableFeedPostTypes,
  validateFeedPostDraft,
  type FeedPostDraft,
  type PostQueryRow,
} from '@/lib/posts';
import { deleteUploadedMedia, uploadMedia } from '@/lib/storage/client';

vi.mock('@/lib/storage/client', () => ({
  uploadMedia: vi.fn(),
  deleteUploadedMedia: vi.fn(),
}));

const ROW: PostQueryRow = {
  id: 'post-1',
  university_id: 'uni-nub',
  author_id: 'user-1',
  department_id: 'dept-cse',
  organization_id: null,
  content_origin: 'student_created',
  category: 'discussion',
  title: null,
  body: 'Anyone joining the study group tonight?',
  visibility: 'university',
  is_pinned: false,
  is_hidden: false,
  created_at: '2026-11-14T10:00:00.000Z',
  updated_at: '2026-11-14T10:00:00.000Z',
  author: {
    id: 'user-1',
    username: 'rakib.cse',
    display_name: 'Rakib Islam',
    avatar_url: null,
    is_verified_student: true,
    semester_label: '7th Semester',
    department_id: 'dept-cse',
    department: { code: 'CSE', name: 'Computer Science & Engineering' },
  },
  media: [
    { media_url: 'https://cdn.test/a.jpg', media_type: 'image' },
    { media_url: 'https://cdn.test/b.jpg', media_type: 'image' },
  ],
  comments: [
    {
      id: 'c-2',
      body: 'Count me in.',
      author_id: 'user-2',
      created_at: '2026-11-14T10:05:00.000Z',
      author: { username: 'nusrat.bba', display_name: 'Nusrat Jahan', avatar_url: null },
    },
    {
      id: 'c-1',
      body: 'Yes!',
      author_id: 'user-1',
      created_at: '2026-11-14T10:02:00.000Z',
      author: { username: 'rakib.cse', display_name: 'Rakib Islam', avatar_url: null },
    },
  ],
  organization: null,
  page: null,
};

describe('post badges and audience', () => {
  it('earns the badge the origin deserves', () => {
    expect(originBadgeFor('student_created')).toBe('Student Community Post');
    expect(originBadgeFor('official_university')).toBe('Official University Info');
    expect(originBadgeFor('department_published')).toBe('Official University Info');
    expect(originBadgeFor('verified_club')).toBe('Club Activity');
    expect(originBadgeFor('recognized_organization')).toBe('Club Activity');
  });

  it('maps visibility to the audience it was posted to', () => {
    expect(audienceFor('university')).toBe('University');
    expect(audienceFor('department')).toBe('My Department');
    expect(audienceFor('organization')).toBe('My Circles');
    expect(audienceFor('anything else')).toBe('University');
  });

  it('labels categories in the student vocabulary', () => {
    expect(categoryFor('discussion')).toBe('Student Discussion');
    expect(categoryFor('question')).toBe('Question');
    expect(categoryFor('something custom')).toBe('something custom');
  });
});

describe('mapPostRow', () => {
  it('maps a post row into the post the feed renders', () => {
    const post = mapPostRow(ROW);

    expect(post.id).toBe('post-1');
    expect(post.authorName).toBe('Rakib Islam');
    expect(post.authorRole).toBe('Verified Student • CSE 7th Semester');
    expect(post.departmentCode).toBe('CSE');
    expect(post.originBadge).toBe('Student Community Post');
    expect(post.audience).toBe('University');
    expect(post.scope).toBe('University');
    expect(post.category).toBe('Student Discussion');
    expect(post.media).toEqual(['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg']);
    expect(post.isDemo).toBe(false);
    expect(post.saved).toBe(false);
  });

  it('keeps the reaction counts it was given', () => {
    const post = mapPostRow(ROW, { reactionCounts: { love: 3, fire: 1 }, myReaction: 'love' });
    expect(post.reactions).toEqual({ love: 3, fire: 1 });
    expect(post.myReaction).toBe('love');
  });

  it('orders comments oldest first and marks the viewer’s own', () => {
    const post = mapPostRow(ROW, { viewerId: 'user-1' });
    expect(post.comments.map((c) => c.id)).toEqual(['c-1', 'c-2']);
    expect(post.comments[0]?.isMine).toBe(true);
    expect(post.comments[1]?.isMine).toBe(false);
    expect(post.comments[1]?.author).toBe('Nusrat Jahan');
  });

  it('marks a post the viewer saved', () => {
    const post = mapPostRow(ROW, { savedPostIds: ['post-1', 'other'] });
    expect(post.saved).toBe(true);
  });

  it('falls back honestly when the author row is missing', () => {
    const post = mapPostRow({ ...ROW, author: null });
    expect(post.authorName).toBe('Student');
    expect(post.authorRole).toBe('Student');
    expect(post.departmentCode).toBeUndefined();
  });

  it('carries the community slug when a post belongs to one', () => {
    const post = mapPostRow({
      ...ROW,
      visibility: 'organization',
      organization: { slug: 'photography', name: 'Photography' },
    });
    expect(post.circleSlug).toBe('photography');
    expect(post.audience).toBe('My Circles');
  });

  it('attributes a Page post to the Page, not to a student', () => {
    const post = mapPostRow({
      ...ROW,
      page: {
        id: 'page-1',
        slug: 'nub-connect',
        name: 'NUB Connect',
        kind: 'platform',
        verification_status: 'officially_verified',
        avatar_url: null,
        cover_url: null,
      },
    });

    expect(post.publisher?.name).toBe('NUB Connect');
    expect(post.publisher?.kind).toBe('platform');
    expect(post.authorName).toBe('NUB Connect');
    expect(post.authorRole).toBe('Official page');
  });

  it('has no publisher for a student post', () => {
    expect(mapPostRow(ROW).publisher).toBeNull();
  });
});

/* --- Post types: available vs honestly unavailable ----------------------- */

const DRAFT: FeedPostDraft = {
  type: 'text',
  authorId: 'user-1',
  universityId: 'uni-nub',
  departmentId: 'dept-cse',
  audience: 'university',
  body: 'A real campus update.',
};

describe('feed post type availability', () => {
  it('offers only the types posts/post_media can actually persist', () => {
    expect(FEED_POST_TYPES.filter((type) => type.available).map((type) => type.key)).toEqual([
      'text',
      'photo',
      'multiple_photo',
      'question',
      'achievement',
      'event_share',
    ]);
    expect(isFeedPostTypeAvailable('text')).toBe(true);
    expect(isFeedPostTypeAvailable('photo')).toBe(true);
    expect(isFeedPostTypeAvailable('multiple_photo')).toBe(true);
    expect(isFeedPostTypeAvailable('question')).toBe(true);
    expect(isFeedPostTypeAvailable('achievement')).toBe(true);
    expect(isFeedPostTypeAvailable('event_share')).toBe(true);
  });

  it('gives every unsupported type a concrete backend reason', () => {
    const unavailable = unavailableFeedPostTypes();
    expect(unavailable.map((type) => type.key)).toEqual([
      'poll',
      'activity_invitation',
      'mention',
      'repost',
      'threaded_reply',
    ]);
    for (const type of unavailable) {
      expect(isFeedPostTypeAvailable(type.key)).toBe(false);
      expect(type.unavailableReason).toMatch(/^Requires backend support — /);
      expect(type.unavailableReason!.length).toBeGreaterThan(40);
      expect(type.category).toBeUndefined();
    }
  });

  it('names the missing support, not a generic coming-soon message', () => {
    expect(postTypeByKey('poll')?.unavailableReason).toContain('option/vote');
    expect(postTypeByKey('activity_invitation')?.unavailableReason).toContain('activity_id');
    expect(postTypeByKey('mention')?.unavailableReason).toContain('mention');
    expect(postTypeByKey('repost')?.unavailableReason).toContain('repost-origin');
    expect(postTypeByKey('threaded_reply')?.unavailableReason).toContain('parent_comment_id');
  });

  it('maps supported types to stored categories and honest card labels', () => {
    expect(postTypeByKey('text')?.category).toBe('discussion');
    expect(postTypeByKey('photo')?.category).toBe('photo');
    expect(postTypeByKey('multiple_photo')?.category).toBe('photo');
    expect(postTypeByKey('question')?.category).toBe('question');
    expect(postTypeByKey('achievement')?.category).toBe('achievement');
    expect(postTypeByKey('event_share')?.category).toBe('event_share');
    expect(categoryFor('photo')).toBe('Campus Photo');
    expect(categoryFor('question')).toBe('Question');
    expect(categoryFor('achievement')).toBe('Achievement shared');
    expect(categoryFor('event_share')).toBe('Event sharing');
  });
});

describe('validateFeedPostDraft', () => {
  it('requires a caption even for photo posts because RLS rejects empty bodies', () => {
    expect(validateFeedPostDraft({ ...DRAFT, type: 'photo', body: '   ' })).toContain('caption');
    expect(validateFeedPostDraft({ ...DRAFT, type: 'multiple_photo', body: '' })).toContain('caption');
  });

  it('requires a title for question, achievement and event shares', () => {
    expect(validateFeedPostDraft({ ...DRAFT, type: 'question', title: '' })).toContain('title');
    expect(validateFeedPostDraft({ ...DRAFT, type: 'achievement', title: '  ' })).toContain('title');
    expect(validateFeedPostDraft({ ...DRAFT, type: 'event_share', title: '' })).toContain('title');
  });

  it('enforces the photo limit for the chosen type', () => {
    const files = [1, 2].map(() => ({ name: 'a.jpg' }) as File);
    expect(validateFeedPostDraft({ ...DRAFT, type: 'photo', media: files })).toContain('up to 1 photo');
    expect(validateFeedPostDraft({ ...DRAFT, type: 'text', media: files })).toContain('up to 0 photos');
    expect(validateFeedPostDraft({ ...DRAFT, type: 'multiple_photo', media: files })).toBeNull();
  });

  it('requires a real circle link for an organization audience', () => {
    expect(validateFeedPostDraft({ ...DRAFT, audience: 'organization' })).toContain('Requires backend support');
    expect(validateFeedPostDraft({ ...DRAFT, audience: 'department', departmentId: null })).toContain(
      'no department',
    );
  });

  it('accepts only http(s) source links', () => {
    expect(validateFeedPostDraft({ ...DRAFT, type: 'event_share', title: 'Open day', sourceUrl: 'javascript:alert(1)' })).toContain('http(s)');
    expect(validateFeedPostDraft({ ...DRAFT, type: 'event_share', title: 'Open day', sourceUrl: 'https://nub.ac.bd/event' })).toBeNull();
  });

  it('refuses an unsupported type before any write', () => {
    expect(validateFeedPostDraft({ ...DRAFT, type: 'poll' })).toContain('Requires backend support');
  });
});

/* --- Mocked persistence through the existing tables/storage route -------- */

function mockClient(responses: { mediaError?: string; postError?: string } = {}) {
  const postInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () =>
        responses.postError
          ? { data: null, error: { message: responses.postError } }
          : { data: ROW, error: null },
      ),
    })),
  }));
  const postDelete = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));
  const mediaInsert = vi.fn(async () => ({
    error: responses.mediaError ? { message: responses.mediaError } : null,
  }));
  const client = {
    from: (table: string) => {
      if (table === 'posts') return { insert: postInsert, delete: postDelete };
      if (table === 'post_media') return { insert: mediaInsert };
      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
  return { client, postInsert, postDelete, mediaInsert };
}

const imageFile = (name: string) => ({ name, type: 'image/jpeg', size: 1024 }) as File;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(deleteUploadedMedia).mockResolvedValue(undefined);
  vi.mocked(uploadMedia).mockImplementation(async () => ({
    ok: true,
    data: {
      key: 'posts/user-1/2026/11/abc12345-a.jpg',
      storagePath: 'user-1/2026/11/abc12345-a.jpg',
      url: 'https://cdn.test/a.jpg',
      provider: 'supabase',
    },
  }));
});

describe('publishFeedPost', () => {
  it('persists a question title and category in posts and uploads its photo first', async () => {
    const { client, postInsert, mediaInsert } = mockClient();
    const result = await publishFeedPost(client, {
      ...DRAFT,
      type: 'question',
      title: 'Study group tonight?',
      media: [imageFile('a.jpg')],
    });

    expect(result.error).toBeUndefined();
    expect(result.post?.id).toBe('post-1');
    expect(uploadMedia).toHaveBeenCalledWith(client, { kind: 'post', file: expect.anything() });
    expect(postInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'question',
        title: 'Study group tonight?',
        body: DRAFT.body,
        content_origin: 'student_created',
        visibility: 'university',
      }),
    );
    expect(mediaInsert).toHaveBeenCalledWith([
      { post_id: 'post-1', media_url: 'https://cdn.test/a.jpg', media_type: 'image' },
    ]);
  });

  it('attaches every photo of a multiple-photo post in order', async () => {
    vi.mocked(uploadMedia)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          key: 'posts/user-1/2026/11/abc12345-a.jpg',
          storagePath: 'user-1/2026/11/abc12345-a.jpg',
          url: 'https://cdn.test/a.jpg',
          provider: 'r2',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          key: 'posts/user-1/2026/11/abc12345-b.jpg',
          storagePath: 'user-1/2026/11/abc12345-b.jpg',
          url: 'https://cdn.test/b.jpg',
          provider: 'r2',
        },
      });
    const { client, postInsert, mediaInsert } = mockClient();
    const result = await publishFeedPost(client, {
      ...DRAFT,
      type: 'multiple_photo',
      media: [imageFile('a.jpg'), imageFile('b.jpg')],
    });

    expect(result.error).toBeUndefined();
    expect(postInsert).toHaveBeenCalledWith(expect.objectContaining({ category: 'photo' }));
    expect(mediaInsert).toHaveBeenCalledWith([
      { post_id: 'post-1', media_url: 'https://cdn.test/a.jpg', media_type: 'image' },
      { post_id: 'post-1', media_url: 'https://cdn.test/b.jpg', media_type: 'image' },
    ]);
    expect(uploadMedia).toHaveBeenCalledTimes(2);
  });

  it('stores the source link of an event share without claiming official origin', async () => {
    const { client, postInsert } = mockClient();
    await publishFeedPost(client, {
      ...DRAFT,
      type: 'event_share',
      title: 'Campus open day',
      sourceUrl: 'https://nub.ac.bd/event',
    });
    expect(postInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'event_share',
        source_url: 'https://nub.ac.bd/event',
        content_origin: 'student_created',
      }),
    );
  });

  it('rolls back the post and removes uploads when media attachment fails', async () => {
    const { client, postDelete } = mockClient({ mediaError: 'post_media denied' });
    const result = await publishFeedPost(client, {
      ...DRAFT,
      type: 'photo',
      media: [imageFile('a.jpg')],
    });
    expect(result.error).toBe('post_media denied');
    expect(postDelete).toHaveBeenCalled();
    expect(deleteUploadedMedia).toHaveBeenCalledWith('post', [
      'posts/user-1/2026/11/abc12345-a.jpg',
    ]);
  });

  it('removes uploads and reports the database error when the insert fails', async () => {
    const { client } = mockClient({ postError: 'RLS denied' });
    const result = await publishFeedPost(client, {
      ...DRAFT,
      type: 'photo',
      media: [imageFile('a.jpg')],
    });
    expect(result.error).toBe('RLS denied');
    expect(deleteUploadedMedia).toHaveBeenCalledWith('post', [
      'posts/user-1/2026/11/abc12345-a.jpg',
    ]);
  });

  it('never uploads or writes for an unsupported type', async () => {
    const { client, postInsert, mediaInsert } = mockClient();
    const result = await publishFeedPost(client, { ...DRAFT, type: 'activity_invitation' });
    expect(result.error).toContain('Requires backend support');
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(postInsert).not.toHaveBeenCalled();
    expect(mediaInsert).not.toHaveBeenCalled();
  });
});
