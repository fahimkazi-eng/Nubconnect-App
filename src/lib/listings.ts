// ============================================================================
// NUBCONNECT — Real room and marketplace listings.
//
// Maps RLS-protected rows from `room_rental_listings` and
// `marketplace_listings` into the view models the cards already render.
// Empty tables stay empty; nothing here fabricates a listing.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';

import { timeAgo } from './format';
import { deleteUploadedMedia, uploadMedia } from './storage/client';
import type {
  ListingStatus,
  MarketplaceCategory,
  MarketplaceListing,
  RoomListing,
  RoomPhoto,
} from './types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validIds = (ids: readonly string[]): string[] => ids.filter((id) => UUID_PATTERN.test(id));

const CATEGORY_BY_SLUG: Readonly<Record<string, MarketplaceCategory>> = {
  'books-academic': 'Books & Academic',
  electronics: 'Electronics',
  computers: 'Computers',
  furniture: 'Furniture',
  clothing: 'Clothing',
  accessories: 'Accessories',
  sports: 'Sports',
  'home-items': 'Home Items',
  other: 'Other',
};

const STATUS_BY_SLUG: Readonly<Record<string, ListingStatus>> = {
  draft: 'Active',
  active: 'Active',
  available: 'Active',
  paused: 'Paused',
  reserved: 'Reserved',
  sold: 'Sold',
  unavailable: 'Unavailable',
  withdrawn: 'Unavailable',
  archived: 'Archived',
  removed: 'Archived',
  expired: 'Archived',
};

function statusOf(value: unknown): ListingStatus {
  return STATUS_BY_SLUG[String(value ?? 'active').toLowerCase()] ?? 'Active';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

interface ProfileSummary {
  id: string;
  name: string;
  department: string;
}

async function loadProfileSummaries(
  client: SupabaseClient,
  ids: readonly string[],
): Promise<Map<string, ProfileSummary>> {
  const out = new Map<string, ProfileSummary>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return out;

  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, username, department_id, departments:department_id(code, name)')
    .in('id', unique);
  if (error || !data) return out;

  const profileRows = data as unknown as {
    id: string;
    display_name: string | null;
    username: string | null;
    departments: { code: string | null; name: string | null } | null;
  }[];
  for (const row of profileRows) {
    const department = row.departments?.code ?? row.departments?.name ?? '';
    out.set(row.id, {
      id: row.id,
      name: row.display_name || row.username || 'NUB student',
      department,
    });
  }
  return out;
}

function mapRoomRow(
  row: Record<string, unknown>,
  profile: ProfileSummary | undefined,
  photos: readonly RoomPhoto[],
  savedIds: readonly string[],
): RoomListing {
  const roomType = String(row.room_type ?? 'Shared Room');
  const furnished = String(row.furnished ?? 'semi').toLowerCase();
  const isShared = row.is_shared !== false;
  const createdAt = String(row.created_at ?? new Date().toISOString());

  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    area: String(row.general_area ?? ''),
    rent: Number(row.rent_bdt ?? 0),
    advance: Number(row.advance_bdt ?? 0),
    roomType: (['Single Room', 'Shared Room', '1-bed Flat', '2-bed Flat', 'Studio'].includes(
      roomType,
    )
      ? roomType
      : 'Shared Room') as RoomListing['roomType'],
    furnished: (furnished === 'fully'
      ? 'Fully Furnished'
      : furnished === 'unfurnished'
        ? 'Unfurnished'
        : 'Semi-Furnished') as RoomListing['furnished'],
    shared: isShared,
    available: row.is_available !== false && statusOf(row.status) === 'Active',
    availableFrom: String(row.available_from ?? 'Now'),
    amenities: stringArray(row.amenities),
    utilities: String(row.utilities_note ?? ''),
    houseRules: String(row.house_rules ?? ''),
    ownerName: profile?.name ?? 'NUB student',
    ownerDepartment: profile?.department ?? '',
    photos: [...photos],
    saved: savedIds.includes(String(row.id ?? '')),
    isDemo: false,
    ownerId: String(row.author_id ?? ''),
    description: String(row.description ?? ''),
    seats: isShared ? 2 : 1,
    views: 0,
    status: statusOf(row.status),
    postedAgo: timeAgo(createdAt),
  };
}

