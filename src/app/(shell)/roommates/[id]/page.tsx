'use client';

// Room detail — full photo tour grouped by room kind, rent/advance/utilities,
// amenities, house rules. Shows the GENERAL AREA only; exact addresses and
// phone numbers are never public — contact happens through a private
// enquiry conversation (§11 privacy).
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BedDouble,
  Calendar,
  Check,
  Coins,
  Flag,
  Heart,
  Home,
  Info,
  MessageCircle,
  Ruler,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { DEMO_PEOPLE, DEMO_ROOMS } from '@/lib/demo/dataset';
import { loadRoomListingById } from '@/lib/listings';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { Avatar, DemoTag, EmptyState, Lightbox, VerifiedBadge } from '@/components/ui/kit';
import { taka } from '@/lib/format';
import type { RoomListing } from '@/lib/types';

const KIND_ORDER = ['Bedroom', 'Kitchen', 'Bathroom', 'Living Area'] as const;
const KIND_ICONS: Record<string, React.ReactNode> = {
  Bedroom: <BedDouble size={14} />,
  Kitchen: <Home size={14} />,
  Bathroom: <Users size={14} />,
  'Living Area': <Users size={14} />,
};

export default function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { myRooms, saved, toggleSaveRoom, startConversation, reportContent } = useApp();
  const backend = isBackendConfigured();
  const savedKey = saved.rooms.join(',');
  const [realRoom, setRealRoom] = useState<RoomListing | null>(null);
  const [loading, setLoading] = useState(backend);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [enquirySent, setEnquirySent] = useState(false);
  const [enquiring, setEnquiring] = useState(false);
  const [viewingSent, setViewingSent] = useState(false);
  const [requestingViewing, setRequestingViewing] = useState(false);

  useEffect(() => {
    let active = true;
    if (!backend) {
      setRealRoom(null);
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
    void loadRoomListingById(client, id, saved.rooms)
      .then((row) => {
        if (active) setRealRoom(row);
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
        Loading room…
      </div>
    );
  }

  const room = backend
    ? (realRoom ?? myRooms.find((r) => r.id === id))
    : [...myRooms, ...DEMO_ROOMS].find((r) => r.id === id);
  if (!room) notFound();

  const isMine = myRooms.some((r) => r.id === room.id);
  const isSaved = saved.rooms.includes(room.id);
  const photos = room.photos;
  const ownerId =
    room.ownerId ??
    DEMO_PEOPLE.find((p) => p.name === room.ownerName)?.id ??
    `owner-${room.id}`;
  const owner = backend ? null : DEMO_PEOPLE.find((p) => p.id === ownerId);

  const openRoomChat = (initialNote: string) =>
    startConversation({
      personId: ownerId,
      title: `${room.title} — room enquiry`,
      kind: 'direct',
      context: {
        href: `/roommates/${room.id}`,
        thumb: photos[0]?.uri ?? '',
        title: room.title,
        price: `${taka(room.rent)}/month`,
        status: room.available ? 'Available' : 'Unavailable',
      },
      initialNote,
    });

  const enquire = async () => {
    setEnquiring(true);
    // Only claim the enquiry was sent when a conversation was really opened.
    const conversationId = await openRoomChat(
      `Hi! I'm interested in “${room.title}” (${room.area}). Is it still available from ${room.availableFrom}?`,
    );
    setEnquiring(false);
    if (conversationId) setEnquirySent(true);
  };

  // A viewing request is a real conversation carrying the same listing
  // context — not a detached form that vanishes into an inbox.
  const requestViewing = async () => {
    setRequestingViewing(true);
    const conversationId = await openRoomChat(
      `Hi! I'd like to arrange a viewing of “${room.title}” (${room.area}). What days and times suit you?`,
    );
    setRequestingViewing(false);
    if (conversationId) setViewingSent(true);
  };

  return (
    <div className="space-y-4">
      <Link href="/roommates" className="inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline">
        <ArrowLeft size={14} /> Back to rooms
      </Link>

      {/* Photo tour header */}
      <div className="card overflow-hidden p-0">
        <div className="relative aspect-[16/10]">
          <button onClick={() => setLightbox(0)} className="h-full w-full" aria-label="Open photo tour">
            <img src={photos[0]?.uri} alt="" className="h-full w-full object-cover" />
          </button>
          {photos.length > 1 && (
            <button
              onClick={() => setLightbox(0)}
              className="absolute bottom-3 right-3 rounded-full bg-[#211B35]/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur"
            >
              View all {photos.length} photos
            </button>
          )}
          {room.isDemo && (
            <span className="absolute right-3 top-3">
              <DemoTag />
            </span>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-lg font-extrabold leading-tight sm:text-xl">{room.title}</h1>
              <p className="mt-0.5 text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                📍 {room.area} — exact address shared privately after you connect
              </p>
            </div>
            <button
              onClick={() => toggleSaveRoom(room.id)}
              aria-pressed={isSaved}
              aria-label={isSaved ? 'Unsave room' : 'Save room'}
              className={`touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                isSaved ? 'bg-coral-soft text-coral-ink dark:bg-coral/15 dark:text-coral' : 'bg-campus-bg text-campus-text-sec dark:bg-campus-dark-card dark:text-campus-dark-sec'
              }`}
            >
              <Heart size={19} className={isSaved ? 'fill-current' : ''} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="font-display text-2xl font-extrabold text-violet-ink">
              {taka(room.rent)}
              <span className="text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">/month</span>
            </p>
            <p className="flex items-center gap-1 text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              <Coins size={13} /> Advance {taka(room.advance)}
            </p>
            <p className="flex items-center gap-1 text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              <Ruler size={13} /> Utilities: {room.utilities}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold sm:grid-cols-4">
            <span className="flex items-center gap-1.5 rounded-xl bg-campus-bg px-2.5 py-2 dark:bg-campus-dark-elev">
              <BedDouble size={14} className="text-violet-ink" /> {room.roomType}
            </span>
            <span className="flex items-center gap-1.5 rounded-xl bg-campus-bg px-2.5 py-2 dark:bg-campus-dark-elev">
              <Home size={14} className="text-violet-ink" /> {room.furnished}
            </span>
            <span className="flex items-center gap-1.5 rounded-xl bg-campus-bg px-2.5 py-2 dark:bg-campus-dark-elev">
              <Users size={14} className="text-violet-ink" /> {room.shared ? `Shared (${room.seats ?? 2} seats)` : 'Private'}
            </span>
            <span className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 ${room.available ? 'bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime' : 'bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec'}`}>
              <Calendar size={14} /> {room.available ? `From ${room.availableFrom}` : 'Full'}
            </span>
          </div>

          {!isMine && (
            <div className="mt-4 space-y-2">
              {viewingSent ? (
                <div className="rounded-2xl bg-aqua-soft p-3 text-center text-sm font-bold text-aqua-ink dark:bg-aqua/15 dark:text-aqua">
                  Viewing request sent — arrange a time in Messages.
                </div>
              ) : enquirySent ? (
                <div className="rounded-2xl bg-lime-soft p-3 text-center text-sm font-bold text-lime-ink dark:bg-lime/15 dark:text-lime">
                  Enquiry sent — continue the conversation in Messages.
                </div>
              ) : (
                <>
                  <button
                    onClick={() => void enquire()}
                    disabled={enquiring}
                    className="touch-target btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-violet py-3 text-sm font-bold text-plum shadow-violet-glow disabled:cursor-wait disabled:opacity-70"
                  >
                    <MessageCircle size={16} /> {enquiring ? 'Opening chat…' : 'Send private enquiry'}
                  </button>
                  <button
                    onClick={() => void requestViewing()}
                    disabled={requestingViewing}
                    className="touch-target btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-campus-card py-2.5 text-sm font-bold text-campus-text ring-1 ring-campus-border transition hover:ring-violet disabled:cursor-wait disabled:opacity-70 dark:bg-campus-dark-card dark:text-campus-dark-text dark:ring-campus-dark-border"
                  >
                    <Calendar size={15} className="text-violet-ink" /> {requestingViewing ? 'Opening chat…' : 'Request a viewing'}
                  </button>
                </>
              )}
              <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                <ShieldCheck size={12} className="text-lime-ink dark:text-lime" />
                Your phone number stays private — everything happens through NUBCONNECT messages.
              </p>
              <button
                onClick={() => reportContent('this room listing', { targetType: 'roommate_listing', targetId: room.id, reason: 'spam' })}
                className="mt-1 flex w-full items-center justify-center gap-1.5 text-[11px] font-semibold text-campus-text-sec transition hover:text-coral dark:text-campus-dark-sec"
              >
                <Flag size={11} /> Report this listing
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Photo tour by room kind */}
      <section aria-label="Photo tour">
        <h2 className="mb-2 flex items-center gap-2 px-1 font-display text-[15px] font-bold">
          <Home size={16} className="text-violet-ink" /> Photo tour
        </h2>
        <div className="card space-y-4 p-4">
          {KIND_ORDER.filter((k) => photos.some((p) => p.room === k)).map((kind) => {
            const ofKind = photos.filter((p) => p.room === kind);
            return (
              <div key={kind}>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                  {KIND_ICONS[kind]} {kind}
                </h3>
                <div className={`grid gap-2 ${ofKind.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {ofKind.map((p) => (
                    <button
                      key={p.uri}
                      onClick={() => setLightbox(photos.indexOf(p))}
                      className="relative overflow-hidden rounded-xl"
                      aria-label={`Open ${kind} photo${p.caption ? ` — ${p.caption}` : ''}`}
                    >
                      <img src={p.uri} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                      {p.caption && (
                        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-[#211B35]/70 to-transparent px-2 pb-1.5 pt-4 text-left text-[10px] font-semibold text-white">
                          {p.caption}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {photos.length === 0 && (
            <EmptyState icon={<Home size={22} />} title="No photos yet" body="The owner hasn't added photos to this listing." />
          )}
        </div>
      </section>

      {/* Description + amenities + rules */}
      <div className="card space-y-4 p-4">
        {room.description && (
          <div>
            <h3 className="mb-1 font-display text-sm font-bold">About this room</h3>
            <p className="text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{room.description}</p>
          </div>
        )}

        <div>
          <h3 className="mb-1.5 font-display text-sm font-bold">Amenities</h3>
          <div className="flex flex-wrap gap-1.5">
            {room.amenities.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full bg-lime-soft px-2.5 py-1 text-[11px] font-bold text-lime-ink dark:bg-lime/15 dark:text-lime">
                <Check size={11} /> {a}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-1.5 font-display text-sm font-bold">House rules</h3>
          <ul className="space-y-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
            {room.houseRules.split('•').map((r) => (
              <li key={r} className="flex items-start gap-2">
                <Info size={13} className="mt-1 shrink-0 text-violet-ink" />
                {r.trim()}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Posted by */}
      <div className="card p-4">
        <h3 className="mb-2 font-display text-sm font-bold">Posted by</h3>
        <div className="flex items-center gap-3">
          <Avatar seed={ownerId} name={room.ownerName} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{room.ownerName}</p>
            <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">{room.ownerDepartment}</p>
          </div>
          {!backend && owner?.isVerified && <VerifiedBadge label="Officially Verified" />}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          Contact details stay private until you connect through an enquiry.
        </p>
      </div>

      <Lightbox photos={photos.map((p) => p.uri)} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
    </div>
  );
}
