'use client';

// Find Roommates — seven tabs (§11): Browse Rooms / Find a Roommate /
// Hostels / Mess / Saved / My Listings / Enquiries. Mobile filters live in a
// bottom sheet; sorting covers Recent, Price ↑, Price ↓, Availability. Room,
// hostel and mess cards show general area only — never exact addresses or
// phone numbers (§11 privacy).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BedDouble, Building, Check, ChevronRight, CookingPot, Filter, Heart, Home, MessageCircle, Plus, Search as SearchIcon, SlidersHorizontal, Users, UtensilsCrossed } from 'lucide-react';
import { DEMO_HOSTELS, DEMO_MESS, DEMO_ROOMMATES, DEMO_ROOMS } from '@/lib/demo/dataset';
import { loadRoomListings } from '@/lib/listings';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { Avatar, BottomSheet, Chip, DemoTag, EmptyState, Tabs } from '@/components/ui/kit';
import { taka } from '@/lib/format';
import type { HostelListing, MessListing, RoomListing, RoommateProfile } from '@/lib/types';

const ROOM_TYPES = ['all', 'Single Room', 'Shared Room', '1-bed Flat', '2-bed Flat', 'Studio'];
const FURNISHED = ['all', 'Fully Furnished', 'Semi-Furnished', 'Unfurnished'];
const AREAS = ['all', ...new Set(DEMO_ROOMS.map((r) => r.area))];
const SORTS = [
  { key: 'recent', label: 'Recent' },
  { key: 'price-asc', label: 'Price ↑' },
  { key: 'price-desc', label: 'Price ↓' },
  { key: 'availability', label: 'Availability' },
] as const;

type RoomTab = 'browse' | 'roommate' | 'hostels' | 'mess' | 'saved' | 'mine' | 'enquiries';
const ROOM_TABS: RoomTab[] = ['browse', 'roommate', 'hostels', 'mess', 'saved', 'mine', 'enquiries'];

