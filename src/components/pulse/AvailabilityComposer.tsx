'use client';

// ============================================================================
// CAMPUS PULSE — availability composer.
//
// One flow, shared by Home, Circle and the Pulse page. A student chooses what
// they are offering (free to chat, study together, a coffee break), writes a
// short line, and picks how long it stays. Nothing is tracked: the check-in is
// self-reported, the area is a general place, and the status expires on its own.
//
// Being signed in never means being on campus. "I'm physically on campus" is a
// separate, explicit switch the student controls.
// ============================================================================
import { useEffect, useState } from 'react';
import { Clock, MapPin, ShieldCheck } from 'lucide-react';
import { useApp } from '@/lib/store';
import {
  AVAILABILITY_EXPIRY_OPTIONS,
  AVAILABILITY_STATUSES,
  type PulseAvailability,
} from '@/lib/pulse';
import { Chip, Modal } from '@/components/ui/kit';

const inputCls =
  'touch-target w-full rounded-xl border border-campus-border bg-campus-card px-3 py-2.5 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text';

const VISIBILITY_OPTIONS: { value: PulseAvailability['visibility']; label: string }[] = [
  { value: 'university', label: 'Everyone at my university' },
  { value: 'verified_only', label: 'Verified students only' },
  { value: 'circles', label: 'People in my circles' },
  { value: 'private', label: 'Only me' },
];

