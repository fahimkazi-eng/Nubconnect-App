// Real campus events: mapped only from database rows, with honest fallbacks
// for an organizer that has no linked organization or department.
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadCampusEvents } from '../src/lib/events';

function clientFor(events: unknown[], organizations: unknown[] = [], departments: unknown[] = []) {
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(async () => ({
          data: table === 'events' ? events : table === 'organizations' ? organizations : departments,
          error: null,
        })),
      })),
      in: vi.fn(async () => ({
        data: table === 'organizations' ? organizations : departments,
        error: null,
      })),
    })),
  }));
  return { client: { from } as unknown as SupabaseClient, from };
}

describe('loadCampusEvents', () => {
  it('does not query without a client', async () => {
    const result = await loadCampusEvents(null);
    expect(result.events).toEqual([]);
    expect(result.error).toBeUndefined();
  });

  it('maps real rows and resolves linked organizer names', async () => {
    const { client } = clientFor(
      [{
        id: 'e1',
        title: 'Open Day',
        event_date: '2026-11-20',
        start_time: '10:00',
        venue_or_format: 'Main Auditorium',
        organization_id: 'o1',
        department_id: null,
        verification_status: 'officially_verified',
        source_url: 'https://www.nub.ac.bd/event',
      }],
      [{ id: 'o1', name: 'NUB Computer Club' }],
    );
    const { events, error } = await loadCampusEvents(client);
    expect(error).toBeUndefined();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'e1',
      title: 'Open Day',
      organizer: 'NUB Computer Club',
      venue: 'Main Auditorium',
      originLabel: 'Official',
      registered: false,
      isDemo: false,
      sourceUrl: 'https://www.nub.ac.bd/event',
    });
  });

  it('falls back to Campus instead of inventing an organizer', async () => {
    const { client } = clientFor([{
      id: 'e2',
      title: 'Campus Talk',
      event_date: '2026-11-21',
      start_time: null,
      venue_or_format: null,
      organization_id: null,
      department_id: null,
      verification_status: null,
      source_url: null,
    }]);
    const { events } = await loadCampusEvents(client);
    expect(events[0]?.organizer).toBe('Campus');
    expect(events[0]?.originLabel).toBe('Campus');
  });

  it('surfaces a database error instead of an empty success', async () => {
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(async () => ({ data: null, error: { message: 'permission denied' } })),
        })),
      })),
    }));
    const result = await loadCampusEvents({ from } as unknown as SupabaseClient);
    expect(result.events).toEqual([]);
    expect(result.error).toBe('permission denied');
  });
});
