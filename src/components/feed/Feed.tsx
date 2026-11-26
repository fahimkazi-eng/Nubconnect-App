'use client';

// Feed tabs (For You / Following / Campus / My Circles) with pagination,
// skeletons, retry and duplicate-free loading. Following is chronological.
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { useApp } from '@/lib/store';
import { filterFeed, type FeedTab } from '@/lib/feed';
import PostCard from './PostCard';
import { PostSkeleton, Tabs } from '@/components/ui/kit';

const PAGE_SIZE = 4;

export default function Feed() {
  const { posts, hiddenPostIds, mutedAccountIds, follows, joinedCircles, user } = useApp();
  const [tab, setTab] = useState<FeedTab>('for-you');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Simulated async page loads → real .range() queries on the backend.
  useEffect(() => {
    setPage(1);
  }, [tab]);

  const visible = useMemo(() => {
    const ctx = {
      myDepartmentCode: user.departmentCode,
      followingAuthorIds: follows,
      joinedCircleSlugs: joinedCircles,
    };
    return filterFeed(posts, tab, ctx).filter(
      (p) => !hiddenPostIds.includes(p.id) && !mutedAccountIds.includes(p.authorId),
    );
  }, [posts, tab, follows, joinedCircles, hiddenPostIds, mutedAccountIds, user.departmentCode]);

  const shown = visible.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length > shown.length;

  const loadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setPage((p) => p + 1);
      setLoadingMore(false);
    }, 400);
  };

  return (
    <section aria-label="Social feed">
      <div className="mb-3">
        <Tabs
          tabs={[
            { key: 'for-you', label: 'For You' },
            { key: 'following', label: 'Following' },
            { key: 'campus', label: 'Campus' },
            { key: 'my-circles', label: 'My Circles' },
          ]}
          active={tab}
          onChange={(k) => setTab(k as FeedTab)}
        />
      </div>

      <div className="space-y-3">
        {shown.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}

        {loadingMore && (
          <>
            <PostSkeleton />
          </>
        )}

        {hasMore ? (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="touch-target mx-auto flex items-center gap-2 rounded-full bg-campus-card px-5 py-2.5 text-sm font-bold ring-1 ring-campus-border transition hover:bg-violet-soft disabled:opacity-50 dark:bg-campus-dark-card dark:ring-campus-dark-border dark:hover:bg-violet-dark-soft"
          >
            <ArrowDown size={16} className={loadingMore ? 'animate-bounce' : ''} />
            {loadingMore ? 'Loading…' : `Show more (${visible.length - shown.length} left)`}
          </button>
        ) : (
          shown.length > 0 && (
            <p className="pb-2 pt-1 text-center text-xs text-campus-text-sec dark:text-campus-dark-sec">
              You&apos;re all caught up — that&apos;s the whole {tab.replace('-', ' ')} feed.
            </p>
          )
        )}

        {shown.length === 0 && (
          <div className="card p-8 text-center">
            <p className="font-display font-bold">Nothing here yet</p>
            <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
              {tab === 'following'
                ? 'Follow people from Find Your Circle and their posts appear here.'
                : tab === 'my-circles'
                  ? 'Join circles to see their community posts here.'
                  : 'New posts will appear here.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
