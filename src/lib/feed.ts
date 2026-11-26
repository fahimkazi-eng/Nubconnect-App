// ============================================================================
// NUBCONNECT — Feed logic (pure, unit-tested)
// ============================================================================
import type { Post } from './types';

export type FeedTab = 'for-you' | 'following' | 'campus' | 'my-circles';

export interface FeedContext {
  myDepartmentCode?: string;
  followingAuthorIds: string[];
  joinedCircleSlugs: string[];
}

/** Following is strictly chronological (newest first). */
export function filterFeed(posts: Post[], tab: FeedTab, ctx: FeedContext): Post[] {
  switch (tab) {
    case 'following':
      return posts
        .filter((p) => ctx.followingAuthorIds.includes(p.authorId))
        .sort(byNewestFirst);
    case 'campus':
      // Official + club + highlight content across the university.
      return posts
        .filter(
          (p) =>
            p.originBadge === 'Official University Info' ||
            p.originBadge === 'Club Activity' ||
            p.originBadge === 'Campus Highlight' ||
            p.departmentCode !== ctx.myDepartmentCode,
        )
        .sort(byNewestFirst);
    case 'my-circles':
      return posts
        .filter((p) => p.circleSlug && ctx.joinedCircleSlugs.includes(p.circleSlug))
        .sort(byNewestFirst);
    case 'for-you':
    default:
      // Mix: department peers, followed authors, circles, then the rest.
      const score = (p: Post): number => {
        let s = 0;
        if (ctx.followingAuthorIds.includes(p.authorId)) s -= 4;
        if (p.circleSlug && ctx.joinedCircleSlugs.includes(p.circleSlug)) s -= 3;
        if (p.departmentCode === ctx.myDepartmentCode) s -= 2;
        if (p.originBadge === 'Campus Highlight') s -= 1;
        return s;
      };
      return [...posts].sort((a, b) => score(a) - score(b) || byNewestFirst(a, b));
  }
}

function byNewestFirst(a: Post, b: Post): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/** Paginate without duplicates. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  if (page < 1) return [];
  return items.slice(0, page * pageSize);
}

export function totalReactions(p: Post): number {
  return Object.values(p.reactions).reduce((a, b) => a + (b ?? 0), 0);
}
