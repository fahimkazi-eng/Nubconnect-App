'use client';

// ============================================================================
// More — the sixth destination. Everything that is not Home / Circle / Chats
// / Room / Marketplace lives here: campus modules, My Pins, account, support.
//
// The pin editor supports three reorder paths so it works for everyone:
//   • Pointer drag on the grip (mouse: immediate; touch: long-press 320ms)
//   • Arrow buttons (keyboard / screen reader)
//   • Reset to the default set
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  CircleHelp,
  GripVertical,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { useApp, ALL_PIN_KEYS } from '@/lib/store';
import { PIN_CATALOG, pinDef } from '@/lib/nav';
import { PIN_ICONS } from '@/components/ui/pinIcons';
import { Avatar, DemoTag } from '@/components/ui/kit';
import type { PinKey } from '@/lib/types';

/* --- Module tile ------------------------------------------------------------ */
function ModuleTile({ pinKey }: { pinKey: PinKey }) {
  const def = pinDef(pinKey);
  const Icon = PIN_ICONS[def.icon] ?? ShieldCheck;
  return (
    <Link
      href={def.href}
      className="card group flex items-start gap-3 p-3.5 transition hover:shadow-lift"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet-ink transition group-hover:bg-violet group-hover:text-plum dark:bg-violet-dark-soft dark:text-violet dark:group-hover:bg-violet dark:group-hover:text-plum">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-sm font-bold">{def.label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-campus-text-sec dark:text-campus-dark-sec">
          {def.blurb}
        </span>
      </span>
    </Link>
  );
}

/* --- My Pins editor --------------------------------------------------------- */
function PinEditor() {
  const { pins, setPins, resetPins } = useApp();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [justReordered, setJustReordered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const indexRef = useRef<number | null>(null);
  const startRef = useRef({ x: 0, y: 0 });

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const beginDrag = (index: number, pointerId: number, target: HTMLElement) => {
    activeRef.current = true;
    indexRef.current = index;
    setDragIndex(index);
    try {
      target.setPointerCapture(pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const onHandleDown = (e: React.PointerEvent<HTMLSpanElement>, index: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'mouse') {
      beginDrag(index, e.pointerId, e.currentTarget);
    } else {
      clearTimer();
      timerRef.current = setTimeout(() => beginDrag(index, e.pointerId, e.currentTarget), 320);
    }
  };

  const onHandleMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!activeRef.current) {
      // Touch long-press pending: if the finger wanders, the user wants to
      // scroll — cancel the pending drag.
      if (timerRef.current && Math.hypot(e.clientX - startRef.current.x, e.clientY - startRef.current.y) > 10) {
        clearTimer();
      }
      return;
    }
    const from = indexRef.current;
    if (from == null) return;
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-pin-index]');
    const over = row ? Number((row as HTMLElement).dataset.pinIndex) : null;
    if (over == null || Number.isNaN(over) || over === from || over < 0 || over >= pins.length) return;
    const next = [...pins];
    const [moved] = next.splice(from, 1);
    next.splice(over, 0, moved!);
    indexRef.current = over;
    setDragIndex(over);
    setPins(next);
  };

  const endDrag = () => {
    clearTimer();
    if (activeRef.current) setJustReordered(true);
    activeRef.current = false;
    indexRef.current = null;
    setDragIndex(null);
  };

  const movePin = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= pins.length) return;
    const next = [...pins];
    [next[index], next[j]] = [next[j]!, next[index]!];
    setPins(next);
    setJustReordered(true);
  };

  const addPin = (key: PinKey) => {
    if (!pins.includes(key)) {
      setPins([...pins, key]);
      setJustReordered(true);
    }
  };

  const removePin = (key: PinKey) => {
    setPins(pins.filter((p) => p !== key));
    setJustReordered(true);
  };

  const available = ALL_PIN_KEYS.filter((k) => !pins.includes(k));

  return (
    <section id="pins" className="card scroll-mt-20 p-4" aria-labelledby="pins-h">
      <div className="mb-1 flex items-center justify-between">        <h2 id="pins-h" className="font-display text-sm font-bold">
          My Pins
        </h2>
        <span className="text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
          {justReordered ? 'Saved to this device.' : 'Shown first in your sidebar and here.'}
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        Drag the grip to reorder — press and hold on touch. Or use the arrows. Pinning never removes your six primary
        destinations.
      </p>

      <ul className="space-y-1.5">
        {pins.map((key, i) => {
          const def = pinDef(key);
          const dragging = dragIndex === i;
          return (
            <li
              key={key}
              data-pin-index={i}
              className={`flex items-center gap-1.5 rounded-xl bg-campus-bg p-2.5 transition dark:bg-campus-dark-elev ${
                dragging ? 'z-10 scale-[1.01] shadow-lift ring-2 ring-violet' : ''
              }`}
            >
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Reorder ${def.label}`}
                onPointerDown={(e) => onHandleDown(e, i)}
                onPointerMove={onHandleMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={endDrag}
                className="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-campus-text-sec active:cursor-grabbing dark:text-campus-dark-sec"
              >
                <GripVertical size={15} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{def.label}</span>
              <button
                onClick={() => movePin(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${def.label} up`}
                className="touch-target flex h-8 w-8 items-center justify-center rounded-lg bg-campus-card text-campus-text-sec ring-1 ring-campus-border disabled:opacity-30 dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
              >
                <ArrowUp size={13} />
              </button>
              <button
                onClick={() => movePin(i, 1)}
                disabled={i === pins.length - 1}
                aria-label={`Move ${def.label} down`}
                className="touch-target flex h-8 w-8 items-center justify-center rounded-lg bg-campus-card text-campus-text-sec ring-1 ring-campus-border disabled:opacity-30 dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
              >
                <ArrowDown size={13} />
              </button>
              <button
                onClick={() => removePin(key)}
                aria-label={`Unpin ${def.label}`}
                className="touch-target flex h-8 w-8 items-center justify-center rounded-lg bg-coral-soft text-coral-ink dark:bg-coral/15 dark:text-coral"
              >
                <Minus size={13} />
              </button>
            </li>
          );
        })}
      </ul>

      {available.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
            Pin more destinations
          </p>
          <div className="flex flex-wrap gap-1.5">
            {available.map((key) => {
              const def = PIN_CATALOG.find((p) => p.key === key)!;
              return (
                <button
                  key={key}
                  onClick={() => addPin(key)}
                  className="flex items-center gap-1 rounded-full bg-campus-bg px-3 py-1.5 text-[11px] font-bold text-campus-text-sec ring-1 ring-campus-border transition hover:text-violet-ink dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border"
                >
                  <Plus size={10} /> {def.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3">
        <button
          onClick={() => {
            resetPins();
            setJustReordered(false);
          }}
          className="touch-target flex items-center gap-1.5 rounded-xl bg-campus-bg px-3 py-2 text-[11px] font-bold ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border"
        >
          <RotateCcw size={12} className="text-violet-ink" /> Reset pins
        </button>
      </div>
    </section>
  );
}

/* --- Page --------------------------------------------------------------------- */
export default function MorePage() {
  const { user, theme, toggleTheme, isDemoUser, adminAccess } = useApp();

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">More</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Everything else on your campus — in one place.
        </p>
      </header>

      {/* Account */}
      <section className="card flex items-center gap-3 p-4" aria-label="Your account">
        <Avatar seed={user.id} name={user.name} size={44} src={user.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {user.name} {isDemoUser && <DemoTag compact />}
          </p>
          <p className="truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
            @{user.username} • {user.departmentCode} {user.semester}
          </p>
        </div>
        <Link
          href={`/profile/${user.username}`}
          className="shrink-0 rounded-xl bg-violet px-3.5 py-2 text-xs font-bold text-plum shadow-violet-glow"
        >
          Profile
        </Link>
      </section>

      {/* Campus modules */}
      <section aria-labelledby="modules-h">
        <h2 id="modules-h" className="mb-2 px-1 font-display text-sm font-bold">
          Campus
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(['department', 'academic', 'events', 'honours', 'opportunities', 'lost-found', 'campus-services'] as PinKey[]).map(
            (k) => (
              <ModuleTile key={k} pinKey={k} />
            ),
          )}
        </div>
      </section>

      {/* Yours */}
      <section aria-labelledby="yours-h">
        <h2 id="yours-h" className="mb-2 px-1 font-display text-sm font-bold">
          Yours
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(['saved', 'passport', 'notifications', 'search', 'settings'] as PinKey[]).map((k) => (
            <ModuleTile key={k} pinKey={k} />
          ))}
        </div>
      </section>

      <PinEditor />

      {/* Administration — only rendered when the database says the caller holds
          an administrative role. Hiding it is convenience, not security: the
          RPCs behind /admin authorize every call themselves. */}
      {adminAccess.is_admin && (
        <section aria-labelledby="admin-h">
          <h2 id="admin-h" className="mb-2 px-1 font-display text-sm font-bold">
            Administration
          </h2>
          <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
            <Link href="/admin" className="flex items-center gap-3 p-3.5 text-sm font-semibold">
              <ShieldCheck size={17} className="shrink-0 text-violet-ink" />
              Command centre
              <span className="ml-auto text-[11px] font-normal text-campus-text-sec dark:text-campus-dark-sec">
                People, content, reports, flags
              </span>
            </Link>
          </div>
        </section>
      )}

      {/* Support */}
      <section aria-labelledby="support-h">
        <h2 id="support-h" className="mb-2 px-1 font-display text-sm font-bold">
          Support
        </h2>
        <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
          <Link href="/privacy" className="flex items-center gap-3 p-3.5 text-sm font-semibold">
            <ShieldCheck size={17} className="shrink-0 text-violet-ink" />
            Privacy &amp; safety
            <span className="ml-auto text-[11px] font-normal text-campus-text-sec dark:text-campus-dark-sec">
              How your data stays yours
            </span>
          </Link>
          <Link href="/help" className="flex items-center gap-3 p-3.5 text-sm font-semibold">
            <CircleHelp size={17} className="shrink-0 text-violet-ink" />
            Help &amp; FAQ
            <span className="ml-auto text-[11px] font-normal text-campus-text-sec dark:text-campus-dark-sec">
              Guides and answers
            </span>
          </Link>
          <div className="flex items-center gap-3 p-3.5">
            {theme === 'dark' ? <Sun size={17} className="shrink-0 text-violet-ink" /> : <Moon size={17} className="shrink-0 text-violet-ink" />}
            <span className="text-sm font-semibold">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="ml-auto rounded-xl bg-violet px-3.5 py-2 text-xs font-bold text-plum"
            >
              Switch
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
