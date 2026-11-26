'use client';

// ============================================================================
// NUBCONNECT — Generic content media manager (departments, circles).
//
// Crop, preview and persist logo/cover imagery through the authorized covers
// bucket (owner-scoped paths) and an RPC that enforces permissions server-side
// (migration 020). `onSave` receives the field key and either the uploaded
// public URL or null (removal); it must persist via the authorized RPC and
// return an error string or null.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { uploadMedia } from '@/lib/storage/client';
import { useApp } from '@/lib/store';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 8 * 1024 * 1024;

export type MediaFieldKey = 'logo' | 'avatar' | 'cover';

export interface MediaField {
  key: MediaFieldKey;
  title: string;
  hint: string;
  aspectLabel: string;
  canvasWidth: number;
  canvasHeight: number;
  currentUrl: string | null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be decoded as an image.'));
    };
    image.src = url;
  });
}

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
  const baseScale = Math.max(width / image.width, height / image.height);
  const scale = baseScale * zoom;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const maxOffsetX = Math.max(0, (drawWidth - width) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - height) / 2);
  const clampedX = Math.min(maxOffsetX, Math.max(-maxOffsetX, offsetX));
  const clampedY = Math.min(maxOffsetY, Math.max(-maxOffsetY, offsetY));
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, (width - drawWidth) / 2 + clampedX, (height - drawHeight) / 2 + clampedY, drawWidth, drawHeight);
}

