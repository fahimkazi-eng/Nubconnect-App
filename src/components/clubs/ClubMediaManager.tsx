'use client';

// ============================================================================
// NUBCONNECT — Club media management (logo + cover).
//
// Only rendered for club managers. Upload path: file → canvas crop →
// `uploadMedia(kind: 'cover')` (the authorized covers bucket, owner-scoped) →
// `organizations.cover_url` / `organizations.logo_url` via the existing
// organizations RLS update path (club reps may edit these columns; they can
// never touch verification_status). Every step reports failures honestly;
// nothing pretends to save before it really persisted.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { useApp } from '@/lib/store';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { uploadMedia } from '@/lib/storage/client';
import { updateClubOrganizationMedia } from '@/lib/clubs';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 8 * 1024 * 1024;

type FieldKind = 'logo' | 'cover';

const FIELD_CONFIG: Record<FieldKind, { title: string; hint: string; aspectLabel: string; width: number; height: number; outputScale: number }> = {
  logo: {
    title: 'Club logo',
    hint: 'A square image works best. Shown in the club directory and on the club page.',
    aspectLabel: '1:1',
    width: 512,
    height: 512,
    outputScale: 1,
  },
  cover: {
    title: 'Cover image',
    hint: 'A wide image for the top of the club page. 1280×480 recommended.',
    aspectLabel: '16:6',
    width: 1280,
    height: 480,
    outputScale: 1,
  },
};

interface LoadedImage {
  element: HTMLImageElement;
}

function loadImageFromFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ element: image });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be decoded as an image.'));
    };
    image.src = url;
  });
}

/** Draw the crop state into the output canvas. */
function drawCrop(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  zoom: number,
  offsetX: number,
  offsetY: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;

  // Base scale makes the image fully cover the canvas (object-fit: cover).
  const baseScale = Math.max(width / image.width, height / image.height);
  const scale = baseScale * zoom;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  // Clamp offsets so the image always covers the canvas.
  const maxOffsetX = Math.max(0, (drawWidth - width) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - height) / 2);
  const clampedX = Math.min(maxOffsetX, Math.max(-maxOffsetX, offsetX));
  const clampedY = Math.min(maxOffsetY, Math.max(-maxOffsetY, offsetY));

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(
    image,
    (width - drawWidth) / 2 + clampedX,
    (height - drawHeight) / 2 + clampedY,
    drawWidth,
    drawHeight,
  );
}

function CropModal({
  kind,
  image,
  onCancel,
  onCommit,
}: {
  kind: FieldKind;
  image: LoadedImage;
  onCancel: () => void;
  onCommit: (file: File) => void;
}) {
  const config = FIELD_CONFIG[kind];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCrop(canvas, image.element, zoom, offset.x, offset.y);
  }, [image, zoom, offset]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const beginDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const moveDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Convert screen-pointer pixels to canvas pixels using the ratio.
    const canvas = canvasRef.current;
    const ratio = canvas ? canvas.width / canvas.clientWidth : 1;
    setOffset({
      x: drag.ox + (event.clientX - drag.startX) * ratio,
      y: drag.oy + (event.clientY - drag.startY) * ratio,
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `club-${kind}-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCommit(file);
      },
      'image/jpeg',
      0.9,
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#211B35]/50 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={`Adjust ${kind === 'logo' ? 'club logo' : 'cover image'}`}>
      <div className="glass-strong safe-bottom w-full max-w-lg rounded-3xl p-4 sm:max-w-2xl">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-sm font-bold">Adjust the {kind === 'logo' ? 'logo' : 'cover image'}</p>
          <button onClick={onCancel} aria-label="Cancel" className="touch-target flex items-center justify-center rounded-full text-campus-text-sec hover:bg-black/5 dark:text-campus-dark-sec dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className={`relative mx-auto w-full overflow-hidden rounded-2xl bg-campus-dark-elev ring-1 ring-campus-border dark:border-campus-dark-border ${kind === 'cover' ? 'aspect-[16/6]' : 'aspect-square max-w-[320px]'}`}>
          <canvas
            ref={canvasRef}
            width={config.width}
            height={config.height}
            className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            aria-label="Drag to reposition the image"
            role="application"
          />
        </div>
        <label className="mt-3 flex items-center gap-3 text-[11px] font-bold text-campus-text-sec dark:text-campus-dark-sec">
          <span className="shrink-0">Zoom</span>
          <input
            type="range"
            min={100}
            max={300}
            value={Math.round(zoom * 100)}
            onChange={(event) => setZoom(Number(event.target.value) / 100)}
            aria-label="Zoom"
            className="w-full accent-violet"
          />
        </label>
        <div className="mt-3 flex gap-2">
          <button onClick={onCancel} className="touch-target flex-1 rounded-xl bg-campus-bg py-2.5 text-xs font-bold ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border">
            Cancel
          </button>
          <button onClick={commit} className="touch-target flex-1 rounded-xl bg-violet py-2.5 text-xs font-bold text-plum shadow-violet-glow">
            <Check size={13} className="mr-1 inline" /> Use this {kind === 'logo' ? 'logo' : 'cover'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaField({
  field,
  currentUrl,
  disabled,
  busy,
  onPickFile,
  onRemove,
}: {
  field: FieldKind;
  currentUrl: string | null;
  disabled: boolean;
  busy: string | null;
  onPickFile: (field: FieldKind, file: File) => void;
  onRemove: (field: FieldKind) => void;
}) {
  const config = FIELD_CONFIG[field];
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onPickFile(field, file);
  };

  const isCover = field === 'cover';
  const pending = busy === field;

  return (
    <div className="rounded-2xl border border-campus-border bg-campus-bg p-3 dark:border-campus-dark-border dark:bg-campus-dark-elev">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold">{config.title}</p>
          <p className="mt-0.5 text-[10px] font-semibold leading-snug text-campus-text-sec dark:text-campus-dark-sec">
            {config.hint} Accepted: JPEG, PNG, WebP · max {MAX_BYTES / 1024 / 1024} MB · {config.aspectLabel}
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={pick}
          aria-label={`Upload ${config.title.toLowerCase()}`}
          disabled={disabled || pending}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled || pending}
          className="touch-target shrink-0 rounded-xl bg-campus-card px-3 py-2 text-[11px] font-bold ring-1 ring-campus-border transition hover:ring-violet disabled:cursor-not-allowed disabled:opacity-50 dark:bg-campus-dark-card dark:ring-campus-dark-border"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : currentUrl ? 'Change' : 'Upload'}
        </button>
      </div>
      <div className={`mt-2 overflow-hidden rounded-xl ring-1 ring-campus-border dark:ring-campus-dark-border ${isCover ? 'aspect-[16/6]' : 'aspect-square max-w-[140px]'}`}>
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt={`${config.title} preview`} className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full items-center justify-center bg-gradient-to-br ${isCover ? 'from-violet via-aqua to-lime' : 'from-aqua to-violet'} text-white/70`}>
            <ImagePlus size={isCover ? 26 : 22} />
          </div>
        )}
      </div>
      {currentUrl && (
        <button
          onClick={() => onRemove(field)}
          disabled={disabled || pending}
          className="mt-2 flex items-center gap-1 text-[11px] font-bold text-coral-ink transition hover:underline disabled:opacity-50 dark:text-coral"
        >
          <Trash2 size={12} /> Remove {field === 'logo' ? 'logo' : 'cover'}
        </button>
      )}
    </div>
  );
}

