'use client';

// Create a room listing — multi-photo with room-kind categories, captions,
// reordering, cover selection, rent/advance/utilities/amenities/house rules.
// Photo-only release: image picker only, no video controls anywhere (§2.4).
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Send, X } from 'lucide-react';
import { useApp } from '@/lib/store';
import { isBackendConfigured } from '@/lib/supabase';
import { DemoTag } from '@/components/ui/kit';
import { taka } from '@/lib/format';
import { isPublishableListing } from '@/lib/privacy';
import type { RoomListing } from '@/lib/types';

const ROOM_KINDS = ['Bedroom', 'Kitchen', 'Bathroom', 'Living Area'] as const;
const ROOM_TYPES = ['Single Room', 'Shared Room', '1-bed Flat', '2-bed Flat', 'Studio'] as const;
const FURNISHED = ['Fully Furnished', 'Semi-Furnished', 'Unfurnished'] as const;
const AREA_PRESETS = [
  'Ashkona (Near Hajj Camp)',
  'Nikunja 2',
  'Khilkhet',
  'Bashundhara R/A Block C',
  'Bashundhara R/A Block D',
  'Beraid',
  'Near Airport Road',
];

interface Draft {
  title: string;
  area: string;
  rent: string;
  advance: string;
  roomType: string;
  furnished: string;
  shared: boolean;
  seats: string;
  availableFrom: string;
  utilities: string;
  description: string;
  amenities: string[];
  houseRules: string[];
}

interface DraftPhoto {
  file: File;
  uri: string;
  kind: (typeof ROOM_KINDS)[number];
  caption: string;
}

