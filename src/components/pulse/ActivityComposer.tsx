'use client';

// ============================================================================
// CAMPUS PULSE — activity composer.
//
// An activity is a real-life plan: a coffee break, a study session, a kickabout.
// It carries a general meeting area (never a private address), a participant
// limit, and a clear joining rule — open to everyone or by the host's approval.
// ============================================================================
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { PULSE_ACTIVITY_CATEGORIES } from '@/lib/pulse';
import { Chip, Modal } from '@/components/ui/kit';

const inputCls =
  'touch-target w-full rounded-xl border border-campus-border bg-campus-card px-3 py-2.5 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text';

const LIMIT_OPTIONS = [2, 4, 6, 10, 20];

/** datetime-local needs a local-time string, not an ISO UTC one. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ActivityComposer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { createActivity } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('coffee_break');
  const [spot, setSpot] = useState('');
  const [startsAt, setStartsAt] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [durationMins, setDurationMins] = useState(60);
  const [participantLimit, setParticipantLimit] = useState(4);
  const [joinMode, setJoinMode] = useState<'open' | 'request'>('open');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setCategory('coffee_break');
    setSpot('');
    setStartsAt(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    setDurationMins(60);
    setParticipantLimit(4);
    setJoinMode('open');
  }, [open]);

  const submit = async () => {
    if (!title.trim() || !spot.trim()) return;
    setSaving(true);
    const result = await createActivity({
      title: title.trim(),
      description: description.trim(),
      category,
      spot: spot.trim(),
      startsAt: new Date(startsAt).toISOString(),
      durationMins,
      participantLimit,
      joinMode,
    });
    setSaving(false);
    if (result.ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Start something">
      <p className="mb-3 text-[13px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        A small plan people can actually show up to. Keep the meeting place general — a building or
        a common area, never a private address.
      </p>

      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        What is it?
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 80))}
        placeholder="e.g. Coffee before the 11am class"
        className={inputCls + ' mb-3'}
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {PULSE_ACTIVITY_CATEGORIES.map((c) => (
          <Chip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
            <span aria-hidden>{c.emoji}</span> {c.label}
          </Chip>
        ))}
      </div>

      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        Details (optional)
      </label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value.slice(0, 280))}
        rows={2}
        placeholder="What should people know?"
        className={inputCls + ' mb-3 resize-none'}
      />

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
            When
          </label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
            Meeting area
          </label>
          <input
            value={spot}
            onChange={(e) => setSpot(e.target.value.slice(0, 60))}
            placeholder="e.g. Campus cafeteria"
            className={inputCls}
          />
        </div>
      </div>

      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        How many people?
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {LIMIT_OPTIONS.map((n) => (
          <Chip key={n} active={participantLimit === n} onClick={() => setParticipantLimit(n)}>
            {n} people
          </Chip>
        ))}
      </div>

      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        How can people join?
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setJoinMode('open')}
          aria-pressed={joinMode === 'open'}
          className={`touch-target rounded-xl border p-2.5 text-left text-xs font-bold transition ${
            joinMode === 'open'
              ? 'border-violet bg-violet-soft dark:bg-violet-dark-soft'
              : 'border-campus-border bg-campus-card dark:border-campus-dark-border dark:bg-campus-dark-card'
          }`}
        >
          Anyone can join
          <span className="mt-0.5 block text-[10px] font-medium text-campus-text-sec dark:text-campus-dark-sec">
            First come, first in
          </span>
        </button>
        <button
          type="button"
          onClick={() => setJoinMode('request')}
          aria-pressed={joinMode === 'request'}
          className={`touch-target rounded-xl border p-2.5 text-left text-xs font-bold transition ${
            joinMode === 'request'
              ? 'border-violet bg-violet-soft dark:bg-violet-dark-soft'
              : 'border-campus-border bg-campus-card dark:border-campus-dark-border dark:bg-campus-dark-card'
          }`}
        >
          Ask me first
          <span className="mt-0.5 block text-[10px] font-medium text-campus-text-sec dark:text-campus-dark-sec">
            You approve each person
          </span>
        </button>
      </div>

      <button
        onClick={submit}
        disabled={saving || !title.trim() || !spot.trim()}
        className="touch-target w-full rounded-xl bg-violet py-3 text-sm font-bold text-plum shadow-violet-glow disabled:opacity-40"
      >
        {saving ? 'Publishing…' : 'Publish activity'}
      </button>
    </Modal>
  );
}