/** Load real room listings. With no ids, loads the newest page of listings. */
export async function loadRoomListings(
  client: SupabaseClient,
  options: { ids?: readonly string[]; limit?: number; savedIds?: readonly string[] } = {},
): Promise<RoomListing[]> {
  const savedIds = options.savedIds ?? [];
  const requestedIds = options.ids ? validIds(options.ids) : null;
  if (requestedIds && requestedIds.length === 0) return [];
  let query = client.from('room_rental_listings').select('*');
  if (requestedIds) query = query.in('id', requestedIds);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(options.limit ?? 50, 1), 50));
  if (error || !data || data.length === 0) return [];

  const rows = data as Record<string, unknown>[];
  const ids = rows.map((row) => String(row.id ?? '')).filter(Boolean);
  const [profiles, photoResult] = await Promise.all([
    loadProfileSummaries(
      client,
      rows.map((row) => String(row.author_id ?? '')),
    ),
    client
      .from('room_rental_photos')
      .select('listing_id, media_url, room_kind, caption, position')
      .in('listing_id', ids)
      .order('position', { ascending: true }),
  ]);

  const photosByListing = new Map<string, RoomPhoto[]>();
  for (const photo of (photoResult.data ?? []) as {
    listing_id: string;
    media_url: string;
    room_kind: string;
    caption: string | null;
  }[]) {
    const kind = photo.room_kind;
    const room: RoomPhoto['room'] = (['Bedroom', 'Kitchen', 'Bathroom', 'Living Area'].includes(
      kind,
    )
      ? kind
      : 'Bedroom') as RoomPhoto['room'];
    const list = photosByListing.get(photo.listing_id) ?? [];
    list.push({ uri: photo.media_url, room, caption: photo.caption ?? '' });
    photosByListing.set(photo.listing_id, list);
  }

  return rows.map((row) => {
    const id = String(row.id ?? '');
    const profile = profiles.get(String(row.author_id ?? ''));
    return mapRoomRow(row, profile, photosByListing.get(id) ?? [], savedIds);
  });
}

function mapMarketplaceRow(
  row: Record<string, unknown>,
  profile: ProfileSummary | undefined,
  savedIds: readonly string[],
): MarketplaceListing {
  const slug = String(row.category_slug ?? 'other');
  const condition = String(row.condition ?? 'Good');
  const createdAt = String(row.created_at ?? new Date().toISOString());
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    price: Number(row.price_bdt ?? 0),
    category: CATEGORY_BY_SLUG[slug] ?? 'Other',
    condition: (['New', 'Like New', 'Good', 'Fair'].includes(condition)
      ? condition
      : 'Good') as MarketplaceListing['condition'],
    description: String(row.description ?? ''),
    pickupArea: String(row.pickup_area ?? ''),
    sellerId: String(row.seller_id ?? ''),
    sellerName: profile?.name ?? 'NUB student',
    sellerDepartment: profile?.department ?? '',
    status: statusOf(row.status),
    createdAt,
    photos: stringArray(row.photos),
    saved: savedIds.includes(String(row.id ?? '')),
    isDemo: false,
  };
}

/** Load real marketplace listings. With no ids, loads the newest page. */
export async function loadMarketplaceListings(
  client: SupabaseClient,
  options: { ids?: readonly string[]; limit?: number; savedIds?: readonly string[] } = {},
): Promise<MarketplaceListing[]> {
  const savedIds = options.savedIds ?? [];
  const requestedIds = options.ids ? validIds(options.ids) : null;
  if (requestedIds && requestedIds.length === 0) return [];
  let query = client.from('marketplace_listings').select('*');
  if (requestedIds) query = query.in('id', requestedIds);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(options.limit ?? 50, 1), 50));
  if (error || !data || data.length === 0) return [];

  const rows = data as Record<string, unknown>[];
  const profiles = await loadProfileSummaries(
    client,
    rows.map((row) => String(row.seller_id ?? '')),
  );
  return rows.map((row) =>
    mapMarketplaceRow(row, profiles.get(String(row.seller_id ?? '')), savedIds),
  );
}

/** Load one real listing by id for a detail page. */
export async function loadRoomListingById(
  client: SupabaseClient,
  id: string,
  savedIds: readonly string[] = [],
): Promise<RoomListing | null> {
  const rows = await loadRoomListings(client, { ids: [id], savedIds });
  return rows[0] ?? null;
}

/** Load one real marketplace listing by id for a detail page. */
export async function loadMarketplaceListingById(
  client: SupabaseClient,
  id: string,
  savedIds: readonly string[] = [],
): Promise<MarketplaceListing | null> {
  const rows = await loadMarketplaceListings(client, { ids: [id], savedIds });
  return rows[0] ?? null;
}

export interface RoomPhotoUpload {
  readonly file: File;
  readonly kind: RoomPhoto['room'];
  readonly caption: string;
}

export interface CreateRoomListingInput {
  readonly userId: string;
  readonly universityId: string;
  readonly departmentId?: string | null;
  readonly title: string;
  readonly area: string;
  readonly rent: number;
  readonly advance: number;
  readonly roomType: RoomListing['roomType'];
  readonly furnished: RoomListing['furnished'];
  readonly shared: boolean;
  readonly availableFrom: string;
  readonly amenities: readonly string[];
  readonly utilities: string;
  readonly houseRules: string;
  readonly description: string;
  readonly photos: readonly RoomPhotoUpload[];
}

