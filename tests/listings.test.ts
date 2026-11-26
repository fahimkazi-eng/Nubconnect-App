// Detail loaders must never send a non-UUID id to PostgREST: demo ids are
// only local fixtures, and sending them to the database produces a 400.
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  loadMarketplaceListingById,
  loadRoomListingById,
} from '../src/lib/listings';

describe('listing detail id validation', () => {
  it('skips database queries for non-UUID room ids', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseClient;
    await expect(loadRoomListingById(client, 'rm-1')).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('skips database queries for non-UUID marketplace ids', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseClient;
    await expect(loadMarketplaceListingById(client, 'mk-1')).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
