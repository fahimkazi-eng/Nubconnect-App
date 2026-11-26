// ============================================================================
// NUBCONNECT — Real social feed (Supabase)
//
// The Home feed is backed by the `posts` table: real rows, real photographs,
// real reactions and real comments. Every query here runs through the
// anon-key client, so the RLS policies in migration 010 decide what a student
// may read and write.
//
// Nothing here fabricates content. A post type is offered only when the
// existing posts/post_media columns and the authorized storage API can persist
// it; everything else is reported as unavailable with a concrete reason.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteUploadedMedia, uploadMedia, type MediaUpload } from './storage/client';
import type { Comment, Post, PostPublisher, ReactionType } from './types';

/** A student, as far as the feed needs to know them. */
export interface FeedAuthor {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified_student: boolean;
  semester_label: string | null;
  department_id: string | null;
  department: { code: string | null; name: string | null } | null;
}

/** A post row with the author, photographs and comments the feed renders. */
export interface PostQueryRow {
  id: string;
  university_id: string;
  author_id: string;
  department_id: string | null;
  organization_id: string | null;
  content_origin: string;
  category: string;
  title: string | null;
  body: string;
  visibility: string;
  is_pinned: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  source_url?: string | null;
  author: FeedAuthor | null;
  media: { media_url: string; media_type: string }[] | null;
  comments:
    | {
        id: string;
        body: string;
        author_id: string;
        created_at: string;
        author: { username: string; display_name: string; avatar_url: string | null } | null;
      }[]
    | null;
  organization: { slug: string; name: string } | null;
  page: {
    id: string;
    slug: string;
    name: string;
    kind: string;
    verification_status: string;
    avatar_url: string | null;
    cover_url: string | null;
  } | null;
}

/** The author badge a post earns from where it came from. */
export function originBadgeFor(contentOrigin: string): Post['originBadge'] {
  switch (contentOrigin) {
    case 'official_university':
    case 'department_published':
      return 'Official University Info';
    case 'verified_club':
    case 'recognized_organization':
      return 'Club Activity';
    default:
      return 'Student Community Post';
  }
}

/** The audience a post was published to. */
export function audienceFor(visibility: string): Post['audience'] {
  switch (visibility) {
    case 'department':
      return 'My Department';
    case 'organization':
      return 'My Circles';
    default:
      return 'University';
  }
}

/* --------------------------------------------------------------------------
 * Post types. The catalog is the single source of truth for the composer and
 * for tests: a type is "available" only when posts/post_media can hold it.
 * Unsupported types are kept visible so the UI can say exactly why they are
 * off instead of pretending to publish them.
 * ------------------------------------------------------------------------ */

export type FeedPostTypeKey =
  | 'text'
  | 'photo'
  | 'multiple_photo'
  | 'question'
  | 'achievement'
  | 'event_share'
  | 'poll'
  | 'activity_invitation'
  | 'mention'
  | 'repost'
  | 'threaded_reply';

export type FeedPostAudience = 'university' | 'department' | 'organization';

export interface FeedPostTypeDefinition {
  readonly key: FeedPostTypeKey;
  readonly label: string;
  readonly description: string;
  readonly available: boolean;
  /** Shown verbatim on the disabled affordance; never a generic "soon". */
  readonly unavailableReason?: string;
  /** Value written to posts.category when available. */
  readonly category?: string;
  readonly requiresTitle?: boolean;
  readonly maxPhotos: number;
  readonly supportsSourceUrl?: boolean;
}

const unavailable = (reason: string): Pick<FeedPostTypeDefinition, 'available' | 'unavailableReason'> => ({
  available: false,
  unavailableReason: `Requires backend support — ${reason}`,
});

