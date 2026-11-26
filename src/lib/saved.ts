// ============================================================================
// NUBCONNECT — Saved items backed by the per-user `saved_items` table.
//
// The localStorage copy in the store is only a demo fixture. A signed-in
// student reads and writes their own rows through RLS; no one else can see
// their bookmarks.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadMarketplaceListings, loadRoomListings } from './listings';
import { loadPostsByIds } from './posts';
import type { MarketplaceListing, Post, RoomListing } from './types';

export interface SavedState {
  posts: string[];
  rooms: string[];
  products: string[];
}

export const EMPTY_SAVED: SavedState = { posts: [], rooms: [], products: [] };

type SavedItemType = 'post' | 'roommate' | 'marketplace';

function itemTypeToKey(type: string): keyof SavedState | null {
  if (type === 'post') return 'posts';
  if (type === 'roommate') return 'rooms';
  if (type === 'marketplace') return 'products';
  return null;
}

function keyToItemType(key: keyof SavedState): SavedItemType {
  if (key === 'posts') return 'post';
  if (key === 'rooms') return 'roommate';
  return 'marketplace';
}

/** Read the signed-in student's saved item ids from the database. */
export async function loadSavedState(
  client: SupabaseClient,
  userId: string,
): Promise<SavedState> {
  const { data, error } = await client
    .from('saved_items')
    .select('item_type, item_id')
    .eq('user_id', userId);
  if (error || !data) return EMPTY_SAVED;

  const state: SavedState = { posts: [], rooms: [], products: [] };
  for (const row of data as { item_type: string; item_id: string }[]) {
    const key = itemTypeToKey(row.item_type);
    if (key && !state[key].includes(row.item_id)) state[key].push(row.item_id);
  }
  return state;
}

/** Insert or remove one saved row. Returns the resulting saved state. */
export async function setSavedItem(
  client: SupabaseClient,
  userId: string,
  key: keyof SavedState,
  itemId: string,
  save: boolean,
): Promise<boolean> {
  const itemType = keyToItemType(key);
  if (!itemId) return false;

  if (save) {
    const { error } = await client.from('saved_items').upsert(
      { user_id: userId, item_type: itemType, item_id: itemId },
      { onConflict: 'user_id,item_type,item_id', ignoreDuplicates: true },
    );
    return !error;
  }

  const { error } = await client
    .from('saved_items')
    .delete()
    .eq('user_id', userId)
    .eq('item_type', itemType)
    .eq('item_id', itemId);
  return !error;
}

export interface SavedContent {
  posts: Post[];
  rooms: RoomListing[];
  products: MarketplaceListing[];
}

/** Resolve saved ids into the records the Saved screen renders. */
export async function loadSavedContent(
  client: SupabaseClient,
  viewerId: string,
  saved: SavedState,
): Promise<SavedContent> {
  const [posts, rooms, products] = await Promise.all([
    loadPostsByIds(client, saved.posts, viewerId),
    loadRoomListings(client, { ids: saved.rooms, savedIds: saved.rooms }),
    loadMarketplaceListings(client, { ids: saved.products, savedIds: saved.products }),
  ]);
  return { posts, rooms, products };
}
