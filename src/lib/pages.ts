// ============================================================================
// NUBCONNECT — Pages (official and organisational identities)
//
// A Page is an identity that publishes on its own behalf: the official NUB
// Connect Page, a club Page, a department Page. It is what keeps an official
// announcement from looking like it came out of a random student profile.
//
// Pages carry their own membership, their own permissions and their own
// followers. Everything here runs through the anon-key client, so the RLS
// policies in migration 011 decide who may read, publish and manage.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostPublisher } from './types';

export interface PageRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  verification_status: string;
  is_active: boolean;
  owner_id: string | null;
  member_count?: number;
  follower_count?: number;
}

/** Map a page row to the identity the feed and profile surfaces render. */
export function mapPageRow(row: PageRow): PostPublisher & { description: string | null; isActive: boolean } {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: (row.kind as PostPublisher['kind']) ?? 'community',
    verificationStatus: row.verification_status,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    description: row.description,
    isActive: row.is_active,
  };
}

/** Load every active Page. */
export async function loadPages(
  client: SupabaseClient | null,
): Promise<Array<ReturnType<typeof mapPageRow>>> {
  if (!client) return [];
  const { data, error } = await client
    .from('pages')
    .select('id, slug, name, kind, description, avatar_url, cover_url, verification_status, is_active, owner_id')
    .eq('is_active', true)
    .order('name');
  if (error || !data) return [];
  return (data as unknown as PageRow[]).map(mapPageRow);
}

/** Load one Page by its slug. */
export async function loadPageBySlug(
  client: SupabaseClient | null,
  slug: string,
): Promise<ReturnType<typeof mapPageRow> | null> {
  if (!client) return null;
  const { data, error } = await client
    .from('pages')
    .select('id, slug, name, kind, description, avatar_url, cover_url, verification_status, is_active, owner_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  return mapPageRow(data as unknown as PageRow);
}

/** Whether the signed-in student may publish for a Page. */
export async function canManagePage(
  client: SupabaseClient | null,
  pageId: string,
): Promise<boolean> {
  if (!client) return false;
  const { data, error } = await client.rpc('can_manage_page', { target_page: pageId });
  if (error || !data) return false;
  return Boolean(data);
}

export interface PublishPagePostInput {
  authorId: string;
  universityId: string;
  pageId: string;
  title?: string;
  body: string;
  category?: string;
  visibility?: 'university' | 'department' | 'organization';
  mediaUrls?: string[];
  /** Source provenance, for content that is imported rather than written. */
  sourceUrl?: string;
  sourceOrganization?: string;
  originalPublishedAt?: string;
  imageSource?: string;
  contentRights?: string;
}

/**
 * Publish a post on behalf of a Page.
 *
 * The database decides whether this is allowed: the post's INSERT policy
 * checks that the author manages the Page and that the content origin
 * matches what that kind of Page may publish.
 */
export async function publishPagePost(
  client: SupabaseClient,
  input: PublishPagePostInput,
): Promise<{ id?: string; error?: string }> {
  const body = input.body.trim();
  if (!body) return { error: 'Write something first.' };

  const { data, error } = await client
    .from('posts')
    .insert({
      university_id: input.universityId,
      author_id: input.authorId,
      page_id: input.pageId,
      content_origin: 'official_university',
      category: input.category ?? 'announcement',
      title: input.title ?? null,
      body,
      visibility: input.visibility ?? 'university',
      source_url: input.sourceUrl ?? null,
      source_organization: input.sourceOrganization ?? null,
      original_published_at: input.originalPublishedAt ?? null,
      image_source: input.imageSource ?? null,
      content_rights: input.contentRights ?? null,
      publication_status: 'published',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) return { error: error?.message ?? 'Could not publish that post.' };

  const mediaUrls = input.mediaUrls ?? [];
  if (mediaUrls.length > 0) {
    const { error: mediaError } = await client.from('post_media').insert(
      mediaUrls.map((mediaUrl) => ({ post_id: data.id, media_url: mediaUrl, media_type: 'image' })),
    );
    if (mediaError) return { error: mediaError.message };
  }

  return { id: data.id };
}

/** Follow a Page. */
export async function followPage(
  client: SupabaseClient,
  input: { pageId: string; userId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from('page_follows').insert({
    page_id: input.pageId,
    user_id: input.userId,
  });
  if (error && !/duplicate key/i.test(error.message)) return { ok: false, error: error.message };
  return { ok: true };
}

/** Unfollow a Page. */
export async function unfollowPage(
  client: SupabaseClient,
  input: { pageId: string; userId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client
    .from('page_follows')
    .delete()
    .eq('page_id', input.pageId)
    .eq('user_id', input.userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