function CropDialog({
  field,
  image,
  onCancel,
  onCommit,
}: {
  field: MediaField;
  image: HTMLImageElement;
  onCancel: () => void;
  onCommit: (file: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) drawCrop(canvas, image, zoom, offset.x, offset.y);
  }, [image, zoom, offset]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const beginDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, ox: offset.x, oy: offset.y };
  };

  const moveDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const ratio = canvas.width / (canvas.clientWidth || canvas.width);
    setOffset({
      x: drag.ox + (event.clientX - drag.startX) * ratio,
      y: drag.oy + (event.clientY - drag.startY) * ratio,
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#211B35]/50 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={`Adjust ${field.title.toLowerCase()}`}>
      <div className="glass-strong safe-bottom w-full max-w-lg rounded-3xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-sm font-bold">Adjust {field.title.toLowerCase()}</p>
          <button onClick={onCancel} aria-label="Cancel" className="touch-target flex items-center justify-center rounded-full text-campus-text-sec hover:bg-black/5 dark:text-campus-dark-sec dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className={`mx-auto overflow-hidden rounded-2xl bg-campus-dark-elev ring-1 ring-campus-border dark:ring-campus-dark-border ${field.canvasWidth === field.canvasHeight ? 'aspect-square max-w-[300px]' : 'aspect-[8/3]'}`}>
          <canvas
            ref={canvasRef}
            width={field.canvasWidth}
            height={field.canvasHeight}
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
          <span>Zoom</span>
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
          <button
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              canvas.toBlob(
                (blob) => blob && onCommit(new File([blob], `media-${field.key}-${Date.now()}.jpg`, { type: 'image/jpeg' })),
                'image/jpeg',
                0.9,
              );
            }}
            className="touch-target flex-1 rounded-xl bg-violet py-2.5 text-xs font-bold text-plum shadow-violet-glow"
          >
            <Check size={13} className="mr-1 inline" /> Use this
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrgMediaManager({
  title,
  subtitle,
  fields,
  canEdit,
  onSave,
}: {
  title: string;
  subtitle: string;
  fields: MediaField[];
  canEdit: boolean;
  /** Persist one field. `file` is null when removing. Return null on success, or an error message. */
  onSave: (key: MediaFieldKey, file: File | null, uploadedUrl: string | null) => Promise<string | null>;
}) {
  const { pushToast } = useApp();
  const [busy, setBusy] = useState<MediaFieldKey | null>(null);
  const [crop, setCrop] = useState<{ field: MediaField; image: HTMLImageElement } | null>(null);

  const pickFile = async (field: MediaField, file: File) => {
    if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      pushToast('Choose a JPEG, PNG or WebP image.', 'warning');
      return;
    }
    if (file.size > MAX_BYTES) {
      pushToast(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — keep it under ${MAX_BYTES / 1024 / 1024} MB.`, 'warning');
      return;
    }
    try {
      const image = await loadImage(file);
      setCrop({ field, image });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'That file could not be decoded as an image.', 'warning');
    }
  };

  const persist = async (field: MediaField, file: File | null, uploadedUrl: string | null) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      pushToast('Accounts are not configured on this deployment.', 'warning');
      return;
    }

    let urlToSave = uploadedUrl;
    if (file) {
      setBusy(field.key);
      const uploaded = await uploadMedia(supabase, { kind: 'cover', file });
      if (!uploaded.ok || !uploaded.data?.url) {
        setBusy(null);
        setCrop(null);
        pushToast(uploaded.ok ? 'The upload returned no URL — please try again.' : uploaded.error, 'warning');
        return;
      }
      urlToSave = uploaded.data.url;
    } else {
      setBusy(field.key);
    }

    const error = await onSave(field.key, file, urlToSave);
    setBusy(null);
    setCrop(null);
    if (error) {
      pushToast(error, 'warning');
      return;
    }
    pushToast(file ? `${field.title} saved.` : `${field.title} removed.`, 'success');
  };

  return (
    <section className="card p-4" aria-labelledby="org-media-h">
      <h2 id="org-media-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
        <ImagePlus size={15} className="text-violet-ink" /> {title}
      </h2>
      <p className="mt-0.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{subtitle}</p>
      <div className="mt-3 space-y-3">
        {fields.map((field) => {
          const aspect = field.canvasWidth === field.canvasHeight ? 'aspect-square max-w-[140px]' : 'aspect-[8/3]';
          return (
            <div key={field.key} className="rounded-2xl border border-campus-border bg-campus-bg p-3 dark:border-campus-dark-border dark:bg-campus-dark-elev">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold">{field.title}</p>
                  <p className="mt-0.5 text-[10px] font-semibold leading-snug text-campus-text-sec dark:text-campus-dark-sec">
                    {field.hint} Accepted: JPEG, PNG, WebP · max {MAX_BYTES / 1024 / 1024} MB · {field.aspectLabel}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/jpeg,image/png,image/webp';
                    input.onchange = () => {
                      const file = input.files?.[0];
                      if (file) void pickFile(field, file);
                    };
                    input.click();
                  }}
                  disabled={!canEdit || busy === field.key}
                  className="touch-target shrink-0 rounded-xl bg-campus-card px-3 py-2 text-[11px] font-bold ring-1 ring-campus-border transition hover:ring-violet disabled:cursor-not-allowed disabled:opacity-50 dark:bg-campus-dark-card dark:ring-campus-dark-border"
                >
                  {busy === field.key ? <Loader2 size={13} className="animate-spin" /> : field.currentUrl ? 'Change' : 'Upload'}
                </button>
              </div>
              <div className={`mt-2 overflow-hidden rounded-xl ring-1 ring-campus-border dark:ring-campus-dark-border ${aspect}`}>
                {field.currentUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={field.currentUrl} alt={`${field.title} preview`} className="h-full w-full object-cover" />
                ) : (
                  <div className={`flex h-full items-center justify-center bg-gradient-to-br ${field.canvasWidth === field.canvasHeight ? 'from-aqua to-violet' : 'from-violet via-aqua to-lime'} text-white/70`}>
                    <ImagePlus size={22} />
                  </div>
                )}
              </div>
              {field.currentUrl && (
                <button
                  onClick={() => void persist(field, null, null)}
                  disabled={!canEdit || busy === field.key}
                  className="mt-2 flex items-center gap-1 text-[11px] font-bold text-coral-ink transition hover:underline disabled:opacity-50 dark:text-coral"
                >
                  <Trash2 size={12} /> Remove {field.title.toLowerCase()}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {crop && (
        <CropDialog
          field={crop.field}
          image={crop.image}
          onCancel={() => { URL.revokeObjectURL(crop.image.src); setCrop(null); }}
          onCommit={(file) => void persist(crop.field, file, null)}
        />
      )}
    </section>
  );
}
