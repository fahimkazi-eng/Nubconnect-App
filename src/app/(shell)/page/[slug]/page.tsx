'use client';

// Page profile — the official NUB Connect Page, a club page or a department
// page. A Page is an organisational identity: it publishes on its own behalf
// and its posts are attributed to it, never to a student profile.
import { use, useEffect, useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import { BadgeCheck, Users } from 'lucide-react';
import { useApp } from '@/lib/store';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { followPage, loadPageBySlug, unfollowPage } from '@/lib/pages';
import { Avatar, VerifiedBadge } from '@/components/ui/kit';
import PostCard from '@/components/feed/PostCard';
import { timeAgo } from '@/lib/format';

export default function PageProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { posts, user, authLoading } = useApp();
  const [page, setPage] = useState<Awaited<ReturnType<typeof loadPageBySlug>>>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [notFoundYet, setNotFoundYet] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      const found = await loadPageBySlug(supabase, slug);
      if (!active) return;
      setPage(found);
      setLoading(false);
      if (!found) setNotFoundYet(true);
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const pagePosts = useMemo(
    () => (page ? posts.filter((p) => p.publisher?.id === page.id) : []),
    [posts, page],
  );

  if (notFoundYet) notFound();

  if (loading || authLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="card overflow-hidden p-0">
          <div className="h-28 animate-pulse bg-campus-bg sm:h-36 dark:bg-campus-dark-card" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-48 animate-pulse rounded bg-campus-bg dark:bg-campus-dark-card" />
            <div className="h-3 w-64 animate-pulse rounded bg-campus-bg dark:bg-campus-dark-card" />
          </div>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display font-bold">This page is not available</p>
        <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
          The page may have been retired, or it may not have been published yet.
        </p>
      </div>
    );
  }

  const toggleFollow = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const next = !following;
    setFollowing(next);
    const result = next
      ? await followPage(supabase, { pageId: page.id, userId: user.id })
      : await unfollowPage(supabase, { pageId: page.id, userId: user.id });
    if (!result.ok) setFollowing(!next);
  };

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden p-0">
        <div className="relative h-28 sm:h-36">
          {page.coverUrl ? (
            <img src={page.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-violet/25 via-coral/15 to-mint/25" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        </div>
        <div className="px-4 pb-4">
          <div className="-mt-9 flex items-end justify-between gap-2">
            <span className="rounded-full ring-4 ring-white dark:ring-campus-dark-card">
              <Avatar seed={page.id} name={page.name} size={76} src={page.avatarUrl ?? null} />
            </span>
            <button
              onClick={toggleFollow}
              disabled={!user}
              aria-pressed={following}
              className="touch-target flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2 text-xs font-bold text-plum shadow-violet-glow transition disabled:opacity-40"
            >
              {following ? 'Following' : 'Follow'}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-display text-lg font-extrabold sm:text-xl">{page.name}</h1>
            {page.verificationStatus === 'officially_verified' ? (
              <VerifiedBadge label="Verified page" />
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border">
                <BadgeCheck size={11} /> {page.verificationStatus.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
            <Users size={12} />
            {page.kind} page
          </p>
          {page.description && (
            <p className="mt-2 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              {page.description}
            </p>
          )}
        </div>
      </div>

      <section aria-label={`${page.name} posts`} className="space-y-3">
        {pagePosts.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-display font-bold">No posts yet</p>
            <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
              When {page.name} publishes, its posts appear here.
            </p>
          </div>
        ) : (
          pagePosts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </section>

      {pagePosts.length > 0 && (
        <p className="pb-2 pt-1 text-center text-xs text-campus-text-sec dark:text-campus-dark-sec">
          Last post {timeAgo(pagePosts[0]!.createdAt)}.
        </p>
      )}
    </div>
  );
}