export const FEED_POST_TYPES: readonly FeedPostTypeDefinition[] = Object.freeze([
  {
    key: 'text',
    label: 'Text',
    description: 'An update, thought or campus tip.',
    available: true,
    category: 'discussion',
    maxPhotos: 0,
  },
  {
    key: 'photo',
    label: 'Photo',
    description: 'One photograph with a caption.',
    available: true,
    category: 'photo',
    maxPhotos: 1,
  },
  {
    key: 'multiple_photo',
    label: 'Photos',
    description: 'A small gallery, with a caption.',
    available: true,
    category: 'photo',
    maxPhotos: 6,
  },
  {
    key: 'question',
    label: 'Question',
    description: 'Ask the campus something specific.',
    available: true,
    category: 'question',
    requiresTitle: true,
    maxPhotos: 1,
  },
  {
    key: 'achievement',
    label: 'Achievement',
    description: 'Recognise a real result or milestone.',
    available: true,
    category: 'achievement',
    requiresTitle: true,
    maxPhotos: 1,
  },
  {
    key: 'event_share',
    label: 'Event share',
    description: 'Share an event details post, optionally with its source link.',
    available: true,
    category: 'event_share',
    requiresTitle: true,
    maxPhotos: 1,
    supportsSourceUrl: true,
  },
  {
    key: 'poll',
    label: 'Poll',
    description: 'Options and voting.',
    maxPhotos: 0,
    ...unavailable('posts has no poll option/vote columns or RPC, so choices and votes could not be persisted.'),
  },
  {
    key: 'activity_invitation',
    label: 'Activity invite',
    description: 'A post linked to a real Campus Pulse activity.',
    maxPhotos: 0,
    ...unavailable(
      'posts has no activity_id and no RPC links a post to a real activity; an invitation here would not be joinable. Organise activities in Campus Pulse.',
    ),
  },
  {
    key: 'mention',
    label: 'Mentions',
    description: 'Tag students in a post.',
    maxPhotos: 0,
    ...unavailable('posts has no mention records or mention-notification RPC, so tagged students would never be notified.'),
  },
  {
    key: 'repost',
    label: 'Repost',
    description: 'Reshare somebody else’s post.',
    maxPhotos: 0,
    ...unavailable('posts has no repost-origin column or RPC, so a repost would not reference the original post.'),
  },
  {
    key: 'threaded_reply',
    label: 'Threaded reply',
    description: 'Nested replies under a comment.',
    maxPhotos: 0,
    ...unavailable(
      'comments.parent_comment_id exists, but there is no RPC or feed renderer for nested replies.',
    ),
  },
]);

export function postTypeByKey(key: string | null | undefined): FeedPostTypeDefinition | undefined {
  return FEED_POST_TYPES.find((type) => type.key === key);
}

export function isFeedPostTypeAvailable(key: string | null | undefined): boolean {
  return postTypeByKey(key)?.available === true;
}

/** The disabled types, with the reason each one cannot be published today. */
export function unavailableFeedPostTypes(): FeedPostTypeDefinition[] {
  return FEED_POST_TYPES.filter((type) => !type.available);
}

const MAX_TITLE_LENGTH = 140;
const MAX_BODY_LENGTH = 4000;