export default function AvailabilityComposer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { availability, publishMyAvailability, clearMyAvailability, campusAreas } = useApp();
  const mine = availability.find((a) => a.isMine) ?? null;

  const [statusKey, setStatusKey] = useState('free_to_chat');
  const [message, setMessage] = useState('');
  const [spot, setSpot] = useState('');
  const [campusAreaId, setCampusAreaId] = useState('');
  const [onCampus, setOnCampus] = useState(false);
  const [openToConnect, setOpenToConnect] = useState(false);
  const [expiresInMinutes, setExpiresInMinutes] = useState(120);
  const [visibility, setVisibility] = useState<PulseAvailability['visibility']>('university');
  const [saving, setSaving] = useState(false);

  // Re-open with the student's live status already filled in, so updating is
  // editing instead of retyping.
  useEffect(() => {
    if (!open) return;
    setStatusKey(mine?.status.key ?? 'free_to_chat');
    setMessage(mine?.message ?? '');
    setSpot(mine?.spot ?? '');
    setCampusAreaId(mine?.campusAreaId ?? '');
    setOnCampus(mine?.onCampus ?? false);
    setOpenToConnect(mine?.openToConnect ?? false);
    setExpiresInMinutes(120);
    setVisibility(mine?.visibility ?? 'university');
  }, [open, mine]);

  const submit = async () => {
    setSaving(true);
    const result = await publishMyAvailability({
      statusKey,
      message: message.trim(),
      spot: spot.trim(),
      campusAreaId: campusAreaId || null,
      onCampus,
      openToConnect,
      visibility,
      expiresInMinutes,
    });
    setSaving(false);
    if (result.ok) onClose();
  };

  const takeDown = async () => {
    await clearMyAvailability();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={mine ? 'Update your availability' : 'Share your availability'}>
      <p className="mb-3 text-[13px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        Tell campus what you&apos;re up for. It expires on its own — and you can take it down at any
        moment.
      </p>

      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        What are you up for?
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {AVAILABILITY_STATUSES.map((s) => (
          <Chip key={s.key} active={statusKey === s.key} onClick={() => setStatusKey(s.key)}>
            <span aria-hidden>{s.emoji}</span> {s.label}
          </Chip>
        ))}
      </div>

      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        A short line (optional)
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 120))}
        rows={2}
        placeholder="e.g. Two hours between classes — happy to meet new people"
        className={inputCls + ' mb-1 resize-none'}
      />
      <p className="mb-3 text-right text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
        {message.length}/120
      </p>

      {/* On campus is its own explicit check-in — never inferred from a login. */}
      <button
        type="button"
        onClick={() => setOnCampus((v) => !v)}
        aria-pressed={onCampus}
        className={`touch-target mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
          onCampus
            ? 'border-violet bg-violet-soft dark:bg-violet-dark-soft'
            : 'border-campus-border bg-campus-card dark:border-campus-dark-border dark:bg-campus-dark-card'
        }`}
      >
        <span
          aria-hidden
          className={`flex h-9 w-14 shrink-0 items-center rounded-full px-1 transition ${
            onCampus ? 'justify-end bg-violet' : 'justify-start bg-campus-border dark:bg-campus-dark-border'
          }`}
        >
          <span className="h-7 w-7 rounded-full bg-white shadow-sm" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-sm font-bold">
            <MapPin size={13} /> I&apos;m physically on campus
          </span>
          <span className="block text-[11px] leading-snug text-campus-text-sec dark:text-campus-dark-sec">
            Your own check-in. It expires with your status and never shares a precise location.
          </span>
        </span>
      </button>

      {onCampus && (
        <div className="mb-2 space-y-2">
          {campusAreas.length > 0 ? (
            <>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                General area
              </label>
              <select
                value={campusAreaId}
                onChange={(e) => setCampusAreaId(e.target.value)}
                className={inputCls}
              >
                <option value="">Somewhere on campus</option>
                {campusAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                Where roughly? (general area only)
              </label>
              <input
                value={spot}
                onChange={(e) => setSpot(e.target.value.slice(0, 60))}
                placeholder="e.g. Central Library — 3rd floor"
                className={inputCls}
              />
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpenToConnect((v) => !v)}
        aria-pressed={openToConnect}
        className={`touch-target mb-3 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
          openToConnect
            ? 'border-aqua bg-aqua-soft dark:bg-aqua/10'
            : 'border-campus-border bg-campus-card dark:border-campus-dark-border dark:bg-campus-dark-card'
        }`}
      >
        <span
          aria-hidden
          className={`flex h-9 w-14 shrink-0 items-center rounded-full px-1 transition ${
            openToConnect ? 'justify-end bg-aqua' : 'justify-start bg-campus-border dark:bg-campus-dark-border'
          }`}
        >
          <span className="h-7 w-7 rounded-full bg-white shadow-sm" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold">Open to Connect</span>
          <span className="block text-[11px] leading-snug text-campus-text-sec dark:text-campus-dark-sec">
            Signal that you&apos;re happy to be approached right now.
          </span>
        </span>
      </button>

      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        <Clock size={11} /> Stay on the pulse for
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {AVAILABILITY_EXPIRY_OPTIONS.map((o) => (
          <Chip
            key={o.minutes}
            active={expiresInMinutes === o.minutes}
            onClick={() => setExpiresInMinutes(o.minutes)}
          >
            {o.label}
          </Chip>
        ))}
      </div>

      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        Who can see this?
      </label>
      <select
        value={visibility}
        onChange={(e) => setVisibility(e.target.value as PulseAvailability['visibility'])}
        className={inputCls + ' mb-3'}
      >
        {VISIBILITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <p className="mb-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        <ShieldCheck size={12} className="mt-0.5 shrink-0 text-violet-ink" />
        You are posting this yourself. No GPS, no background tracking, no history — it simply
        disappears when the time is up.
      </p>

      <button
        onClick={submit}
        disabled={saving}
        className="touch-target w-full rounded-xl bg-violet py-3 text-sm font-bold text-plum shadow-violet-glow disabled:opacity-40"
      >
        {saving ? 'Publishing…' : mine ? 'Update my availability' : 'Put me on the pulse'}
      </button>

      {mine && (
        <button
          onClick={takeDown}
          className="touch-target mt-2 w-full rounded-xl bg-campus-bg py-2.5 text-xs font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border"
        >
          Take my status down now
        </button>
      )}
    </Modal>
  );
}
