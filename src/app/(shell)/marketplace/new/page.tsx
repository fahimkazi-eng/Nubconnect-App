'use client';

// Create a marketplace listing — multi-photo with cover + reorder, 9
// categories, ৳ price, condition, general pickup area, review + publish.
// Photo-only release: image picker only, never video (§2.4).
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Send, X } from 'lucide-react';
import { useApp } from '@/lib/store';
import { isBackendConfigured } from '@/lib/supabase';
import { DemoTag } from '@/components/ui/kit';
import { taka } from '@/lib/format';
import type { MarketplaceCategory } from '@/lib/types';

const CATEGORIES: MarketplaceCategory[] = [
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
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'] as const;

interface PickedPhoto {
  file: File;
  url: string;
}
const PICKUP_PRESETS = [
  'Permanent Campus — CSE Building',
  'Permanent Campus — EEE Building',
  'Permanent Campus — Central Library',
  'Permanent Campus Gym',
  'Ashkona (Near Hajj Camp)',
  'Nikunja 2',
  'Dakshinkhan Bazar Road',
];

export default function NewMarketplaceListingPage() {
  const router = useRouter();
  const { addProductListing, user, pushToast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('Books & Academic');
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>('Good');
  const [pickupArea, setPickupArea] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [publishing, setPublishing] = useState(false);
  const configured = isBackendConfigured();

  const pickPhotos = (files: FileList | null) => {
    if (!files) return;
    const next: PickedPhoto[] = [];
    Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 6 - photos.length)
      .forEach((f) => next.push({ file: f, url: URL.createObjectURL(f) }));
    if (next.length) setPhotos((p) => [...p, ...next]);
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
    if (title.trim().length < 5) return 'Give the item a clear title (at least 5 characters).';
    if (!price.trim() || Number.isNaN(Number(price)) || Number(price) < 1) return 'Enter a price in ৳.';
    if (photos.length === 0) return 'Add at least one photo (photo-only release).';
    if (!pickupArea.trim()) return 'Choose a general pickup point on or near campus.';
    if (description.trim().length < 15) return 'Describe the item in at least 15 characters.';
    return null;
  };

  const publish = async () => {
    const problem = validate();
    if (problem) {
      pushToast(problem, 'warning');
      return;
    }
    setPublishing(true);
    const id = await addProductListing(
      {
        title: title.trim(),
        price: Number(price),
        category,
        condition,
        description: description.trim(),
        pickupArea: pickupArea.trim(),
        sellerId: user.id,
        sellerName: user.name,
        sellerDepartment: `${user.departmentCode} ${user.semester}`,
        status: 'Active',
        createdAt: new Date().toISOString(),
        photos: photos.map((p) => p.url),
      },
      photos.map((p) => p.file),
    );
    setPublishing(false);
    if (id) router.push(`/marketplace/${id}`);
  };

  const inputCls =
    'touch-target w-full rounded-xl border border-campus-border bg-campus-card px-3 py-2.5 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text';
  const labelCls = 'mb-1 block text-xs font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec';

  return (
    <div className="space-y-4">
      <Link href="/marketplace?tab=mine" className="inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline">
        <ArrowLeft size={14} /> Back to My Listings
      </Link>

      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Create a listing</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Photos, ৳ price, condition and a campus pickup point. Meet on campus; keep chats in NUBCONNECT.
        </p>
      </header>

      {/* Photos */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold">Photos ({photos.length}/6)</h2>
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
          disabled={photos.length >= 6}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-campus-border py-6 text-sm font-semibold text-campus-text-sec transition hover:border-violet hover:text-violet-ink disabled:opacity-40 dark:border-campus-dark-border dark:text-campus-dark-sec"
        >
          <ImagePlus size={22} />
          Add photos — the first one becomes the cover
        </button>

        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl">
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                {i === 0 && photos.length > 1 && (
                  <span className="absolute left-1 top-1 rounded-full bg-violet/90 px-1.5 py-px text-[9px] font-bold text-plum">
                    Cover
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-gradient-to-t from-black/60 to-transparent p-1">
                  <button aria-label="Move left" disabled={i === 0} onClick={() => move(i, -1)} className="hit-pad relative rounded p-0.5 text-white disabled:opacity-30">
                    <ArrowLeft size={12} />
                  </button>
                  <button aria-label="Remove" onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))} className="hit-pad relative rounded p-0.5 text-white">
                    <X size={12} />
                  </button>
                  <button aria-label="Move right" disabled={i === photos.length - 1} onClick={() => move(i, 1)} className="hit-pad relative rounded p-0.5 text-white disabled:opacity-30">
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Details */}
      <section className="card space-y-3 p-4">
        <div>
          <label className={labelCls} htmlFor="m-title">
            Title
          </label>
          <input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cengage Physics for Engineers — clean copy" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="m-price">
              Price (৳)
            </label>
            <input id="m-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="900" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="m-cond">
              Condition
            </label>
            <select id="m-cond" value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)} className={inputCls}>
              {CONDITIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <p className={labelCls}>Category</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 transition ${
                  category === c
                    ? 'bg-violet text-plum ring-violet'
                    : 'bg-campus-bg text-campus-text-sec ring-campus-border dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border'
                }`}
              >
                {category === c && <Check size={10} className="mr-1 inline" />}
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="m-pickup">
            Pickup point (general area — never your home address)
          </label>
          <input
            id="m-pickup"
            value={pickupArea}
            onChange={(e) => setPickupArea(e.target.value)}
            list="pickup-presets"
            placeholder="e.g. Permanent Campus — Central Library"
            className={inputCls}
          />
          <datalist id="pickup-presets">
            {PICKUP_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelCls} htmlFor="m-desc">
            Description
          </label>
          <textarea
            id="m-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What is it, how old, why are you selling…"
            className={`${inputCls} resize-none`}
          />
        </div>
      </section>

      {/* Publish */}
      <div className="card flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          <span>
            {photos.length} photo{photos.length === 1 ? '' : 's'} • {price ? taka(Number(price)) : 'price not set'} • {condition}
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
          Listings start Active. Pause, reserve, mark sold or archive from the item page anytime.
        </p>
      </div>
    </div>
  );
}