export default function ClubMediaManager({
  organizationId,
  logoUrl,
  coverUrl,
  canEdit,
}: {
  organizationId: string;
  logoUrl: string | null;
  coverUrl: string | null;
  canEdit: boolean;
}) {
  const { pushToast, refreshClubs } = useApp();
  const [busy, setBusy] = useState<FieldKind | null>(null);
  const [crop, setCrop] = useState<{ kind: FieldKind; image: LoadedImage } | null>(null);

  const pickFile = async (field: FieldKind, file: File) => {
    if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      pushToast('Choose a JPEG, PNG or WebP image.', 'warning');
      return;
    }
    if (file.size > MAX_BYTES) {
      pushToast(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — keep it under ${MAX_BYTES / 1024 / 1024} MB.`, 'warning');
      return;
    }
    try {
      const image = await loadImageFromFile(file);
      setCrop({ kind: field, image });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'That file could not be decoded as an image.', 'warning');
    }
  };

  const persistMedia = async (field: FieldKind, file: File | null) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !organizationId) {
      pushToast('Club data is not available.', 'warning');
      return;
    }

    // Upload the cropped file (or skip upload when only removing).
    let uploadedUrl: string | null = null;
    if (file) {
      setBusy(field);
      const result = await uploadMedia(supabase, { kind: 'cover', file });
      if (!result.ok || !result.data?.url) {
        setBusy(null);
        pushToast(result.ok ? 'The upload returned no URL — please try again.' : result.error, 'warning');
        return;
      }
      uploadedUrl = result.data.url;
    }

    setBusy(field);
    const update = await updateClubOrganizationMedia(supabase, {
      organizationId,
      ...(field === 'logo' ? { logoUrl: uploadedUrl } : { coverUrl: uploadedUrl }),
    });
    setBusy(null);
    setCrop(null);

    if (update.error) {
      pushToast(update.error, 'warning');
      return;
    }
    pushToast(
      file
        ? `${FIELD_CONFIG[field].title} updated everywhere.`
        : `${FIELD_CONFIG[field].title} removed.`,
      'success',
    );
    await refreshClubs();
  };

  return (
    <section className="card p-4" aria-labelledby="cc-media-h">
      <h2 id="cc-media-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
        <ImagePlus size={15} className="text-violet-ink" /> Club branding
      </h2>
      <p className="mt-0.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        Only club representatives can change the logo and cover. Changes go through the same
        organizations RLS policy as the club details below — verification status is never touched.
      </p>
      <div className="mt-3 space-y-3">
        <MediaField
          field="cover"
          currentUrl={coverUrl}
          disabled={!canEdit}
          busy={busy}
          onPickFile={(field, file) => void pickFile(field, file)}
          onRemove={(field) => void persistMedia(field, null)}
        />
        <MediaField
          field="logo"
          currentUrl={logoUrl}
          disabled={!canEdit}
          busy={busy}
          onPickFile={(field, file) => void pickFile(field, file)}
          onRemove={(field) => void persistMedia(field, null)}
        />
      </div>

      {crop && (
        <CropModal
          kind={crop.kind}
          image={crop.image}
          onCancel={() => { URL.revokeObjectURL(crop.image.element.src); setCrop(null); }}
          onCommit={(file) => void persistMedia(crop.kind, file)}
        />
      )}
    </section>
  );
}