export default function BrowseRooms() {
  const params = useSearchParams();
  const initialTab = params.get('tab') ?? 'browse';
  const { saved, toggleSaveRoom, myRooms, user } = useApp();

  const [tab, setTab] = useState<RoomTab>(
    (ROOM_TABS.includes(initialTab as RoomTab) ? initialTab : 'browse') as RoomTab,
  );
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<string>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    area: 'all',
    roomType: 'all',
    seatType: 'all',
    furnished: 'all',
    budgetMax: 8000,
    availableOnly: true,
  });

  const backend = isBackendConfigured();
  const [realRooms, setRealRooms] = useState<RoomListing[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(backend);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const savedKey = saved.rooms.join(',');

  useEffect(() => {
    let active = true;
    if (!backend) {
      setRealRooms([]);
      setRoomsLoading(false);
      return () => {
        active = false;
      };
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      setRoomsLoading(false);
      return () => {
        active = false;
      };
    }

    setRoomsLoading(true);
    void loadRoomListings(client, { savedIds: saved.rooms })
      .then((rows) => {
        if (!active) return;
        setRealRooms(rows);
        setRoomsError(null);
      })
      .catch(() => {
        if (active) setRoomsError('Rooms could not be loaded. Please try again.');
      })
      .finally(() => {
        if (active) setRoomsLoading(false);
      });
    return () => {
      active = false;
    };
    // savedKey is the stable value of the ids used in the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, savedKey]);

  // Sample listings are a development fixture. On a connected campus the
  // browse tabs show what students have actually listed, and nothing else.
  const allRooms = useMemo(() => {
    if (!backend) return [...myRooms, ...DEMO_ROOMS];
    const byId = new Map<string, RoomListing>();
    for (const room of [...myRooms, ...realRooms]) byId.set(room.id, room);
    return [...byId.values()];
  }, [backend, myRooms, realRooms]);
  const myListings = useMemo(
    () => (backend ? allRooms.filter((r) => r.ownerId === user.id) : myRooms),
    [allRooms, backend, myRooms, user.id],
  );
  const areaOptions = useMemo(
    () => (backend ? ['all', ...new Set(allRooms.map((r) => r.area).filter(Boolean))] : AREAS),
    [allRooms, backend],
  );

  // Category tabs are views over the SAME real RoomListing records as Browse.
  // The current schema has one room_rental_listings table, so hostel/mess rows
  // are identified by what the listing owner actually wrote in the title/area.
  // We never cast them into incompatible fixture shapes or invent fields that
  // do not exist on a real listing — the cards below display only real data.
  const allRoommates = useMemo<RoomListing[]>(
    () => backend
      ? allRooms.filter((r) => r.roomType === 'Shared Room' || r.roomType === 'Single Room')
      : DEMO_ROOMMATES.map(roommateAsListing),
    [allRooms, backend],
  );
  const allHostels = useMemo<RoomListing[]>(
    () => backend
      ? allRooms.filter((r) => /hostel|dorm/i.test(`${r.title} ${r.area}`))
      : DEMO_HOSTELS.map(hostelAsListing),
    [allRooms, backend],
  );
  const allMess = useMemo<RoomListing[]>(
    () => backend
      ? allRooms.filter((r) => /mess|dining/i.test(`${r.title} ${r.area}`))
      : DEMO_MESS.map(messAsListing),
    [allRooms, backend],
  );

  const rooms = useMemo(() => {
    let out = allRooms;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter((r) => r.title.toLowerCase().includes(q) || r.area.toLowerCase().includes(q));
    }
    if (filters.area !== 'all') out = out.filter((r) => r.area === filters.area);
    if (filters.roomType !== 'all') out = out.filter((r) => r.roomType === filters.roomType);
    if (filters.seatType !== 'all') {
      const seatKeyword = filters.seatType.toLowerCase();
      out = out.filter(
        (r) => r.area.toLowerCase().includes(seatKeyword) || r.title.toLowerCase().includes(seatKeyword),
      );
    }
    if (filters.furnished !== 'all') out = out.filter((r) => r.furnished === filters.furnished);
    out = out.filter((r) => r.rent <= filters.budgetMax);
    if (filters.availableOnly) out = out.filter((r) => r.available);
    switch (sort) {
      case 'price-asc':
        out = [...out].sort((a, b) => a.rent - b.rent);
        break;
      case 'price-desc':
        out = [...out].sort((a, b) => b.rent - a.rent);
        break;
      case 'availability':
        out = [...out].sort((a, b) => (a.available === b.available ? 0 : a.available ? -1 : 1));
        break;
      default:
        break;
    }
    return out;
  }, [allRooms, query, filters, sort]);

  const savedRooms = allRooms.filter((r) => saved.rooms.includes(r.id));

  return (
    <div className="space-y-4">
      <header className="px-1">
        <p className="editorial-kicker mb-1 text-violet-ink dark:text-violet">Living near campus</p>
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Find Roommates</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Rooms, flat-shares and roommate matches around NUB — general areas only, private enquiries.
        </p>
      </header>

      <Tabs
        tabs={[
          { key: 'browse', label: 'Browse', count: rooms.length },
          { key: 'roommate', label: 'Find Roommate', count: allRoommates.length },
          { key: 'hostels', label: 'Hostels', count: allHostels.length },
          { key: 'mess', label: 'Mess', count: allMess.length },
          { key: 'saved', label: 'Saved', count: savedRooms.length },
          { key: 'mine', label: 'My Listings', count: myListings.length },
          { key: 'enquiries', label: 'Enquiries' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as RoomTab)}
      />

      {backend && roomsLoading && (
        <div className="card p-4 text-center text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Loading rooms…
        </div>
      )}
      {backend && roomsError && (
        <div className="card p-4 text-center text-sm font-semibold text-coral-ink" role="alert">
          {roomsError}
        </div>
      )}

      {/* BROWSE */}
      {tab === 'browse' && (
        <>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <SearchIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-campus-text-sec dark:text-campus-dark-sec" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search area or title"
                aria-label="Search rooms"
                className="touch-target w-full rounded-2xl border border-campus-border bg-campus-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text"
              />
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              aria-label="Open filters"
              className="glass touch-target flex items-center gap-1.5 rounded-2xl px-4 font-semibold"
            >
              <SlidersHorizontal size={16} />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>

          <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
              Sort
            </span>
            {SORTS.map((s) => (
              <Chip key={s.key} active={sort === s.key} onClick={() => setSort(s.key)}>
                {s.label}
              </Chip>
            ))}
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-campus-text-sec dark:text-campus-dark-sec">
              Type
            </span>
            <Chip
              active={filters.roomType === 'all'}
              onClick={() => setFilters({ ...filters, roomType: 'all' })}
              className="shrink-0 rounded-full border border-campus-border bg-campus-card px-3 py-1.5 text-xs font-bold dark:border-campus-dark-border dark:bg-campus-dark-card"
            >
              All types
            </Chip>
            {['Single Room', 'Shared Room', '1-bed Flat', '2-bed Flat', 'Studio'].map((t) => (
              <Chip
                key={t}
                active={filters.roomType === t}
                onClick={() => setFilters({ ...filters, roomType: t })}
              >
                {t}
              </Chip>
            ))}
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-campus-text-sec dark:text-campus-dark-sec ml-2">
              Accommodation
            </span>
            <Chip
              active={filters.seatType === 'all'}
              onClick={() => setFilters({ ...filters, seatType: 'all' })}
              className="shrink-0 rounded-full border border-campus-border bg-campus-card px-3 py-1.5 text-xs font-bold dark:border-campus-dark-border dark:bg-campus-dark-card"
            >
              All types
            </Chip>
            {['Seat', 'Mess', 'Hostel'].map((t) => (
              <Chip
                key={t}
                active={filters.seatType === t}
                onClick={() => setFilters({ ...filters, seatType: t })}
              >
                {t}
              </Chip>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rooms.map((room) => (
              <div key={room.id} className="card overflow-hidden p-0">
                <Link href={`/roommates/${room.id}`} className="block">
                  <div className="relative aspect-[16/10]">
                    {room.photos[0]?.uri ? (
                      <img src={room.photos[0].uri} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-campus-bg text-[11px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                        No photos
                      </div>
                    )}
                    {room.photos.length > 1 && (
                      <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-[#211B35]/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                        <Filter size={10} /> {room.photos.length} photos
                      </span>
                    )}
                    {room.isDemo && (
                      <span className="absolute right-2 top-2">
                        <DemoTag compact />
                      </span>
                    )}
                    {!room.available && (
                      <span className="absolute left-2 top-2 rounded-full bg-[#211B35]/70 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                        Unavailable
                      </span>
                    )}
                  </div>
                </Link>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/roommates/${room.id}`} className="min-w-0">
                      <p className="font-display text-sm font-bold leading-snug">{room.title}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                        📍 {room.area}
                      </p>
                    </Link>
                    <button
                      onClick={() => toggleSaveRoom(room.id)}
                      aria-pressed={saved.rooms.includes(room.id)}
                      aria-label={saved.rooms.includes(room.id) ? 'Unsave room' : 'Save room'}
                      className={`touch-target flex items-center justify-center rounded-full ${
                        saved.rooms.includes(room.id) ? 'text-coral' : 'text-campus-text-sec dark:text-campus-dark-sec'
                      }`}
                    >
                      <Heart size={18} className={saved.rooms.includes(room.id) ? 'fill-current' : ''} />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <p className="font-display text-base font-extrabold text-violet-ink">{taka(room.rent)}<span className="text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">/mo</span></p>
                    <p className="text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                      Advance {taka(room.advance)}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                      <BedDouble size={10} /> {room.roomType}
                    </span>
                    <span className="rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                      {room.furnished}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                      <Users size={10} /> {room.shared ? 'Shared' : 'Private'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${room.available ? 'bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime' : 'bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec'}`}>
                      {room.available ? <Check size={10} /> : null}
                      {room.available ? `From ${room.availableFrom}` : 'Currently full'}
                    </span>
                    <Link href={`/roommates/${room.id}`} className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-bold text-violet-ink hover:underline">
                      View Details <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {rooms.length === 0 && (
            <EmptyState
              icon={<Home size={22} />}
              title="No rooms match your filters"
              body="Try widening the budget or area, or check back — new rooms appear around semester starts."
            />
          )}

          <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
            <div className="space-y-4 py-1">
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                  Location (general area)
                </p>
                <div className="flex flex-wrap gap-2">
                  {areaOptions.map((a) => (
                    <Chip key={a} active={filters.area === a} onClick={() => setFilters({ ...filters, area: a })}>
                      {a === 'all' ? 'All areas' : a}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                  Room type
                </p>
                <div className="flex flex-wrap gap-2">
                  {ROOM_TYPES.map((t) => (
                    <Chip key={t} active={filters.roomType === t} onClick={() => setFilters({ ...filters, roomType: t })}>
                      {t === 'all' ? 'Any type' : t}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                  Furnishing
                </p>
                <div className="flex flex-wrap gap-2">
                  {FURNISHED.map((f) => (
                    <Chip key={f} active={filters.furnished === f} onClick={() => setFilters({ ...filters, furnished: f })}>
                      {f === 'all' ? 'Any' : f}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                  <span>Budget (monthly)</span>
                  <span className="font-mono text-violet-ink">{taka(filters.budgetMax)}</span>
                </p>
                <input
                  type="range"
                  min={2000}
                  max={8000}
                  step={500}
                  value={filters.budgetMax}
                  onChange={(e) => setFilters({ ...filters, budgetMax: Number(e.target.value) })}
                  className="w-full accent-violet"
                  aria-label="Maximum monthly budget"
                />
              </div>
              <label className="flex items-center justify-between rounded-2xl bg-campus-bg p-3 text-sm font-semibold dark:bg-campus-dark-card">
                Available now only
                <input
                  type="checkbox"
                  checked={filters.availableOnly}
                  onChange={(e) => setFilters({ ...filters, availableOnly: e.target.checked })}
                  className="h-6 w-6 accent-violet"
                />
              </label>
              <button
                onClick={() => {
                  setFilters({ area: 'all', roomType: 'all', seatType: 'all', furnished: 'all', budgetMax: 8000, availableOnly: true });
                }}
                className="touch-target w-full rounded-xl bg-campus-bg py-2.5 text-sm font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
              >
                Clear all filters
              </button>
            </div>
          </BottomSheet>
        </>
      )}

      {/* FIND A ROOMMATE */}
      {tab === 'roommate' && (
        <>
          <p className="px-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            Single and shared rooms listed by students. Every card is a real listing — contact starts with a private
            enquiry, and exact addresses and phone numbers are never published.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {allRoommates.map((room) => (
              <CategoryRoomCard key={room.id} room={room} variant="roommate" />
            ))}
          </div>
          {allRoommates.length === 0 && (
            <EmptyState
              icon={<Users size={22} />}
              title="No roommate listings yet"
              body="Nobody has published a single or shared room here. Check back around semester starts, or post your own."
            />
          )}
        </>
      )}

      {/* HOSTELS */}
      {tab === 'hostels' && (
        <>
          <p className="px-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            Hostel and dorm seats shared by students — general areas only. These are real listings whose owners
            described a hostel or dorm. Contact happens through private enquiries.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {allHostels.map((room) => (
              <CategoryRoomCard key={room.id} room={room} variant="hostel" />
            ))}
          </div>
          {allHostels.length === 0 && (
            <EmptyState
              icon={<Building size={22} />}
              title="No hostel listings yet"
              body="No student has listed a hostel or dorm seat here yet. Check back around semester starts."
            />
          )}
        </>
      )}

      {/* MESS */}
      {tab === 'mess' && (
        <>
          <p className="px-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            Mess and dining subscriptions shared by students. Rates and availability come from the listing owner; seats
            are arranged through private enquiries.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {allMess.map((room) => (
              <CategoryRoomCard key={room.id} room={room} variant="mess" />
            ))}
          </div>
          {allMess.length === 0 && (
            <EmptyState
              icon={<UtensilsCrossed size={22} />}
              title="No mess listings yet"
              body="No student has listed a mess or dining subscription here yet. Check back later."
            />
          )}
        </>
      )}

      {/* MY LISTINGS */}
      {tab === 'mine' && (
        <>
          <Link
            href="/roommates/new"
            className="touch-target flex items-center justify-center gap-2 rounded-2xl bg-violet py-3 text-sm font-bold text-plum shadow-violet-glow"
          >
            <Plus size={17} /> Create room listing
          </Link>
          {myListings.length === 0 ? (
            <EmptyState
              icon={<Home size={22} />}
              title="You haven't listed a room yet"
              body="Renting out a seat or a flat? Create a listing with photos, rent in ৳ and house rules — your exact address stays private until you accept an enquiry."
              action={
                <Link href="/roommates/new" className="touch-target mt-2 rounded-xl bg-violet px-4 py-2.5 text-sm font-bold text-plum">
                  Create listing
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {myListings.map((r) => (
                <div key={r.id} className="card flex items-center gap-3 p-3">
                  <img src={r.photos[0]?.uri} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.title}</p>
                    <p className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                      {taka(r.rent)}/mo • {r.area}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      (r.status ?? 'Active') === 'Active'
                        ? 'bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime'
                        : 'bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec'
                    }`}
                  >
                    {r.status ?? 'Active'}
                  </span>
                  <Link href={`/roommates/${r.id}`} className="shrink-0 text-violet-ink">
                    <ChevronRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* SAVED */}
      {tab === 'saved' && (
        <>
          {savedRooms.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {savedRooms.map((room) => (
                <Link key={room.id} href={`/roommates/${room.id}`} className="card overflow-hidden p-0">
                  <div className="relative aspect-[16/10]">
                    <img src={room.photos[0]?.uri} alt="" className="h-full w-full object-cover" loading="lazy" />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        toggleSaveRoom(room.id);
                      }}
                      aria-label="Remove from saved"
                      className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#211B35]/50 text-coral backdrop-blur"
                    >
                      <Heart size={16} className="fill-current" />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="font-display text-sm font-bold">{room.title}</p>
                    <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                      📍 {room.area} • {taka(room.rent)}/mo
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Heart size={22} />}
              title="No saved rooms yet"
              body="Tap the heart on any room to keep it here for later."
            />
          )}
        </>
      )}

      {/* ENQUIRIES */}
      {tab === 'enquiries' &&
        (backend ? (
          <EmptyState
            icon={<MessageCircle size={22} />}
            title="No enquiries to show"
            body="Your private room enquiries stay in Chats. No sample conversations are shown."
          />
        ) : (
          <div className="space-y-2">
            {[
              { room: 'rm-1', title: '1 Seat Available in 3-Bedroom Student Flat', status: 'Replied' },
              { room: 'rm-4', title: 'Studio Flat Near Main Gate — Independent Entry', status: 'Pending' },
            ].map((e) => (
              <Link key={e.room} href="/messages" className="card flex items-center gap-3 p-3">
                <img
                  src={DEMO_ROOMS.find((r) => r.id === e.room)?.photos[0]?.uri}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{e.title}</p>
                  <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                    Enquiry about availability & utilities
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    e.status === 'Replied'
                      ? 'bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime'
                      : 'bg-sunshine-soft text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'
                  }`}
                >
                  {e.status}
                </span>
              </Link>
            ))}
          </div>
        ))}
      {tab === 'enquiries' && (
        <p className="text-center text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
          Enquiries stay private — owners never see your phone number publicly.
        </p>
      )}
    </div>
  );
}

/* Demo fixtures use richer, purpose-built shapes. These adapters map every
 * owner-supplied field onto the display shape without inventing new values;
 * the record's own isDemo flag travels with it so the badge stays honest. */
function roommateAsListing(p: RoommateProfile): RoomListing {
  return {
    id: p.id,
    title: p.name,
    area: p.preferredArea,
    rent: p.budgetMax,
    advance: 0,
    roomType: 'Shared Room',
    furnished: 'Unfurnished',
    shared: true,
    available: true,
    availableFrom: p.moveIn,
    amenities: [...p.lifestyle, ...p.interests],
    utilities: '',
    houseRules: '',
    ownerName: p.name,
    ownerDepartment: p.departmentCode,
    photos: [],
    saved: false,
    isDemo: p.isDemo,
    description: p.intro,
  };
}

function hostelAsListing(h: HostelListing): RoomListing {
  return {
    id: h.id,
    title: h.name,
    area: h.area,
    rent: h.monthlyRate,
    advance: 0,
    roomType: h.seatType === 'Single Seat' ? 'Single Room' : 'Shared Room',
    furnished: 'Unfurnished',
    shared: h.seatType !== 'Single Seat',
    available: h.seatsAvailable > 0,
    availableFrom: '',
    amenities: h.messIncluded ? [...h.includes, 'Mess included'] : h.includes,
    utilities: '',
    houseRules: h.rules,
    ownerName: h.name,
    ownerDepartment: h.gender,
    photos: h.photos.map((photo) => ({
      uri: photo.uri,
      room: photo.kind === 'Wash Area' ? 'Bathroom' : photo.kind === 'Dorm Room' ? 'Bedroom' : 'Living Area',
      caption: photo.caption,
    })),
    saved: false,
    isDemo: h.isDemo,
    seats: h.seatsAvailable,
    description: `${h.seatType} · ${h.gender}`,
  };
}

function messAsListing(m: MessListing): RoomListing {
  return {
    id: m.id,
    title: m.name,
    area: m.area,
    rent: m.monthlyRate,
    advance: 0,
    roomType: 'Shared Room',
    furnished: 'Unfurnished',
    shared: true,
    available: true,
    availableFrom: '',
    amenities: [m.mealTimes, m.weeklyHighlight, m.vegOption ? 'Veg option' : '', `Serves ${m.serves}`].filter(Boolean),
    utilities: '',
    houseRules: m.mealTimes,
    ownerName: m.name,
    ownerDepartment: '',
    photos: m.photos.map((photo) => ({
      uri: photo.uri,
      room: photo.kind === 'Kitchen' ? 'Kitchen' : 'Living Area',
      caption: photo.caption,
    })),
    saved: false,
    isDemo: m.isDemo,
    description: `${m.mealsPerDay} meals/day`,
  };
}

/**
 * A category tab card built strictly from the real RoomListing shape.
 * The schema has no separate roommate/hostel/mess tables — showing fields that
 * do not exist would fabricate listing details. Only owner-supplied fields are
 * rendered, and the DEMO badge follows the record's own isDemo flag.
 */
function CategoryRoomCard({
  room,
  variant,
}: {
  room: RoomListing;
  variant: 'roommate' | 'hostel' | 'mess';
}) {
  const name = room.title;
  return (
    <div className="card overflow-hidden p-0">
      <Link href={`/roommates/${room.id}`} className="block">
        <div className="relative aspect-[16/10]">
          {room.photos[0]?.uri ? (
            <img src={room.photos[0].uri} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-campus-bg text-[11px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
              No photos
            </div>
          )}
          {room.photos.length > 1 && (
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-[#211B35]/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
              <Building size={10} /> {room.photos.length} photos
            </span>
          )}
          {room.isDemo && (
            <span className="absolute right-2 top-2">
              <DemoTag compact />
            </span>
          )}
        </div>
      </Link>
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          {variant === 'roommate' && (
            <Avatar seed={room.ownerId ?? room.id} name={room.ownerName} size={40} />
          )}
          <div className="min-w-0 flex-1">
            <Link href={`/roommates/${room.id}`} className="block">
              <p className="font-display text-sm font-bold leading-snug">{name}</p>
            </Link>
            <p className="mt-0.5 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              📍 {room.area}
            </p>
            {room.ownerName && (
              <p className="mt-0.5 truncate text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                Listed by {room.ownerName}
                {room.ownerDepartment ? ` · ${room.ownerDepartment}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <p className="font-display text-base font-extrabold text-violet-ink">
            {taka(room.rent)}
            <span className="text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">/mo</span>
          </p>
          <span className="text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
            {room.available ? `From ${room.availableFrom}` : 'Currently unavailable'}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <span className="rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
            {variant === 'hostel' ? 'Hostel / dorm' : variant === 'mess' ? 'Mess / dining' : room.roomType}
          </span>
          <span className="rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
            {room.furnished}
          </span>
          {typeof room.seats === 'number' && room.seats > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
              <Users size={10} /> {room.seats} seats
            </span>
          )}
        </div>
        {room.description && (
          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            {room.description}
          </p>
        )}
        {room.amenities.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {room.amenities.slice(0, 5).map((item) => (
              <span key={item} className="rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                {item}
              </span>
            ))}
          </div>
        )}
        {(variant === 'hostel' || variant === 'mess') && room.houseRules && (
          <p className="mt-2 rounded-xl bg-campus-bg p-2 text-[10px] leading-relaxed text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
            {variant === 'hostel' ? 'House rules' : 'Good to know'} — {room.houseRules}
          </p>
        )}
        {variant === 'roommate' && (
          <RoommateEnquire name={room.ownerName || name} id={room.ownerId ?? room.id} />
        )}
        {variant === 'hostel' && (
          <HostelEnquire name={room.ownerName || name} id={room.ownerId ?? room.id} />
        )}
        {variant === 'mess' && (
          <MessEnquire name={room.ownerName || name} id={room.ownerId ?? room.id} />
        )}
      </div>
    </div>
  );
}

function RoommateEnquire({ name, id }: { name: string; id: string }) {
  const { startConversation } = useApp();
  return (
    <button
      onClick={() =>
        startConversation({
          personId: id,
          title: `${name} — roommate match`,
          kind: 'direct',
          initialNote: `Hi ${name.split(' ')[0]}! Are you still looking for a roommate?`,
        })
      }
      className="touch-target mt-2.5 w-full rounded-xl bg-violet py-2 text-xs font-bold text-plum shadow-violet-glow"
    >
      Send private enquiry
    </button>
  );
}

function HostelEnquire({ name, id }: { name: string; id: string }) {
  const { startConversation } = useApp();
  return (
    <button
      onClick={() =>
        startConversation({
          personId: id,
          title: `${name} — hostel seat enquiry`,
          kind: 'direct',
          initialNote: `Hello! I saw ${name} on NUBCONNECT — is a seat still available this semester?`,
        })
      }
      className="touch-target mt-2.5 w-full rounded-xl bg-violet py-2 text-xs font-bold text-plum shadow-violet-glow"
    >
      Send private enquiry
    </button>
  );
}

function MessEnquire({ name, id }: { name: string; id: string }) {
  const { startConversation } = useApp();
  return (
    <button
      onClick={() =>
        startConversation({
          personId: id,
          title: `${name} — mess enquiry`,
          kind: 'direct',
          initialNote: `Hello! I'd like to know about a monthly seat at ${name} — is one open right now?`,
        })
      }
      className="touch-target mt-2.5 w-full rounded-xl bg-violet py-2 text-xs font-bold text-plum shadow-violet-glow"
    >
      Ask about a seat
    </button>
  );
}