export default function NewRoomListingPage() {
  const router = useRouter();
  const { addRoomListing, user, pushToast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<Draft>({
    title: '',
    area: '',
    rent: '',
    advance: '',
    roomType: 'Shared Room',
    furnished: 'Semi-Furnished',
    shared: true,
    seats: '2',
    availableFrom: '',
    utilities: 'Gas, water & electricity billed separately',
    description: '',
    amenities: ['Wi-Fi', 'Attached bathroom'],
    houseRules: ['No smoking indoors'],
  });
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [publishing, setPublishing] = useState(false);
  const configured = isBackendConfigured();

  const AMENITY_OPTIONS = [
    'Wi-Fi',
    'Attached bathroom',
    'Balcony',
    'Reading desk',
    'Wardrobe',
    'AC',
    'Geyser',
    'Parking',
    'Security guard',
    'Lift',
    'Independent entry',
    'Servant quarter',
  ];
  const RULE_OPTIONS = [
    'No smoking indoors',
    'Visitors allowed in common areas only',
    'Vegetarian-friendly kitchen',
    'Quiet hours after 11 PM',
    'No loud music',
    'Guests stay with prior notice',
  ];

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const pickPhotos = (files: FileList | null) => {
    if (!files) return;
    Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 12 - photos.length)
      .forEach((f) => {
        setPhotos((p) => [
          ...p,
          { file: f, uri: URL.createObjectURL(f), kind: 'Bedroom', caption: '' },
        ]);
      });
  };

  const move = (i: number, dir: -1 | 1) => {
    setPhotos((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const copy = [...p];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });
  };

  const validate = (): string | null => {
    if (draft.title.trim().length < 6) return 'Add a clear title (at least 6 characters).';
    if (!draft.area.trim()) return 'Pick a general area (never your exact street address).';
    if (!draft.rent.trim() || Number.isNaN(Number(draft.rent)) || Number(draft.rent) < 500)
      return 'Enter a monthly rent in ৳.';
    if (photos.length === 0) return 'Add at least one photo (photo-only release).';
    if (draft.description.trim().length < 20) return 'Describe the room in at least 20 characters.';
    if (!isPublishableListing({ area: draft.area.trim(), description: draft.description.trim() })) {
      return 'Remove exact house/road numbers and phone numbers — share those privately in messages.';
    }
    return null;
  };

  const publish = async () => {
    const problem = validate();
    if (problem) {
      pushToast(problem, 'warning');
      return;
    }
    setPublishing(true);
    const id = await addRoomListing(
      {
        title: draft.title.trim(),
        area: draft.area.trim(),
        rent: Number(draft.rent),
        advance: Number(draft.advance || 0),
        roomType: draft.roomType as RoomListing['roomType'],
        furnished: draft.furnished as RoomListing['furnished'],
        shared: draft.shared,
        available: true,
        availableFrom: draft.availableFrom || 'Now',
        amenities: draft.amenities,
        utilities: draft.utilities,
        houseRules: draft.houseRules.join(' • ') || 'Ask the owner for house rules',
        ownerName: user.name,
        ownerDepartment: `${user.departmentCode} ${user.semester}`,
        ownerId: user.id,
        photos: photos.map((p) => ({ uri: p.uri, room: p.kind, caption: p.caption })),
        description: draft.description.trim(),
        seats: draft.shared ? Number(draft.seats || 2) : 1,
        views: 0,
        status: 'Active',
        postedAgo: 'Just now',
      },
      photos.map((p) => p.file),
    );
    setPublishing(false);
    if (id) router.push(`/roommates/${id}`);
  };

  const inputCls =
    'touch-target w-full rounded-xl border border-campus-border bg-campus-card px-3 py-2.5 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text';
  const labelCls = 'mb-1 block text-xs font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec';

  return (
    <div className="space-y-4">
      <Link href="/roommates?tab=mine" className="inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline">
        <ArrowLeft size={14} /> Back to My Listings
      </Link>

      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Create a room listing</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Renting out a seat or flat? Photos, ৳ rent and house rules — your exact address and phone stay private.
        </p>
      </header>

      {/* Photos */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold">Photos ({photos.length}/12)</h2>
          {!configured && <DemoTag compact />}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            pickPhotos(e.target.files);
            e.target.value = '';
          }}
          aria-label="Add photos"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={photos.length >= 12}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-campus-border py-6 text-sm font-semibold text-campus-text-sec transition hover:border-violet hover:text-violet-ink disabled:opacity-40 dark:border-campus-dark-border dark:text-campus-dark-sec"
        >
          <ImagePlus size={22} />
          Add photos — bedroom, kitchen, bathroom, living area
        </button>

        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((p, i) => (
              <div key={p.uri} className="space-y-1.5 rounded-xl bg-campus-bg p-2 dark:bg-campus-dark-elev">
                <div className="relative overflow-hidden rounded-lg">
                  <img src={p.uri} alt="" className="aspect-[4/3] w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded-full bg-violet px-1.5 py-px text-[9px] font-bold text-plum">
                      Cover
                    </span>
                  )}
                  <div className="absolute bottom-1 right-1 flex gap-0.5">
                    <button aria-label="Move left" disabled={i === 0} onClick={() => move(i, -1)} className="hit-pad relative rounded bg-[#211B35]/60 p-1 text-white disabled:opacity-30">
                      <ArrowLeft size={11} />
                    </button>
                    <button aria-label="Remove" onClick={() => setPhotos((ps) => ps.filter((x) => x.uri !== p.uri))} className="hit-pad relative rounded bg-[#211B35]/60 p-1 text-white">
                      <X size={11} />
                    </button>
                    <button aria-label="Move right" disabled={i === photos.length - 1} onClick={() => move(i, 1)} className="hit-pad relative rounded bg-[#211B35]/60 p-1 text-white disabled:opacity-30">
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
                <select
                  value={p.kind}
                  onChange={(e) => setPhotos((ps) => ps.map((x) => (x.uri === p.uri ? { ...x, kind: e.target.value as DraftPhoto['kind'] } : x)))}
                  aria-label="Room kind"
                  className="w-full rounded-lg border border-campus-border bg-white px-1.5 py-1 text-[11px] font-semibold dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text"
                >
                  {ROOM_KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <input
                  value={p.caption}
                  onChange={(e) => setPhotos((ps) => ps.map((x) => (x.uri === p.uri ? { ...x, caption: e.target.value } : x)))}
                  placeholder="Caption (optional)"
                  aria-label="Photo caption"
                  className="w-full rounded-lg border border-campus-border bg-white px-1.5 py-1 text-[11px] dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Basics */}
      <section className="card space-y-3 p-4">
        <h2 className="font-display text-sm font-bold">Basics</h2>
        <div>
          <label className={labelCls} htmlFor="r-title">
            Title
          </label>
          <input id="r-title" value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="1 Seat Available in 3-Bedroom Student Flat" className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="r-area">
            General area (never your exact address)
          </label>
          <input
            id="r-area"
            value={draft.area}
            onChange={(e) => set('area', e.target.value)}
            list="area-presets"
            placeholder="e.g. Nikunja 2"
            className={inputCls}
          />
          <datalist id="area-presets">
            {AREA_PRESETS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          <p className="mt-1 text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
            Listeners see the area only — the exact address is shared in private messages.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="r-rent">
              Monthly rent (৳)
            </label>
            <input id="r-rent" inputMode="numeric" value={draft.rent} onChange={(e) => set('rent', e.target.value.replace(/\D/g, ''))} placeholder="5500" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="r-advance">
              Advance (৳)
            </label>
            <input id="r-advance" inputMode="numeric" value={draft.advance} onChange={(e) => set('advance', e.target.value.replace(/\D/g, ''))} placeholder="10000" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="r-type">
              Room type
            </label>
            <select id="r-type" value={draft.roomType} onChange={(e) => set('roomType', e.target.value)} className={inputCls}>
              {ROOM_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="r-furn">
              Furnishing
            </label>
            <select id="r-furn" value={draft.furnished} onChange={(e) => set('furnished', e.target.value)} className={inputCls}>
              {FURNISHED.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="r-from">
              Available from
            </label>
            <input id="r-from" value={draft.availableFrom} onChange={(e) => set('availableFrom', e.target.value)} placeholder="e.g. 1 December" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="r-seats">
              Arrangement
            </label>
            <select
              id="r-seats"
              value={draft.shared ? draft.seats : 'private'}
              onChange={(e) => {
                if (e.target.value === 'private') {
                  set('shared', false);
                } else {
                  set('shared', true);
                  set('seats', e.target.value);
                }
              }}
              className={inputCls}
            >
              <option value="1">Private (whole room)</option>
              <option value="2">Shared — 2 seats</option>
              <option value="3">Shared — 3 seats</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="r-utils">
            Utilities
          </label>
          <input id="r-utils" value={draft.utilities} onChange={(e) => set('utilities', e.target.value)} className={inputCls} />
        </div>
      </section>

      {/* Description */}
      <section className="card space-y-3 p-4">
        <div>
          <label className={labelCls} htmlFor="r-desc">
            Description
          </label>
          <textarea
            id="r-desc"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            rows={4}
            placeholder="Describe the room, the flat-mates, the atmosphere, and what's nearby…"
            className={`${inputCls} resize-none`}
          />
        </div>
        <div>
          <p className={labelCls}>Amenities</p>
          <div className="flex flex-wrap gap-1.5">
            {AMENITY_OPTIONS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={draft.amenities.includes(a)}
                onClick={() => set('amenities', toggleIn(draft.amenities, a))}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 transition ${
                  draft.amenities.includes(a)
                    ? 'bg-lime-soft text-lime-ink ring-lime/40 dark:bg-lime/15 dark:text-lime'
                    : 'bg-campus-bg text-campus-text-sec ring-campus-border dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border'
                }`}
              >
                {draft.amenities.includes(a) && <Check size={10} className="mr-1 inline" />}
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={labelCls}>House rules</p>
          <div className="flex flex-wrap gap-1.5">
            {RULE_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={draft.houseRules.includes(r)}
                onClick={() => set('houseRules', toggleIn(draft.houseRules, r))}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 transition ${
                  draft.houseRules.includes(r)
                    ? 'bg-violet-soft text-violet-ink ring-violet/40 dark:bg-violet-dark-soft dark:text-violet'
                    : 'bg-campus-bg text-campus-text-sec ring-campus-border dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border'
                }`}
              >
                {draft.houseRules.includes(r) && <Check size={10} className="mr-1 inline" />}
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Publish */}
      <div className="card flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          <span>
            {photos.length} photo{photos.length === 1 ? '' : 's'} • {draft.rent ? `${taka(Number(draft.rent))}/mo` : 'rent not set'}
          </span>
          {!configured && <DemoTag compact />}
        </div>
        <button
          onClick={publish}
          disabled={publishing}
          className="touch-target flex items-center justify-center gap-2 rounded-2xl bg-violet py-3 text-sm font-bold text-plum shadow-violet-glow transition active:scale-[0.98] disabled:opacity-50"
        >
          <Send size={16} />
          {publishing ? 'Publishing…' : 'Publish listing'}
        </button>
        <p className="text-center text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
          Listings start as Active. Pause, mark reserved or archive anytime from My Listings.
        </p>
      </div>
    </div>
  );
}
