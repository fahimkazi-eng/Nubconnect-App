// ============================================================================
// NUBCONNECT — global search data layer unit tests
//
// The search layer must stay pure: sanitise user text before it reaches
// PostgREST, group real rows honestly, and never quietly turn a failed query
// into a result. A tiny mock query builder stands in for Supabase.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SEARCH_SURFACES,
  buildTextFilter,
  groupHits,
  sanitizeSearchQuery,
  searchCampus,
  type SearchHit,
} from '@/lib/search';

type Row = Record<string, unknown>;
interface TableConfig {
  rows?: Row[];
  error?: Error;
}
interface Call {
  table: string;
  method: string;
  args: unknown[];
}

class MockBuilder {
  private rowLimit: number | null = null;

  constructor(
    private readonly table: string,
    private readonly config: TableConfig,
    private readonly calls: Call[],
  ) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ table: this.table, method, args });
    return this;
  }

  select(...args: unknown[]): this {
    return this.record('select', args);
  }
  or(...args: unknown[]): this {
    return this.record('or', args);
  }
  eq(...args: unknown[]): this {
    return this.record('eq', args);
  }
  gte(...args: unknown[]): this {
    return this.record('gte', args);
  }
  neq(...args: unknown[]): this {
    return this.record('neq', args);
  }
  order(...args: unknown[]): this {
    return this.record('order', args);
  }
  limit(...args: unknown[]): this {
    this.rowLimit = typeof args[0] === 'number' ? args[0] : null;
    return this.record('limit', args);
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: { message: string } | null }) => TResult1) | null,
    onrejected?: ((reason: unknown) => TResult2) | null,
  ): Promise<TResult1 | TResult2> {
    this.record('await', []);
    const rows = this.config.rows ?? [];
    const response = this.config.error
      ? { data: null, error: { message: this.config.error.message } }
      : {
          data: this.rowLimit === null ? rows : rows.slice(0, this.rowLimit),
          error: null,
        };
    return Promise.resolve(response).then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

function mockClient(tables: Record<string, TableConfig | Row[]> = {}) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      calls.push({ table, method: 'from', args: [] });
      const config = tables[table] ?? {};
      return new MockBuilder(table, Array.isArray(config) ? { rows: config } : config, calls);
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const ROWS: Record<string, Row[]> = {
  pages: [{ owner_id: 'page-owner' }],
  profiles: [
    {
      id: 'u1',
      username: 'rakib.cse',
      display_name: 'Rakib Islam',
      avatar_url: null,
      is_verified_student: true,
      semester_label: '7th Semester',
      departments: { code: 'CSE', name: 'Computer Science & Engineering' },
    },
    // A Page publishes through this account — it is not a person result.
    {
      id: 'page-owner',
      username: 'nub.connect',
      display_name: 'NUB Connect Page',
      avatar_url: null,
      is_verified_student: false,
      semester_label: null,
      departments: null,
    },
  ],
  posts: [
    {
      id: 'post-1',
      title: null,
      body: 'Study group in the library tonight — CSE students welcome.',
      category: 'discussion',
      created_at: '2026-11-17T10:00:00Z',
      author: { display_name: 'Rakib Islam' },
      media: [{ media_url: 'https://cdn.test/study.jpg', media_type: 'image' }],
    },
  ],
  organizations: [
    {
      id: 'org-1',
      slug: 'debate-club',
      name: 'Debate Club',
      short_description: 'Campus debates',
      about: 'Weekly practice',
      category: 'Debate',
      logo_url: null,
    },
  ],
  community_groups: [
    {
      id: 'grp-1',
      name: 'Photography Circle',
      description: 'Weekly walks',
      group_type: 'circle',
      cohort_or_semester: null,
      expires_at: null,
      made_permanent_at: null,
    },
    {
      id: 'grp-2',
      name: 'CSE Study Group',
      description: 'Past papers',
      group_type: 'group',
      cohort_or_semester: 'Fall 2026',
      expires_at: null,
      made_permanent_at: null,
    },
    {
      id: 'grp-3',
      name: 'Expired Circle',
      description: 'Old',
      group_type: 'circle',
      cohort_or_semester: null,
      expires_at: '2020-01-01T00:00:00Z',
      made_permanent_at: null,
    },
  ],
  departments: [
    { id: 'dept-1', code: 'CSE', name: 'Computer Science & Engineering', description: 'Computing' },
  ],
  events: [
    {
      id: 'ev-1',
      title: 'CSE Career Fair',
      venue_or_format: 'Central Auditorium',
      event_date: '2026-12-01',
    },
  ],
  activity_plans: [
    {
      id: 'plan-1',
      title: 'Coffee break',
      description: 'Meet at the cafeteria',
      meeting_spot: 'Cafeteria',
      starts_at: new Date(Date.now() + 3_600_000).toISOString(),
    },
  ],
  marketplace_listings: [
    {
      id: 'mk-1',
      title: 'Scientific calculator',
      price_bdt: 1200,
      condition: 'Good',
      pickup_area: 'Nikunja 2',
      photos: ['https://cdn.test/calc.jpg'],
    },
  ],
  room_rental_listings: [
    {
      id: 'room-1',
      title: 'Seat in shared flat',
      general_area: 'Nikunja 2',
      rent_bdt: 4200,
      room_type: 'Shared Room',
    },
  ],
};

/* --- Query sanitisation ---------------------------------------------------- */

describe('sanitizeSearchQuery', () => {
  it('keeps ordinary campus terms and lowercases them', () => {
    expect(sanitizeSearchQuery('  CSE  Photography ')).toEqual(['cse', 'photography']);
  });

  it('removes PostgREST filter syntax so user text cannot become a filter', () => {
    expect(sanitizeSearchQuery("CSE, name.ilike.%x% (a)'")).toEqual([
      'cse',
      'name',
      'ilike',
      'x',
    ]);
    for (const token of sanitizeSearchQuery("CSE, name.ilike.%x% (a)'")) {
      expect(token).not.toMatch(/[.,()%'"\\]/);
    }
  });

  it('returns no tokens for blank or punctuation-only input', () => {
    expect(sanitizeSearchQuery('   ')).toEqual([]);
    expect(sanitizeSearchQuery('%,()')).toEqual([]);
  });

  it('caps token count and token length', () => {
    const tokens = sanitizeSearchQuery('one two three four five six');
    expect(tokens).toEqual(['one', 'two', 'three', 'four']);
    expect(sanitizeSearchQuery('a'.repeat(100))[0]).toHaveLength(40);
  });

  it('builds a safe .or() expression from sanitized tokens', () => {
    expect(buildTextFilter(['title', 'body'], 'cse')).toBe(
      'title.ilike.%cse%,body.ilike.%cse%',
    );
  });
});

/* --- Grouping -------------------------------------------------------------- */

describe('groupHits', () => {
  it('groups by kind in the canonical order and drops empty groups', () => {
    const hit = (id: string, kind: SearchHit['kind']): SearchHit => ({
      id,
      kind,
      title: id,
      subtitle: 'subtitle',
      href: '/home',
    });
    const groups = groupHits([
      hit('r1', 'Room'),
      hit('p1', 'Person'),
      hit('p2', 'Person'),
      hit('e1', 'Event'),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(['Person', 'Event', 'Room']);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['p1', 'p2']);
  });

  it('returns no groups for no hits', () => {
    expect(groupHits([])).toEqual([]);
  });
});

/* --- Real-data search ------------------------------------------------------ */

describe('searchCampus', () => {
  it('does nothing without a backend client or a usable query', async () => {
    const { client, calls } = mockClient(ROWS);
    const noClient = await searchCampus(null, 'cse');
    expect(noClient.configured).toBe(false);
    expect(noClient.hits).toEqual([]);
    expect(calls).toHaveLength(0);

    const blank = await searchCampus(client, '%,()   ');
    expect(blank.hits).toEqual([]);
    expect(blank.groups).toEqual([]);
    expect(blank.configured).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('returns an honest empty result when every real table is empty', async () => {
    const { client } = mockClient();
    const result = await searchCampus(client, 'cse');
    expect(result.hits).toEqual([]);
    expect(result.groups).toEqual([]);
    expect(result.unavailable).toEqual([]);
  });

  it('groups real rows, excludes Page identities and keeps only needed fields', async () => {
    const { client, calls } = mockClient(ROWS);
    const result = await searchCampus(client, 'CSE photography', { viewerId: 'viewer-1' });

    expect(result.unavailable).toEqual([]);
    expect(result.groups.map((g) => g.kind)).toEqual([
      'Person',
      'Circle',
      'Group',
      'Club',
      'Department',
      'Post',
      'Pulse',
      'Event',
      'Product',
      'Room',
    ]);
    expect(result.hits.some((h) => h.id === 'person-page-owner')).toBe(false);

    const person = result.hits.find((h) => h.id === 'person-u1');
    expect(person).toMatchObject({
      kind: 'Person',
      title: 'Rakib Islam',
      subtitle: 'CSE • 7th Semester',
      href: '/profile/rakib.cse',
      verified: true,
    });
    const post = result.hits.find((h) => h.id === 'post-post-1');
    expect(post?.thumb).toBe('https://cdn.test/study.jpg');
    expect(post?.href).toBe('/home');
    expect(result.hits.find((h) => h.id === 'circle-grp-3')).toBeUndefined();
    expect(result.hits.find((h) => h.id === 'product-mk-1')?.thumb).toBe(
      'https://cdn.test/calc.jpg',
    );

    // Privacy and cap guards are actually applied to the real queries.
    expect(calls).toContainEqual({ table: 'profiles', method: 'eq', args: ['is_suspended', false] });
    expect(calls).toContainEqual({ table: 'profiles', method: 'neq', args: ['id', 'viewer-1'] });
    expect(calls).toContainEqual({ table: 'posts', method: 'eq', args: ['is_hidden', false] });
    expect(calls).toContainEqual({
      table: 'marketplace_listings',
      method: 'eq',
      args: ['status', 'available'],
    });
    expect(calls.some((c) => c.method === 'or' && c.args[0] === 'display_name.ilike.%cse%,username.ilike.%cse%,bio.ilike.%cse%')).toBe(true);
    const capped = calls.filter((c) => c.method === 'limit' && c.table !== 'pages');
    expect(capped.length).toBeGreaterThan(0);
    for (const call of capped) expect(call.args[0]).toBe(8);
  });

  it('deep-links Circle, Group, Department, Product and Room hits to their real detail routes', async () => {
    const { client } = mockClient(ROWS);
    const result = await searchCampus(client, 'CSE photography', { viewerId: 'viewer-1' });

    const hits = result.hits;
    expect(hits.find((h) => h.id === 'circle-grp-1')?.href).toBe('/circles/grp-1');
    expect(hits.find((h) => h.id === 'group-grp-2')?.href).toBe('/groups/grp-2');
    expect(hits.find((h) => h.id === 'department-dept-1')?.href).toBe('/department/cse');
    expect(hits.find((h) => h.id === 'product-mk-1')?.href).toBe('/marketplace/mk-1');
    expect(hits.find((h) => h.id === 'room-room-1')?.href).toBe('/roommates/room-1');
  });

  it('reports a failed surface without inventing hits for it', async () => {
    const { client } = mockClient({ ...ROWS, posts: { error: new Error('permission denied') } });
    const result = await searchCampus(client, 'cse');
    expect(result.unavailable).toContain('posts');
    expect(result.unavailable).not.toContain('clubs');
    expect(result.hits.some((h) => h.kind === 'Post')).toBe(false);
    expect(result.hits.some((h) => h.kind === 'Person')).toBe(true);
  });

  it('reports every surface when none can be reached', async () => {
    const failed: Record<string, TableConfig> = {};
    for (const table of [
      ...Object.keys(ROWS),
      'activity_plans',
      'room_rental_listings',
    ]) {
      failed[table] = { error: new Error('offline') };
    }
    const { client } = mockClient(failed);
    const result = await searchCampus(client, 'cse');
    expect(result.hits).toEqual([]);
    expect(result.groups).toEqual([]);
    expect(result.unavailable.slice().sort()).toEqual(SEARCH_SURFACES.slice().sort());
  });

  it('never returns more than the global hit cap', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      title: null,
      body: 'CSE note',
      category: 'discussion',
      created_at: '2026-11-17T10:00:00Z',
      author: { display_name: 'Student' },
      media: [],
    }));
    const { client } = mockClient({ ...ROWS, posts: many });
    const result = await searchCampus(client, 'cse');
    expect(result.hits.length).toBeLessThanOrEqual(40);
    expect(result.hits.filter((h) => h.kind === 'Post').length).toBeLessThanOrEqual(8);
  });
});

/* --- No demo data ----------------------------------------------------------- */

describe('real-data contract', () => {
  it('does not import or render DEMO datasets in the search layer or page', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const sources = [
      readFileSync(path.join(root, 'src/lib/search.ts'), 'utf8'),
      readFileSync(path.join(root, 'src/app/(shell)/search/page.tsx'), 'utf8'),
    ];
    for (const source of sources) {
      expect(source).not.toMatch(/DEMO_[A-Z_]+/);
      expect(source).not.toContain('@/lib/demo/dataset');
      expect(source).not.toContain("from './demo/dataset'");
    }
  });
});
