'use client';

// Marketplace item detail — photo gallery with lightbox, ৳ price, condition,
// seller card, message-seller with item context, seller's other listings,
// save, and status controls for the current seller.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Coins,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Package,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import { DEMO_MARKETPLACE, DEMO_PEOPLE } from '@/lib/demo/dataset';
import { loadMarketplaceListingById } from '@/lib/listings';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { Avatar, DemoTag, Lightbox, PhotoGrid } from '@/components/ui/kit';
import { taka, timeAgo } from '@/lib/format';
import type { MarketplaceListing } from '@/lib/types';

export default function MarketplaceItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { myProducts, saved, toggleSaveProduct, startConversation, reportContent, updateProductListing, user } = useApp();
  const backend = isBackendConfigured();
  const savedKey = saved.products.join(',');
  const [realListing, setRealListing] = useState<MarketplaceListing | null>(null);
  const [loading, setLoading] = useState(backend);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [messaged, setMessaged] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offering, setOffering] = useState(false);
  const [offered, setOffered] = useState(false);

  useEffect(() => {
    let active = true;
    if (!backend) {
      setRealListing(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void loadMarketplaceListingById(client, id, saved.products)
      .then((row) => {
        if (active) setRealListing(row);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // savedKey is the stable value of the ids used in the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, id, savedKey]);

  if (loading) {
    return (
      <div className="card p-8 text-center text-sm text-campus-text-sec dark:text-campus-dark-sec">
        Loading listing…
      </div>
    );
  }

  const listing = backend
    ? (realListing ?? myProducts.find((l) => l.id === id))
    : [...myProducts, ...DEMO_MARKETPLACE].find((l) => l.id === id);
  if (!listing) notFound();

  const isMine = myProducts.some((m) => m.id === listing.id) ||
    (backend && listing.sellerId === user.id);
  const isSaved = saved.products.includes(listing.id);
  const seller = backend ? null : DEMO_PEOPLE.find((p) => p.id === listing.sellerId);
  const sellerOther = backend
    ? []
    : DEMO_MARKETPLACE.filter(
        (l) => l.sellerId === listing.sellerId && l.id !== listing.id && l.status === 'Active',
      ).slice(0, 3);

  const openMarketplaceChat = (initialNote: string) =>
    startConversation({
      personId: listing.sellerId,
      title: listing.sellerName,
      kind: 'marketplace',
      context: {
        href: `/marketplace/${listing.id}`,
        thumb: listing.photos[0] ?? '',
        title: listing.title,
        price: taka(listing.price),
        status: listing.status,
      },
      initialNote,
    });

  const messageSeller = async () => {
    setMessaging(true);
    // startConversation returns a conversation id only when a real (or demo)
    // conversation was actually opened; an empty string means it refused.
    const conversationId = await openMarketplaceChat(
      `Hi! Is “${listing.title}” still available? I can pick up from ${listing.pickupArea}.`,
    );
    setMessaging(false);
    if (conversationId) setMessaged(true);
  };

  // An offer is not a price chip pretending to be a deal: it opens a real
  // conversation with the seller's existing listing in it, so both sides
  // see the same context.
  const sendOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(offerAmount);
    if (!Number.isFinite(amount) || amount <= 0 || offering) return;
    setOffering(true);
    const conversationId = await openMarketplaceChat(
      `My offer: ${taka(amount)} for “${listing.title}”. Are you able to accept?`,
    );
    setOffering(false);
    if (conversationId) {
      setOffered(true);
      setOfferOpen(false);
    }
  };

  const setStatus = (status: typeof listing.status) => {
    updateProductListing(listing.id, { status });
    setRealListing((prev) =>
      prev && prev.id === listing.id ? { ...prev, status } : prev,
    );
  };

  return (
    <div className="space-y-4">
      <Link href="/marketplace" className="inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline">
        <ArrowLeft size={14} /> Back to Marketplace
      </Link>

      {/* Gallery */}
      <div className="card overflow-hidden p-0">
        <div className="relative">
          <PhotoGrid photos={listing.photos} onOpen={setLightbox} />
          {listing.isDemo && (
            <span className="absolute right-3 top-3 z-10">
              <DemoTag />
            </span>
          )}
          {listing.status !== 'Active' && (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-[#211B35]/70 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
              {listing.status}
            </span>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-lg font-extrabold leading-tight sm:text-xl">{listing.title}</h1>
              <p className="mt-1 font-display text-2xl font-extrabold text-violet-ink">{taka(listing.price)}</p>
            </div>
            {!isMine && (
              <button
                onClick={() => toggleSaveProduct(listing.id)}
                aria-pressed={isSaved}
                aria-label={isSaved ? 'Unsave item' : 'Save item'}
                className={`touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  isSaved
                    ? 'bg-coral-soft text-coral-ink dark:bg-coral/15 dark:text-coral'
                    : 'bg-campus-bg text-campus-text-sec dark:bg-campus-dark-card dark:text-campus-dark-sec'
                }`}
              >
                <Heart size={19} className={isSaved ? 'fill-current' : ''} />
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className="rounded-full bg-campus-bg px-2.5 py-1 text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
              {listing.category}
            </span>
            <span className="rounded-full bg-campus-bg px-2.5 py-1 text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
              Condition: {listing.condition}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-soft px-2.5 py-1 text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
              <MapPin size={11} /> Pickup: {listing.pickupArea}
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            {listing.description}
          </p>
          <p className="mt-1 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
            Listed {timeAgo(listing.createdAt)} — photos only, no video listings in this release.
          </p>

          {/* Actions */}
          {isMine ? (
            <div className="mt-4 space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                <Pencil size={12} /> Manage your listing
              </p>
              <div className="flex flex-wrap gap-2">
                {listing.status !== 'Paused' && listing.status !== 'Sold' && (
                  <button onClick={() => setStatus('Paused')} className="touch-target rounded-xl bg-campus-bg px-4 py-2.5 text-xs font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                    Pause listing
                  </button>
                )}
                {listing.status === 'Paused' && (
                  <button onClick={() => setStatus('Active')} className="touch-target rounded-xl bg-lime-soft px-4 py-2.5 text-xs font-bold text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime">
                    Resume (Active)
                  </button>
                )}
                {listing.status !== 'Reserved' && listing.status !== 'Sold' && (
                  <button onClick={() => setStatus('Reserved')} className="touch-target rounded-xl bg-sunshine-soft px-4 py-2.5 text-xs font-bold text-amber-700 ring-1 ring-amber-300/50 dark:bg-amber-400/10 dark:text-amber-300">
                    Mark Reserved
                  </button>
                )}
                {listing.status !== 'Sold' && (
                  <button onClick={() => setStatus('Sold')} className="touch-target rounded-xl bg-violet px-4 py-2.5 text-xs font-bold text-plum shadow-violet-glow">
                    Mark Sold
                  </button>
                )}
                <button onClick={() => setStatus('Archived')} className="touch-target rounded-xl bg-campus-bg px-4 py-2.5 text-xs font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border">
                  Archive
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              {listing.status === 'Sold' ? (
                <div className="rounded-2xl bg-campus-bg p-3 text-center text-sm font-bold text-campus-text-sec dark:bg-campus-dark-card dark:text-campus-dark-sec">
                  Already sold — check the seller&apos;s other listings below.
                </div>
              ) : (
                <div className="space-y-2">
                  {offered ? (
                    <div className="rounded-2xl bg-lime-soft p-3 text-center text-sm font-bold text-lime-ink dark:bg-lime/15 dark:text-lime">
                      Your offer was sent — continue in Messages.
                    </div>
                  ) : messaged ? (
                    <div className="rounded-2xl bg-lime-soft p-3 text-center text-sm font-bold text-lime-ink dark:bg-lime/15 dark:text-lime">
                      Message sent — continue in Messages.
                    </div>
                  ) : (
                    <button
                      onClick={() => void messageSeller()}
                      disabled={messaging}
                      className="touch-target btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-violet py-3 text-sm font-bold text-plum shadow-violet-glow disabled:cursor-wait disabled:opacity-70"
                    >
                      <MessageCircle size={16} /> {messaging ? 'Opening chat…' : 'Message seller'}
                    </button>
                  )}
                  {!offered && (
                    <div>
                      <button
                        onClick={() => setOfferOpen((v) => !v)}
                        aria-expanded={offerOpen}
                        className="touch-target btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-campus-card py-2.5 text-sm font-bold text-campus-text ring-1 ring-campus-border transition hover:ring-violet dark:bg-campus-dark-card dark:text-campus-dark-text dark:ring-campus-dark-border"
                      >
                        <Coins size={16} className="text-violet-ink" /> Make an offer
                      </button>
                      {offerOpen && (
                        <form onSubmit={(e) => void sendOffer(e)} className="mt-2 flex gap-2">
                          <label className="sr-only" htmlFor="offer-amount">Offer amount in taka</label>
                          <input
                            id="offer-amount"
                            value={offerAmount}
                            onChange={(e) => setOfferAmount(e.target.value.replace(/[^0-9]/g, ''))}
                            inputMode="numeric"
                            placeholder="e.g. 850"
                            className="touch-target min-w-0 flex-1 rounded-2xl border border-campus-border bg-campus-card px-4 py-2.5 text-sm outline-none focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text"
                            required
                          />
                          <button
                            type="submit"
                            disabled={offering || !offerAmount}
                            className="touch-target btn-press rounded-2xl bg-plum px-5 text-sm font-bold text-lime disabled:cursor-wait disabled:opacity-70"
                          >
                            {offering ? 'Sending…' : 'Send'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => reportContent('this listing', { targetType: 'marketplace_listing', targetId: listing.id, reason: 'spam' })}
                className="mt-2 flex w-full items-center justify-center gap-1.5 text-[11px] font-semibold text-campus-text-sec hover:text-coral dark:text-campus-dark-sec"
              >
                <Flag size={11} /> Report this listing
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Seller card */}
      <div className="card p-4">
        <h2 className="mb-2 font-display text-sm font-bold">Seller</h2>
        <div className="flex items-center gap-3">
          <Avatar seed={listing.sellerId} name={listing.sellerName} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {listing.sellerName} {!backend && seller?.isVerified && <span className="text-violet-ink">✓</span>}
            </p>
            <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
              {listing.sellerDepartment} — {!backend && seller?.isVerified ? 'verified student' : 'NUB student'}
            </p>
          </div>
          {seller && (
            <Link href={`/profile/${seller.username}`} className="shrink-0 text-[11px] font-bold text-violet-ink hover:underline">
              Profile
            </Link>
          )}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          <ShieldCheck size={13} className="mt-px shrink-0 text-lime-ink dark:text-lime" />
          Buyer protection: meet on campus during daylight, check the item before paying, and keep conversations
          in NUBCONNECT messages.
        </p>
      </div>

      {/* Seller's other listings */}
      {sellerOther.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 px-1 font-display text-[15px] font-bold">
            <Package size={16} className="text-violet-ink" /> More from {listing.sellerName.split(' ')[0]}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sellerOther.map((l) => (
              <Link key={l.id} href={`/marketplace/${l.id}`} className="card overflow-hidden p-0">
                <div className="aspect-square">
                  <img src={l.photos[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 min-h-[2.4em] font-display text-[13px] font-bold leading-tight">{l.title}</p>
                  <p className="mt-1 font-display text-[15px] font-extrabold text-violet-ink">{taka(l.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Lightbox photos={listing.photos} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
    </div>
  );
}
