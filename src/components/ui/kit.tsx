'use client';

// ============================================================================
// NUBCONNECT — Shared UI kit (CAMPUS GLASS primitives)
// Glass is reserved for chrome (sheets, dialogs, floating controls) while
// content stays on solid, readable surfaces.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { portraitScene } from '@/lib/photos';
import { initials } from '@/lib/format';

/* --- Avatar -------------------------------------------------------------- */
export function Avatar({
  seed,
  name,
  size = 44,
  className = '',
  src,
}: {
  seed: string;
  name: string;
  size?: number;
  className?: string;
  /** A student-owned profile photo. Falls back to the generated illustration. */
  src?: string | null;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Generated illustrative avatar — never a real person's photo */}
      <img
        src={src || portraitScene(seed, 96, 96)}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-cover"
        loading="lazy"
        draggable={false}
      />
      <span className="sr-only">{initials(name)}</span>
    </span>
  );
}

/* --- DEMO tag ------------------------------------------------------------- */
export function DemoTag({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-sunshine-soft font-mono font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-300/60 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30 ${
        compact ? 'px-1.5 py-px text-[9px]' : 'px-2 py-0.5 text-[10px]'
      }`}
      title="Demonstration content — clearly-labelled sample, not a real record"
    >
      Demo
    </span>
  );
}

/* --- AnimatedCount ---------------------------------------------------------
 * Smoothly counts between values (requestAnimationFrame, cubic ease-out) for
 * live-feeling counters — reaction totals, "Who's on Campus?" headcounts.
 * Jumps instantly when the user prefers reduced motion.
 */
export function AnimatedCount({
  value,
  className = '',
  duration = 420,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || duration <= 0) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (value - from) * eased);
      // Keep the anchor current so an interrupted animation continues
      // smoothly from wherever it visually got to.
      fromRef.current = current;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={`tabular-nums ${className}`} aria-live="polite">
      {display}
    </span>
  );
}

/* --- Section heading ------------------------------------------------------- */
export function SectionHeading({
  icon,
  title,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-1">
      <h2 className="flex items-center gap-2 font-display text-[15px] font-bold sm:text-base">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

/* --- Chip ------------------------------------------------------------------ */
export function Chip({
  active,
  children,
  onClick,
  className = '',
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`touch-target chip-toggle btn-press inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
        active
          ? 'bg-violet text-plum shadow-violet-glow'
          : 'bg-campus-card text-campus-text-sec ring-1 ring-campus-border hover:bg-violet-soft dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border dark:hover:bg-violet-dark-soft'
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* --- Tabs ------------------------------------------------------------------ */
export function Tabs({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-campus-card p-1 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border ${className}`}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`touch-target chip-toggle btn-press relative flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold sm:text-[13px] ${
            active === t.key
              ? 'bg-violet text-plum shadow-violet-glow'
              : 'text-campus-text-sec hover:bg-violet-soft dark:text-campus-dark-sec dark:hover:bg-violet-dark-soft'
          }`}
        >
          {t.label}
          {typeof t.count === 'number' && t.count > 0 && (
            <span
              className={`ml-1.5 rounded-full px-1.5 py-px text-[10px] font-bold ${
                active === t.key ? 'bg-[#211B35]/35 text-white' : 'bg-coral/15 text-coral-ink dark:bg-coral/10 dark:text-coral'
              }`}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* --- Bottom sheet (glass chrome) ------------------------------------------ */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        aria-label="Close sheet"
        onClick={onClose}
        className="absolute inset-0 bg-[#211B35]/45 backdrop-blur-[2px]"
      />
      <div className="glass-strong safe-bottom absolute inset-x-0 bottom-0 max-h-[85dvh] animate-sheet-up overflow-hidden rounded-t-3xl">
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span className="mx-auto h-1.5 w-10 rounded-full bg-campus-text/15 dark:bg-campus-dark-text/20" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-1">
          <h3 className="font-display text-base font-bold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="touch-target flex items-center justify-center rounded-full text-campus-text-sec hover:bg-black/5 dark:text-campus-dark-sec dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[65dvh] overflow-y-auto px-4 pb-4">{children}</div>
        {footer && <div className="border-t border-campus-border px-4 py-3 dark:border-campus-dark-border">{footer}</div>}
      </div>
    </div>
  );
}

/* --- Full-screen photo viewer -------------------------------------------- */
export function Lightbox({
  photos,
  index,
  onClose,
  onIndex,
}: {
  photos: string[];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex(Math.min(photos.length - 1, index + 1));
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, photos.length, onClose, onIndex]);

  if (index === null || photos.length === 0) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0d0b18]/95" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div className="safe-top flex items-center justify-between px-2 py-2">
        <button
          onClick={onClose}
          aria-label="Close viewer"
          className="touch-target flex items-center justify-center rounded-full text-white/80 hover:bg-white/10"
        >
          <X size={24} />
        </button>
        <span className="font-mono text-xs font-semibold text-white/70">
          {index + 1} / {photos.length}
        </span>
        <span className="w-11" />
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden px-1">
        <img
          src={photos[index]}
          alt=""
          className="max-h-full max-w-full animate-pop rounded-lg object-contain"
          draggable={false}
        />
      </div>
      {photos.length > 1 && (
        <div className="safe-bottom flex items-center justify-between px-2 py-3">
          <button
            aria-label="Previous photo"
            disabled={index === 0}
            onClick={() => onIndex(Math.max(0, index - 1))}
            className="touch-target glass flex items-center justify-center rounded-full text-white disabled:opacity-30"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="no-scrollbar flex max-w-[60vw] gap-2 overflow-x-auto">
            {photos.map((p, i) => (
              <button
                key={i}
                onClick={() => onIndex(i)}
                aria-label={`Photo ${i + 1}`}
                className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                  i === index ? 'ring-violet' : 'ring-transparent opacity-60'
                }`}
              >
                <img src={p} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <button
            aria-label="Next photo"
            disabled={index === photos.length - 1}
            onClick={() => onIndex(Math.min(photos.length - 1, index + 1))}
            className="touch-target glass flex items-center justify-center rounded-full text-white disabled:opacity-30"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </div>
  );
}

/* --- Photo grid: 1 full, 2 split, 3 asymmetric, 4+ grid ------------------- */
export function PhotoGrid({
  photos,
  onOpen,
}: {
  photos: string[];
  onOpen: (index: number) => void;
}) {
  const n = photos.length;
  if (n === 0) return null;
  if (n === 1) {
    return (
      <button
        onClick={() => onOpen(0)}
        className="block w-full overflow-hidden rounded-xl"
        aria-label="Open photo"
      >
        <img src={photos[0]} alt="" className="max-h-[520px] w-full object-cover" loading="lazy" />
      </button>
    );
  }
  if (n === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
        {photos.map((p, i) => (
          <button key={i} onClick={() => onOpen(i)} className="overflow-hidden" aria-label={`Open photo ${i + 1}`}>
            <img src={p} alt="" className="aspect-square w-full object-cover transition hover:brightness-95" loading="lazy" />
          </button>
        ))}
      </div>
    );
  }
  if (n === 3) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
        <button onClick={() => onOpen(0)} className="row-span-2 overflow-hidden" aria-label="Open photo 1">
          <img src={photos[0]} alt="" className="h-full w-full object-cover transition hover:brightness-95" loading="lazy" />
        </button>
        <button onClick={() => onOpen(1)} className="overflow-hidden" aria-label="Open photo 2">
          <img src={photos[1]} alt="" className="aspect-square w-full object-cover transition hover:brightness-95" loading="lazy" />
        </button>
        <button onClick={() => onOpen(2)} className="overflow-hidden" aria-label="Open photo 3">
          <img src={photos[2]} alt="" className="aspect-square w-full object-cover transition hover:brightness-95" loading="lazy" />
        </button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
      {photos.slice(0, 4).map((p, i) => (
        <button key={i} onClick={() => onOpen(i)} className="relative overflow-hidden" aria-label={`Open photo ${i + 1}`}>
          <img src={p} alt="" className="aspect-square w-full object-cover transition hover:brightness-95" loading="lazy" />
          {i === 3 && n > 4 && (
            <span className="absolute inset-0 flex items-center justify-center bg-[#211B35]/55 font-display text-xl font-bold text-white">
              +{n - 4}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* --- Empty state ----------------------------------------------------------- */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-soft text-violet-ink dark:bg-violet-dark-soft">
        {icon}
      </span>
      {/* h2: empty states typically replace a page's first content section
          directly under the h1 — a level that never skips. */}
      <h2 className="font-display text-base font-bold">{title}</h2>
      <p className="max-w-xs text-sm text-campus-text-sec dark:text-campus-dark-sec">{body}</p>
      {action}
    </div>
  );
}

/* --- Feed skeleton --------------------------------------------------------- */
export function PostSkeleton() {
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-3">
        <div className="skeleton h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <div className="skeleton h-3.5 w-40" />
          <div className="skeleton h-3 w-24" />
        </div>
      </div>
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-4/5" />
      <div className="skeleton aspect-[16/10] w-full" />
      <div className="flex gap-4">
        <div className="skeleton h-8 w-16" />
        <div className="skeleton h-8 w-16" />
        <div className="skeleton h-8 w-16" />
      </div>
    </div>
  );
}

/* --- Modal (glass dialog) -------------------------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close dialog" onClick={onClose} className="absolute inset-0 bg-[#211B35]/45 backdrop-blur-[2px]" />
      <div
        className={`glass-strong safe-bottom relative z-10 max-h-[90dvh] w-full animate-sheet-up overflow-y-auto rounded-t-3xl p-5 sm:animate-pop sm:rounded-3xl sm:shadow-lift ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="touch-target flex items-center justify-center rounded-full text-campus-text-sec hover:bg-black/5 dark:text-campus-dark-sec dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* --- Verification badge ----------------------------------------------------- */
/** Tone per verification level — covers the 7-level Club Universe taxonomy
 *  (§7) and the legacy department/roster labels still used elsewhere. */
const VERIFIED_TONES: Record<string, string> = {
  'Officially Verified': 'bg-lime-soft text-lime-ink ring-lime/40 dark:bg-lime/10 dark:text-lime dark:ring-lime/30',
  'Club Verified': 'bg-violet-soft text-violet-ink ring-violet/30 dark:bg-violet/15 dark:text-violet dark:ring-violet/30',
  'Recognized Organization': 'bg-violet-soft text-violet-ink ring-violet/30 dark:bg-violet/15 dark:text-violet dark:ring-violet/30',
  'Department Verified': 'bg-aqua-soft text-aqua-ink ring-aqua/40 dark:bg-aqua/10 dark:text-aqua dark:ring-aqua/30',
  'Department Recognized': 'bg-aqua-soft text-aqua-ink ring-aqua/40 dark:bg-aqua/10 dark:text-aqua dark:ring-aqua/30',
  'Awaiting Verification': 'bg-sunshine-soft text-amber-700 ring-amber-300/50 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30',
};

export function VerifiedBadge({ label }: { label: string }) {
  const tone =
    VERIFIED_TONES[label] ??
    'bg-campus-bg text-campus-text-sec ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${tone}`}>
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
        <path d="M8 1l1.7 1.2 2.1-.2.6 2 1.8 1.1-.9 1.9.9 1.9-1.8 1.1-.6 2-2.1-.2L8 15l-1.7-1.2-2.1.2-.6-2-1.8-1.1.9-1.9-.9-1.9 1.8-1.1.6-2 2.1.2L8 1zm-.9 9.4l4-4-1.2-1.2-2.8 2.8-1.6-1.6-1.2 1.2 2.8 2.8z" />
      </svg>
      {label}
    </span>
  );
}

/* --- Confirm dialog --------------------------------------------------------- */
export function useConfirm() {
  const [state, setState] = useState<{ msg: string; onYes: () => void } | null>(null);
  const confirm = useCallback((msg: string, onYes: () => void) => setState({ msg, onYes }), []);
  const element = state ? (
    <Modal open onClose={() => setState(null)} title="Are you sure?">
      <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">{state.msg}</p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setState(null)}
          className="touch-target flex-1 rounded-xl bg-campus-bg font-semibold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            state.onYes();
            setState(null);
          }}
          className="touch-target flex-1 rounded-xl bg-coral-ink font-semibold text-white"
        >
          Confirm
        </button>
      </div>
    </Modal>
  ) : null;
  return { confirm, confirmElement: element };
}

/* --- Keyboard shortcut hook -------------------------------------------------- */
export function useHotkey(key: string, cb: () => void) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (e.key.toLowerCase() === key.toLowerCase() && (key === 'k' ? (e.ctrlKey || e.metaKey) : true) && !typing) {
        if (key === 'k') e.preventDefault();
        cbRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key]);
}
