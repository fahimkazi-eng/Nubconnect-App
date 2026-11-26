// ============================================================================
// NUBCONNECT — feed.ts unit tests
// Feed tabs (For You / Following / Campus / My Circles), ranking, pagination
// without duplicates, and reaction totals.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { filterFeed, paginate, totalReactions } from '@/lib/feed';
import { categoryFor, isFeedPostTypeAvailable } from '@/lib/posts';
import type { Post } from '@/lib/types';

let n = 0;
function post(partial: Partial<Post> & Pick<Post, 'id'>): Post {
  n += 1;
  return {
    authorId: `p-${n}`,
    authorName: `Author ${n}`,
    authorRole: 'Registered User',
    originBadge: 'Student Community Post',
    scope: 'University',
    category: 'General',
    createdAt: new Date(2026, 10, 1, 12, 0, 0).toISOString(),
    body: 'Demo post body.',
    media: [],
    audience: 'University',
    reactions: {},
    saved: false,
    comments: [],
    isDemo: true,
    ...partial,
  };
}

const BASE = {
  myDepartmentCode: 'CSE',
  followingAuthorIds: ['p-rakib'],
  joinedCircleSlugs: ['photography'],
};

describe("filterFeed — 'following'", () => {
  it('shows only followed authors, newest first', () => {
    const older = post({ id: 'f1', authorId: 'p-rakib', createdAt: '2026-11-01T09:00:00Z' });
    const newer = post({ id: 'f2', authorId: 'p-rakib', createdAt: '2026-11-02T09:00:00Z' });
    const stranger = post({ id: 'f3', authorId: 'p-stranger', createdAt: '2026-11-03T09:00:00Z' });
    const out = filterFeed([older, stranger, newer], 'following', BASE);
    expect(out.map((p) => p.id)).toEqual(['f2', 'f1']);
  });
});

describe("filterFeed — 'campus'", () => {
  it('includes official, club and highlight content plus other departments', () => {
    const posts = [
      post({ id: 'c1', originBadge: 'Official University Info' }),
      post({ id: 'c2', originBadge: 'Club Activity' }),
      post({ id: 'c3', originBadge: 'Campus Highlight' }),
      post({ id: 'c4', departmentCode: 'BBA' }),
    ];
    const out = filterFeed(posts, 'campus', BASE);
    expect(out.map((p) => p.id).sort()).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('excludes same-department student chatter', () => {
    const posts = [
      post({ id: 'c5', departmentCode: 'CSE' }),
      post({ id: 'c6', departmentCode: 'BBA' }),
    ];
    const out = filterFeed(posts, 'campus', BASE);
    expect(out.map((p) => p.id)).toEqual(['c6']);
  });
});

describe("filterFeed — 'my-circles'", () => {
  it('shows only posts shared inside joined circles', () => {
    const posts = [
      post({ id: 'm1', circleSlug: 'photography' }),
      post({ id: 'm2', circleSlug: 'football' }),
      post({ id: 'm3' }),
    ];
    const out = filterFeed(posts, 'my-circles', BASE);
    expect(out.map((p) => p.id)).toEqual(['m1']);
  });
});

describe("filterFeed — 'for-you'", () => {
  it('ranks followed authors above same-department strangers even when older', () => {
    const followedOld = post({
      id: 'y1',
      authorId: 'p-rakib',
      departmentCode: 'EEE',
      createdAt: '2026-11-01T09:00:00Z',
    });
    const strangerNew = post({
      id: 'y2',
      authorId: 'p-stranger',
      departmentCode: 'CSE',
      createdAt: '2026-11-05T09:00:00Z',
    });
    const out = filterFeed([strangerNew, followedOld], 'for-you', BASE);
    expect(out[0]!.id).toBe('y1');
  });

  it('ranks joined-circle posts above unrelated department posts', () => {
    const circlePost = post({ id: 'y3', circleSlug: 'photography', departmentCode: 'EEE' });
    const deptPost = post({ id: 'y4', departmentCode: 'CSE' });
    const out = filterFeed([deptPost, circlePost], 'for-you', BASE);
    expect(out.map((p) => p.id)).toEqual(['y3', 'y4']);
  });
});

describe('paginate', () => {
  it('returns nothing for zero or negative pages', () => {
    expect(paginate([1, 2, 3], 0, 2)).toEqual([]);
    expect(paginate([1, 2, 3], -1, 2)).toEqual([]);
  });

  it('grows cumulatively without duplicates as the page increases', () => {
    const items = [1, 2, 3, 4, 5];
    const page1 = paginate(items, 1, 2);
    const page2 = paginate(items, 2, 2);
    const page3 = paginate(items, 3, 2);
    expect(page1).toEqual([1, 2]);
    expect(page2).toEqual([1, 2, 3, 4]);
    expect(page3).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(page2).size).toBe(page2.length);
  });
});

describe('totalReactions', () => {
  it('sums every reaction type', () => {
    const p = post({ id: 'r1', reactions: { love: 12, fire: 3, inspired: 1 } });
    expect(totalReactions(p)).toBe(16);
  });

  it('is zero when nobody reacted', () => {
    expect(totalReactions(post({ id: 'r2' }))).toBe(0);
  });
});

describe('typed posts in the feed', () => {
  it('displays the categories real post creation can persist', () => {
    expect(categoryFor('discussion')).toBe('Student Discussion');
    expect(categoryFor('photo')).toBe('Campus Photo');
    expect(categoryFor('question')).toBe('Question');
    expect(categoryFor('achievement')).toBe('Achievement shared');
    expect(categoryFor('event_share')).toBe('Event sharing');
  });

  it('does not fabricate content for unsupported post types or an empty feed', () => {
    expect(isFeedPostTypeAvailable('poll')).toBe(false);
    expect(isFeedPostTypeAvailable('activity_invitation')).toBe(false);
    expect(filterFeed([], 'for-you', BASE)).toEqual([]);
    expect(filterFeed([], 'campus', BASE)).toEqual([]);
  });
});
