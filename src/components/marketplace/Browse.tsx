'use client';

// Marketplace — search, 9 category chips, tabs for Recent / Saved / My
// Listings / Enquiries. Prices in ৳ with proper formatting; pickup is a
// general area only. Seller statuses: Active / Paused / Reserved / Sold /
// Archived with transitions managed from My Listings.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Heart, MessageCircle, Package, Plus, Search as SearchIcon, Tag, X } from 'lucide-react';
import { DEMO_MARKETPLACE } from '@/lib/demo/dataset';
import { loadMarketplaceListings } from '@/lib/listings';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { Chip, DemoTag, EmptyState, Tabs } from '@/components/ui/kit';
import { taka, timeAgo } from '@/lib/format';
import type { MarketplaceCategory, MarketplaceListing } from '@/lib/types';

const CATEGORIES: ('All' | MarketplaceCategory)[] = [
  'All',
  'Books & Academic',
  'Electronics',
  'Computers',
  'Furniture',
  'Clothing',
  'Accessories',
  'Sports',
  'Bicycles & Transport',
  'Home Items',
  'Services',
  'Other',
];

export default function MarketplaceBrowse() {
  const params = useSearchParams();
  const initialTab = params.get('tab') ?? 'recent';
  const { saved, toggleSaveProduct, myProducts, startConversation, user } = useApp();

  const [tab, setTab] = useState<'recent' | 'saved' | 'mine' | 'enquiries'>(
    (['recent', 'saved', 'mine', 'enquiries'].includes(initialTab) ? initialTab : 'recent') as
      | 'recent'
      | 'saved'
      | 'mine'
      | 'enquiries',
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | MarketplaceCategory>('All');
  const [deal, setDeal] = useState<'all' | 'free' | 'under1000'>('all');
  const backend = isBackendConfigured();
  const [realListings, setRealListings] = useState<MarketplaceListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(backend);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const savedKey = saved.products.join(',');

  useEffect(() => {
    let active = true;
    if (!backend) {
      setRealListings([]);
      setListingsLoading(false);
      return () => {
        active = false;
      };
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      setListingsLoading(false);
      return () => {
        active = false;
      };
    }

    setListingsLoading(true);
    void loadMarketplaceListings(client, { savedIds: saved.products })
      .then((rows) => {
        if (!active) return;
        setRealListings(rows);
        setListingsError(null);
      })
      .catch(() => {
        if (active) setListingsError('Listings could not be loaded. Please try again.');
      })
      .finally(() => {
        if (active) setListingsLoading(false);
      });
    return () => {
      active = false;
    };
    // savedKey is the stable value of the ids used in the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, savedKey]);

  // Sample listings are a development fixture. On a connected campus the
  // marketplace shows only rows the viewer is allowed to read, plus their own
  // just-published listing.
  const allListings = useMemo(() => {
    if (!backend) return [...myProducts, ...DEMO_MARKETPLACE];
    const byId = new Map<string, MarketplaceListing>();
    for (const listing of [...myProducts, ...realListings]) byId.set(listing.id, listing);
    return [...byId.values()];
  }, [backend, myProducts, realListings]);

  const myListings = useMemo(
    () => (backend ? allListings.filter((l) => l.sellerId === user.id) : myProducts),
    [allListings, backend, myProducts, user.id],
  );

  const listings = useMemo(() => {
    let out = allListings;
    if (category !== 'All') out = out.filter((l) => l.category === category);
    if (deal === 'free') out = out.filter((l) => l.price === 0);
    if (deal === 'under1000') out = out.filter((l) => l.price <= 1000);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.pickupArea.toLowerCase().includes(q),
      );
    }
    if (tab === 'recent') out = out.filter((l) => l.status !== 'Sold' && l.status !== 'Archived');
    if (tab === 'saved') out = out.filter((l) => saved.products.includes(l.id));
    if (tab === 'mine') out = out.filter((l) => myListings.some((m) => m.id === l.id));
    return out;
  }, [allListings, category, deal, query, tab, saved.products, myListings]);

  const savedProducts = allListings.filter((l) => saved.products.includes(l.id));

  const messageSeller = (l: (typeof allListings)[number]) => {
    startConversation({
      personId: l.sellerId,
      title: l.sellerName,
      kind: 'marketplace',
      context: {
        href: `/marketplace/${l.id}`,
        thumb: l.photos[0] ?? '',
        title: l.title,
        price: taka(l.price),
        status: l.status,
      },
      initialNote: `Hi! Is “${l.title}” still available? I can pick up from ${l.pickupArea}.`,
    });
  };

  return (
    <div className="space-y-4">
      <header className="px-1">
        <p className="editorial-kicker mb-1 text-violet-ink dark:text-violet">Student exchange</p>
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Marketplace</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Buy and sell within the NUB student community — ৳ prices, campus pickup points.
        </p>
      </header>

      {/* Search */}
      <div className="relative">
        <SearchIcon size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-campus-text-sec dark:text-campus-dark-sec" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items, categories, pickup areas…"
          aria-label="Search marketplace"
          className="touch-target w-full rounded-2xl border border-campus-border bg-campus-card py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="hit-pad absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-campus-text-sec hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Campus deals quick filters — honest, computed from real listing prices */}
      <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4" aria-label="Campus deals quick filters">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-campus-text-sec dark:text-campus-dark-sec">Campus deals</span>
        <Chip active={deal === 'all'} onClick={() => setDeal('all')}>All prices</Chip>
        <Chip active={deal === 'free'} onClick={() => setDeal('free')}>Free</Chip>
        <Chip active={deal === 'under1000'} onClick={() => setDeal('under1000')}>Under ৳1,000</Chip>
      </div>

      {/* Category chips */}
      <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c === 'All' ? <Tag size={11} /> : null}
            {c}
          </Chip>
        ))}
      </div>

      <Tabs
        tabs={[
          { key: 'recent', label: 'Recent' },
          { key: 'saved', label: 'Saved', count: savedProducts.length },
          { key: 'mine', label: 'My Listings', count: myListings.length },
          { key: 'enquiries', label: 'Enquiries' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {backend && listingsLoading && (
        <div className="card p-4 text-center text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Loading listings…
        </div>
      )}
      {backend && listingsError && (
        <div className="card p-4 text-center text-sm font-semibold text-coral-ink" role="alert">
          {listingsError}
        </div>
      )}

      {(tab === 'recent' || tab === 'saved') && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {listings.map((l) => (
              <div key={l.id} className="card hover-lift overflow-hidden p-0">
                <Link href={`/marketplace/${l.id}`} className="block">
                  <div className="relative aspect-square">
                    {l.photos[0] ? (
                      <img src={l.photos[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-campus-bg text-[11px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                        No photo
                      </div>
                    )}
                    {l.status !== 'Active' && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-[#211B35]/70 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur">
                        {l.status}
                      </span>
                    )}
                    {l.isDemo && (
                      <span className="absolute right-1.5 top-1.5">
                        <DemoTag compact />
                      </span>
                    )}
                  </div>
                </Link>
                <div className="p-2.5">
                  <Link href={`/marketplace/${l.id}`}>
                    <p className="line-clamp-2 min-h-[2.4em] font-display text-[13px] font-bold leading-tight">{l.title}</p>
                    <p className="mt-1 font-display text-[15px] font-extrabold text-violet-ink">{taka(l.price)}</p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                      📍 {l.pickupArea}
                    </p>
                  </Link>
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <button
                      onClick={() => messageSeller(l)}
                      aria-label={`Message seller about ${l.title}`}
                      className="touch-target btn-press flex flex-1 items-center justify-center gap-1 rounded-lg bg-violet py-1.5 text-[11px] font-bold text-plum"
                    >
                      <MessageCircle size={12} /> Message
                    </button>
                    <button
                      onClick={() => toggleSaveProduct(l.id)}
                      aria-pressed={saved.products.includes(l.id)}
                      aria-label={saved.products.includes(l.id) ? 'Unsave item' : 'Save item'}
                      className={`touch-target flex items-center justify-center rounded-lg px-2.5 py-1.5 ${
                        saved.products.includes(l.id)
                          ? 'bg-coral-soft text-coral-ink dark:bg-coral/15 dark:text-coral'
                          : 'bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec'
                      }`}
                    >
                      <Heart size={13} className={saved.products.includes(l.id) ? 'fill-current' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {listings.length === 0 && (
            <EmptyState
              icon={<Package size={22} />}
              title={tab === 'saved' ? 'No saved items yet' : 'Nothing matches'}
              body={
                tab === 'saved'
                  ? 'Tap the heart on any listing to keep it here.'
                  : 'Try a different search or category.'
              }
            />
          )}
        </>
      )}

      {/* MY LISTINGS */}
      {tab === 'mine' && (
        <>
          <Link
            href="/marketplace/new"
            className="touch-target flex items-center justify-center gap-2 rounded-2xl bg-violet py-3 text-sm font-bold text-plum shadow-violet-glow"
          >
            <Plus size={17} /> Create listing
          </Link>
          {myListings.length === 0 ? (
            <EmptyState
              icon={<Package size={22} />}
              title="You haven't listed anything yet"
              body="Finished your textbooks? Outgrew your desk? List it for your campus — photos, ৳ price and a pickup point."
              action={
                <Link href="/marketplace/new" className="touch-target mt-2 rounded-xl bg-violet px-4 py-2.5 text-sm font-bold text-plum">
                  Create listing
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {myListings.map((l) => (
                <div key={l.id} className="card flex items-center gap-3 p-3">
                  <img src={l.photos[0]} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{l.title}</p>
                    <p className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                      {taka(l.price)} • {l.status} • {timeAgo(l.createdAt)}
                    </p>
                  </div>
                  <Link href={`/marketplace/${l.id}`} className="shrink-0 text-[11px] font-bold text-violet-ink hover:underline">
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ENQUIRIES */}
      {tab === 'enquiries' &&
        (backend ? (
          <EmptyState
            icon={<MessageCircle size={22} />}
            title="No enquiries to show"
            body="Messages you send about a listing stay private in Chats. Nothing is invented here."
          />
        ) : (
          <div className="space-y-2">
            {DEMO_MARKETPLACE.slice(0, 3).map((l) => (
              <button
                key={l.id}
                onClick={() => messageSeller(l)}
                className="card flex w-full items-center gap-3 p-3 text-left transition hover:shadow-lift"
              >
                <img src={l.photos[0]} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">Enquiry — {l.title}</p>
                  <p className="truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                    To {l.sellerName} ({l.sellerDepartment})
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-sunshine-soft px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                  Awaiting reply
                </span>
              </button>
            ))}
          </div>
        ))}
      {tab === 'enquiries' && (
        <p className="text-center text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
          All buying conversations happen in Messages — no phone numbers are ever shown publicly.
        </p>
      )}
    </div>
  );
}