export interface FeedPostDraft {
  readonly type: FeedPostTypeKey;
  readonly authorId: string;
  readonly universityId: string;
  readonly departmentId?: string | null;
  readonly organizationId?: string | null;
  readonly audience: FeedPostAudience;
  readonly body: string;
  readonly title?: string;
  readonly sourceUrl?: string;
  readonly media?: readonly File[];
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate before any upload or database write. Every post needs a caption:
 * the posts INSERT policy (migration 010/011) requires `body <> ''`, so a
 * photo-only post would be rejected by RLS rather than silently saved.
 */
export function validateFeedPostDraft(draft: FeedPostDraft): string | null {
  const type = postTypeByKey(draft.type);
  if (!type) return 'That post type is not supported.';
  if (!type.available) return type.unavailableReason ?? 'Requires backend support.';
  if (!draft.authorId || !draft.universityId) return 'Sign in with a university-linked account first.';
  if (!draft.body.trim()) return 'Add a caption — every post needs text.';
  if (draft.body.trim().length > MAX_BODY_LENGTH) return `Keep posts under ${MAX_BODY_LENGTH} characters.`;
  if (type.requiresTitle && !draft.title?.trim()) {
    return `Add a title for a ${type.label.toLowerCase()} post.`;
  }
  if ((draft.title?.trim().length ?? 0) > MAX_TITLE_LENGTH) {
    return `Keep the title under ${MAX_TITLE_LENGTH} characters.`;
  }
  if (draft.audience === 'department' && !draft.departmentId) {
    return 'Your account has no department linked yet — choose University instead.';
  }
  if (draft.audience === 'organization' && !draft.organizationId) {
    return 'Requires backend support — choose a real circle before posting to one.';
  }
  if ((draft.media?.length ?? 0) > type.maxPhotos) {
    return `You can attach up to ${type.maxPhotos} photo${type.maxPhotos === 1 ? '' : 's'} to this post.`;
  }
  if (draft.sourceUrl && draft.sourceUrl.trim() && !isSafeHttpUrl(draft.sourceUrl)) {
    return 'Use a full http(s) link for the source.';
  }
  return null;
}

/** The category label shown on a post card. */
export function categoryFor(category: string): string {
  switch (category) {
    case 'discussion':
      return 'Student Discussion';
    case 'photo':
      return 'Campus Photo';
    case 'question':
      return 'Question';
    case 'achievement':
      return 'Achievement shared';
    case 'event_share':
      return 'Event sharing';
    case 'announcement':
      return 'Announcement';
    default:
      return category || 'Student Discussion';
  }
}

/**
 * Map a post row (plus the reaction counts the feed resolved separately)
 * into the Post the UI renders.
 */
export function mapPostRow(
  row: PostQueryRow,
  context: {
    viewerId?: string | null;
    reactionCounts?: Record<string, number>;
    myReaction?: ReactionType | null;
    savedPostIds?: string[];
  } = {},
): Post {
  const author = row.author;
  const departmentCode = author?.department?.code ?? undefined;
  const semester = author?.semester_label ?? 'Semester not set';
  const isVerified = Boolean(author?.is_verified_student);

  const comments: Comment[] = (row.comments ?? [])
    .map((c) => ({
      id: c.id,
      author: c.author?.display_name ?? 'Student',
      authorRole: 'Student',
      text: c.body,
      createdAt: c.created_at,
      isMine: context.viewerId ? c.author_id === context.viewerId : false,
      reactions: {},
      myReaction: null,
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const reactions = context.reactionCounts ?? {};

  const publisher: PostPublisher | null = row.page
    ? {
        id: row.page.id,
        slug: row.page.slug,
        name: row.page.name,
        kind: (row.page.kind as PostPublisher['kind']) ?? 'community',
        verificationStatus: row.page.verification_status,
        avatarUrl: row.page.avatar_url,
        coverUrl: row.page.cover_url,
      }
    : null;

  return {
    id: row.id,
    authorId: row.author_id,
    authorName: publisher ? publisher.name : (author?.display_name ?? 'Student'),
    authorRole: publisher
      ? publisher.kind === 'platform'
        ? 'Official page'
        : `${publisher.kind} page`
      : `${isVerified ? 'Verified Student' : 'Student'}${departmentCode ? ` • ${departmentCode} ${semester}` : ''}`,
    originBadge: originBadgeFor(row.content_origin),
    departmentCode,
    circleSlug: row.organization?.slug ?? undefined,
    scope: audienceFor(row.visibility),
    category: categoryFor(row.category),
    title: row.title ?? undefined,
    createdAt: row.created_at,
    body: row.body,
    media: (row.media ?? []).map((m) => m.media_url),
    audience: audienceFor(row.visibility),
    reactions: reactions as Partial<Record<ReactionType, number>>,
    myReaction: context.myReaction ?? null,
    saved: context.savedPostIds?.includes(row.id) ?? false,
    comments,
    publisher,
    isDemo: false,
    sourceUrl: row.source_url ?? undefined,
  };
}

const POST_SELECT = `id, university_id, author_id, department_id, organization_id, content_origin, category, title, body, visibility, is_pinned, is_hidden, created_at, updated_at, source_url,
  author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, is_verified_student, semester_label, department_id, department:departments!profiles_department_id_fkey(code, name)),
  media:post_media!post_media_post_id_fkey(media_url, media_type),
  organization:organizations!posts_organization_id_fkey(slug, name),
  page:pages!posts_page_id_fkey(id, slug, name, kind, verification_status, avatar_url, cover_url),
  comments:comments!comments_post_id_fkey(id, body, author_id, created_at, author:profiles!comments_author_id_fkey(username, display_name, avatar_url))`;

async function mapPosts(
  client: SupabaseClient,
  data: unknown[],
  viewerId?: string | null,
): Promise<Post[]> {
  if (data.length === 0) return [];
  const rows = data as PostQueryRow[];
  const ids = rows.map((r) => r.id);
  const [counts, mine, saved] = await Promise.all([
    loadReactionCounts(client, ids),
    loadMyReactions(client, ids, viewerId),
    loadSavedPostIds(client, viewerId),
  ]);
  return rows.map((row) =>
    mapPostRow(row, {
      viewerId,
      reactionCounts: counts[row.id],
      myReaction: mine[row.id] ?? null,
      savedPostIds: saved,
    }),
  );
}

/** Load the specific posts a student has saved, in newest-first order. */
export async function loadPostsByIds(
  client: SupabaseClient,
  ids: readonly string[],
  viewerId?: string | null,
): Promise<Post[]> {
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from('posts')
    .select(POST_SELECT)
    .in('id', [...ids])
    .order('created_at', { ascending: false })
    .limit(Math.min(ids.length, 50));
  if (error || !data) return [];
  return mapPosts(client, data, viewerId);
}

/** Load one page of the real feed. Returns [] when the backend is empty. */
export async function loadFeedPosts(
  client: SupabaseClient,
  options: {
    viewerId?: string | null;
    departmentId?: string | null;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Post[]> {
  const limit = Math.min(options.limit ?? 20, 50);
  const offset = Math.max(options.offset ?? 0, 0);

  let request = client.from('posts').select(POST_SELECT);
  if (options.departmentId) request = request.eq('department_id', options.departmentId);
  const { data, error } = await request
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data || data.length === 0) return [];
  return mapPosts(client, data, options.viewerId);
}

/** Reaction counts per post. The database counts them so no one can read
 *  who reacted to what. */
async function loadReactionCounts(
  client: SupabaseClient,
  postIds: string[],
): Promise<Record<string, Record<string, number>>> {
  if (postIds.length === 0) return {};
  const { data, error } = await client.rpc('get_post_reaction_counts', {
    p_posts: postIds,
  });
  if (error || !data) return {};

  const out: Record<string, Record<string, number>> = {};
  for (const row of data as { post_id: string; reaction_type: string; reaction_count: number }[]) {
    out[row.post_id] = out[row.post_id] ?? {};
    out[row.post_id]![row.reaction_type] = Number(row.reaction_count ?? 0);
  }
  return out;
}

/** The signed-in student's own reaction on each post. */
async function loadMyReactions(
  client: SupabaseClient,
  postIds: string[],
  viewerId?: string | null,
): Promise<Record<string, ReactionType>> {
  if (!viewerId || postIds.length === 0) return {};
  const { data, error } = await client
    .from('reactions')
    .select('post_id, reaction_type')
    .in('post_id', postIds)
    .eq('user_id', viewerId);
  if (error || !data) return {};

  const out: Record<string, ReactionType> = {};
  for (const row of data as { post_id: string; reaction_type: string }[]) {
    out[row.post_id] = row.reaction_type as ReactionType;
  }
  return out;
}

/** The posts the signed-in student has saved. */
async function loadSavedPostIds(
  client: SupabaseClient,
  viewerId?: string | null,
): Promise<string[]> {
  if (!viewerId) return [];
  const { data, error } = await client
    .from('saved_items')
    .select('item_id')
    .eq('user_id', viewerId)
    .eq('item_type', 'post');
  if (error || !data) return [];
  return (data as { item_id: string }[]).map((r) => r.item_id);
}

/** Upload a post photograph through the server-authorized storage route. */
export async function uploadPostPhoto(
  client: SupabaseClient,
  input: { file: File },
): Promise<{ url?: string; error?: string }> {
  const result = await uploadMedia(client, { kind: 'post', file: input.file });
  if (!result.ok) return { error: result.error };
  return { url: result.data.url };
}

export interface PublishPostInput {
  authorId: string;
  universityId: string;
  departmentId?: string | null;
  organizationId?: string | null;
  body: string;
  visibility?: FeedPostAudience;
  mediaUrls?: string[];
  /** Only values the current posts columns can hold. */
  category?: string;
  title?: string | null;
  sourceUrl?: string | null;
}

/** Publish a post and attach its photographs. */
export async function publishPost(
  client: SupabaseClient,
  input: PublishPostInput,
): Promise<{ post?: PostQueryRow; error?: string }> {
  const body = input.body.trim();
  if (!body && !(input.mediaUrls?.length ?? 0)) {
    return { error: 'Write something or add a photograph first.' };
  }

  const { data, error } = await client
    .from('posts')
    .insert({
      university_id: input.universityId,
      author_id: input.authorId,
      department_id: input.departmentId ?? null,
      organization_id: input.organizationId ?? null,
      content_origin: 'student_created',
      category: input.category?.trim() || 'discussion',
      title: input.title?.trim() || null,
      source_url: input.sourceUrl?.trim() || null,
      body,
      visibility: input.visibility ?? 'university',
    })
    .select(
      `id, university_id, author_id, department_id, organization_id, content_origin, category, title, body, visibility, is_pinned, is_hidden, created_at, updated_at, source_url,
       author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, is_verified_student, semester_label, department_id, department:departments!profiles_department_id_fkey(code, name)),
       media:post_media!post_media_post_id_fkey(media_url, media_type),
       organization:organizations!posts_organization_id_fkey(slug, name),
       page:pages!posts_page_id_fkey(id, slug, name, kind, verification_status, avatar_url, cover_url),
       comments:comments!comments_post_id_fkey(id, body, author_id, created_at)`,
    )
    .single();

  if (error || !data) return { error: error?.message ?? 'Could not publish that post.' };

  const mediaUrls = input.mediaUrls ?? [];
  if (mediaUrls.length > 0) {
    const { error: mediaError } = await client.from('post_media').insert(
      mediaUrls.map((mediaUrl) => ({ post_id: data.id, media_url: mediaUrl, media_type: 'image' })),
    );
    if (mediaError) {
      // Never leave a caption-only row that claims to be a photo post.
      await client.from('posts').delete().eq('id', data.id);
      return { error: mediaError.message };
    }
  }

  return { post: data as unknown as PostQueryRow };
}

/**
 * Publish a typed post end to end: validate, upload every photograph through
 * the server-authorized storage route, then persist the post and its media.
 * Uploaded objects are removed if any step fails, so nothing orphaned or
 * half-published is left behind.
 */
export async function publishFeedPost(
  client: SupabaseClient,
  draft: FeedPostDraft,
): Promise<{ post?: PostQueryRow; error?: string }> {
  const validationError = validateFeedPostDraft(draft);
  if (validationError) return { error: validationError };

  const type = postTypeByKey(draft.type)!;
  const uploads: MediaUpload[] = [];
  const removeUploads = async () => {
    await deleteUploadedMedia(
      'post',
      uploads.map((upload) => upload.key),
    );
  };

  try {
    for (const file of draft.media ?? []) {
      const uploaded = await uploadMedia(client, { kind: 'post', file });
      if (!uploaded.ok) {
        await removeUploads();
        return { error: uploaded.error };
      }
      uploads.push(uploaded.data);
    }

    const published = await publishPost(client, {
      authorId: draft.authorId,
      universityId: draft.universityId,
      departmentId: draft.departmentId ?? null,
      organizationId: draft.organizationId ?? null,
      body: draft.body,
      title: draft.title,
      sourceUrl: draft.sourceUrl,
      category: type.category,
      visibility: draft.audience,
      mediaUrls: uploads.map((upload) => upload.url),
    });

    if (published.error || !published.post) {
      await removeUploads();
      return { error: published.error ?? 'Could not publish that post.' };
    }
    return { post: published.post };
  } catch {
    await removeUploads();
    return { error: 'Could not publish that post. Check your connection and try again.' };
  }
}

/** Set or clear the signed-in student's reaction on a post. */
export async function setPostReaction(
  client: SupabaseClient,
  input: { postId: string; userId: string; reaction: ReactionType },
): Promise<{ ok: boolean; error?: string }> {
  const { data: existing } = await client
    .from('reactions')
    .select('id, reaction_type')
    .eq('post_id', input.postId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (existing) {
    if (existing.reaction_type === input.reaction) {
      const { error } = await client.from('reactions').delete().eq('id', existing.id);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    const { error } = await client
      .from('reactions')
      .update({ reaction_type: input.reaction })
      .eq('id', existing.id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { error } = await client.from('reactions').insert({
    post_id: input.postId,
    user_id: input.userId,
    reaction_type: input.reaction,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Set or clear the signed-in student's reaction on a comment. */
export async function setCommentReaction(
  client: SupabaseClient,
  input: { commentId: string; userId: string; reaction: ReactionType },
): Promise<{ ok: boolean; error?: string }> {
  const { data: existing } = await client
    .from('comment_reactions')
    .select('id, reaction_type')
    .eq('comment_id', input.commentId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (existing) {
    if (existing.reaction_type === input.reaction) {
      const { error } = await client.from('comment_reactions').delete().eq('id', existing.id);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    const { error } = await client
      .from('comment_reactions')
      .update({ reaction_type: input.reaction })
      .eq('id', existing.id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { error } = await client.from('comment_reactions').insert({
    comment_id: input.commentId,
    user_id: input.userId,
    reaction_type: input.reaction,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Edit the signed-in student's own comment (RLS restricts writes to the author). */
export async function editCommentBody(
  client: SupabaseClient,
  input: { commentId: string; body: string },
): Promise<{ ok: boolean; error?: string }> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Comment cannot be empty' };
  const { error } = await client
    .from('comments')
    .update({ body })
    .eq('id', input.commentId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Comment on a post. */
export async function publishComment(
  client: SupabaseClient,
  input: { postId: string; authorId: string; body: string },
): Promise<{ comment?: Comment; error?: string }> {
  const body = input.body.trim();
  if (!body) return { error: 'Write something first.' };

  const { data, error } = await client
    .from('comments')
    .insert({ post_id: input.postId, author_id: input.authorId, body })
    .select('id, body, author_id, created_at')
    .single();

  if (error || !data) return { error: error?.message ?? 'Could not post that comment.' };

  const row = data as { id: string; body: string; author_id: string; created_at: string };
  return {
    comment: {
      id: row.id,
      author: 'You',
      authorRole: 'You',
      text: row.body,
      createdAt: row.created_at,
      isMine: true,
      reactions: {},
      myReaction: null,
    },
  };
}

/** Delete one of the signed-in student's own comments. */
export async function removeComment(
  client: SupabaseClient,
  input: { commentId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from('comments').delete().eq('id', input.commentId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Follow or unfollow a student. */
export async function setFollow(
  client: SupabaseClient,
  input: { followerId: string; targetId: string; following: boolean },
): Promise<{ ok: boolean; error?: string }> {
  if (input.following) {
    const { error } = await client
      .from('follows')
      .insert({ follower_id: input.followerId, target_type: 'profile', target_id: input.targetId });
    // A repeated follow is not an error — the student already follows them.
    if (error && !/duplicate key/i.test(error.message)) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await client
    .from('follows')
    .delete()
    .eq('follower_id', input.followerId)
    .eq('target_type', 'profile')
    .eq('target_id', input.targetId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** The students the signed-in student follows — the "Following" feed. */
export async function loadFollowedProfileIds(
  client: SupabaseClient,
  viewerId?: string | null,
): Promise<string[]> {
  if (!viewerId) return [];
  const { data, error } = await client
    .from('follows')
    .select('target_id')
    .eq('follower_id', viewerId)
    .eq('target_type', 'profile');
  if (error || !data) return [];
  return (data as { target_id: string }[]).map((r) => r.target_id);
}