/** Publish a room listing and its photo tour through authorized storage. */
export async function createRoomListing(
  client: SupabaseClient,
  input: CreateRoomListingInput,
): Promise<{ id?: string; error?: string }> {
  const uploaded: { url: string; key: string; kind: RoomPhoto['room']; caption: string }[] = [];
  for (const photo of input.photos) {
    const result = await uploadMedia(client, { kind: 'room', file: photo.file });
    if (!result.ok) {
      await deleteUploadedMedia(
        'room',
        uploaded.map((u) => u.key),
      );
      return { error: result.error };
    }
    uploaded.push({
      url: result.data.url,
      key: result.data.key,
      kind: photo.kind,
      caption: photo.caption,
    });
  }

  const { data, error } = await client
    .from('room_rental_listings')
    .insert({
      university_id: input.universityId,
      author_id: input.userId,
      department_id: input.departmentId ?? null,
      title: input.title.trim(),
      general_area: input.area.trim(),
      rent_bdt: input.rent,
      advance_bdt: input.advance,
      room_type: input.roomType,
      furnished: input.furnished === 'Fully Furnished' ? 'fully' : input.furnished === 'Unfurnished' ? 'unfurnished' : 'semi',
      is_shared: input.shared,
      is_available: true,
      available_from: input.availableFrom.trim() || 'Now',
      amenities: [...input.amenities],
      utilities_note: input.utilities.trim(),
      house_rules: input.houseRules.trim(),
      description: input.description.trim(),
      status: 'active',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    await deleteUploadedMedia(
      'room',
      uploaded.map((u) => u.key),
    );
    return { error: error?.message ?? 'The room listing could not be published.' };
  }

  if (uploaded.length > 0) {
    const { error: photoError } = await client.from('room_rental_photos').insert(
      uploaded.map((u, position) => ({
        listing_id: data.id,
        media_url: u.url,
        room_kind: u.kind,
        caption: u.caption.trim() || null,
        position,
      })),
    );
    if (photoError) {
      await client.from('room_rental_listings').delete().eq('id', data.id);
      await deleteUploadedMedia(
        'room',
        uploaded.map((u) => u.key),
      );
      return { error: photoError.message || 'The listing photos could not be saved.' };
    }
  }

  return { id: String(data.id) };
}

export interface CreateMarketplaceListingInput {
  readonly userId: string;
  readonly universityId: string;
  readonly title: string;
  readonly price: number;
  readonly categorySlug: string;
  readonly condition: MarketplaceListing['condition'];
  readonly description: string;
  readonly pickupArea: string;
  readonly photos: readonly File[];
}

/** Publish a marketplace listing with server-owned photo URLs. */
export async function createMarketplaceListing(
  client: SupabaseClient,
  input: CreateMarketplaceListingInput,
): Promise<{ id?: string; error?: string }> {
  const uploaded: { url: string; key: string }[] = [];
  for (const file of input.photos) {
    const result = await uploadMedia(client, { kind: 'marketplace', file });
    if (!result.ok) {
      await deleteUploadedMedia(
        'marketplace',
        uploaded.map((u) => u.key),
      );
      return { error: result.error };
    }
    uploaded.push({ url: result.data.url, key: result.data.key });
  }

  const { data, error } = await client
    .from('marketplace_listings')
    .insert({
      university_id: input.universityId,
      seller_id: input.userId,
      category_slug: input.categorySlug,
      title: input.title.trim(),
      price_bdt: input.price,
      condition: input.condition,
      description: input.description.trim(),
      pickup_area: input.pickupArea.trim(),
      photos: uploaded.map((u) => u.url),
      status: 'available',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    await deleteUploadedMedia(
      'marketplace',
      uploaded.map((u) => u.key),
    );
    return { error: error?.message ?? 'The marketplace listing could not be published.' };
  }
  return { id: String(data.id) };
}

const MARKETPLACE_STATUS_BY_VIEW: Readonly<Record<ListingStatus, string>> = {
  Active: 'available',
  Paused: 'paused',
  Reserved: 'reserved',
  Sold: 'sold',
  Unavailable: 'unavailable',
  Archived: 'archived',
};

/** Update a seller's own listing status through the RLS-protected table. */
export async function setMarketplaceListingStatus(
  client: SupabaseClient,
  id: string,
  status: ListingStatus,
): Promise<{ error?: string }> {
  const { error } = await client
    .from('marketplace_listings')
    .update({ status: MARKETPLACE_STATUS_BY_VIEW[status] })
    .eq('id', id);
  return error ? { error: error.message } : {};
}
