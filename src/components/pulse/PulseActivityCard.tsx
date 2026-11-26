'use client';

// ============================================================================
// CAMPUS PULSE — a group activity.
//
// A plan is only as real as its participants: the count, the faces and the
// joining rule all come straight from the database. Nothing here pads numbers.
// ============================================================================
import { useState } from 'react';
import {
  CalendarClock,
  Check,
  Clock,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { Avatar } from '@/components/ui/kit';
import { planStartsIn } from '@/lib/orbit';
import type { PulseActivity } from '@/lib/pulse';

function formatWhen(startsAt: string): string {
  return new Date(startsAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PulseActivityCard({ activity }: { activity: PulseActivity }) {
  const { joinActivity, leaveActivity, requestToJoin, respondToJoinRequest } = useApp();
  const [busy, setBusy] = useState(false);

  const started = new Date(activity.startsAt).getTime() <= Date.now();
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <article className="card p-3.5">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-lg dark:bg-violet-dark-soft"
        >
          {activity.categoryEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display text-sm font-bold leading-tight">{activity.title}</h3>
            {started && (
              <span className="rounded-full bg-lime-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-lime-ink dark:bg-lime/15 dark:text-lime">
                Happening now
              </span>
            )}
            {activity.isFull && !activity.isJoined && (
              <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-coral-ink dark:bg-coral/15 dark:text-coral">
                Full
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
            {activity.categoryLabel} · hosted by {activity.isMine ? 'you' : activity.hostName}
          </p>
        </div>
      </div>

      {activity.description && (
        <p className="mt-2 text-[12px] leading-snug">{activity.description}</p>
      )}

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
        <span className="inline-flex items-center gap-1">
          <CalendarClock size={11} /> {formatWhen(activity.startsAt)}
        </span>
        {!started && (
          <span className="inline-flex items-center gap-1">
            <Clock size={11} /> {planStartsIn(activity.startsAt)}
          </span>
        )}
        {activity.spot && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} /> {activity.spot}
          </span>
        )}
      </p>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="flex -space-x-1.5">
          {activity.participants.slice(0, 4).map((p) => (
            <Avatar
              key={p.userId}
              seed={p.userId}
              name={p.name}
              size={24}
              src={p.avatarUrl}
              className="ring-2 ring-campus-card dark:ring-campus-dark-card"
            />
          ))}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold">
          <Users size={11} />
          {activity.participantCount}
          {activity.participantLimit > 0 && ` / ${activity.participantLimit}`} going
        </span>
        <span className="ml-auto text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          {activity.joinMode === 'request' ? 'Approval required' : 'Open to join'}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-3">
        {activity.isMine ? (
          <div className="rounded-xl bg-campus-bg p-2.5 dark:bg-campus-dark-elev">
            <p className="text-[11px] font-bold">You&apos;re hosting</p>
            {activity.pendingRequests.length === 0 ? (
              <p className="mt-0.5 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                {activity.joinMode === 'request'
                  ? 'No join requests waiting.'
                  : 'Anyone can join — no approval needed.'}
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {activity.pendingRequests.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <Avatar seed={r.userId} name={r.name} size={26} src={r.avatarUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-bold">{r.name}</span>
                      {r.note && (
                        <span className="block truncate text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                          {r.note}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => run(() => respondToJoinRequest(r.id, activity.id, true))}
                      disabled={busy}
                      aria-label={`Accept ${r.name}`}
                      className="touch-target flex h-8 w-8 items-center justify-center rounded-lg bg-lime-soft text-lime-ink ring-1 ring-lime/40 disabled:opacity-40 dark:bg-lime/15 dark:text-lime"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => run(() => respondToJoinRequest(r.id, activity.id, false))}
                      disabled={busy}
                      aria-label={`Decline ${r.name}`}
                      className="touch-target flex h-8 w-8 items-center justify-center rounded-lg bg-coral-soft text-coral-ink disabled:opacity-40 dark:bg-coral/15 dark:text-coral"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : activity.isJoined ? (
          <div className="flex items-center gap-2">
            <span className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-lime-soft py-2.5 text-[11px] font-bold text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime">
              <Check size={13} /> You&apos;re going
            </span>
            <button
              onClick={() => run(() => leaveActivity(activity.id))}
              disabled={busy}
              className="touch-target rounded-xl bg-campus-bg px-3 py-2.5 text-[11px] font-bold text-campus-text-sec ring-1 ring-campus-border disabled:opacity-40 dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border"
            >
              Leave
            </button>
          </div>
        ) : activity.requestStatus === 'pending' ? (
          <p className="rounded-xl bg-sunshine-soft py-2.5 text-center text-[11px] font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
            Request sent — waiting for the host
          </p>
        ) : activity.joinMode === 'request' ? (
          <button
            onClick={() => run(() => requestToJoin(activity.id))}
            disabled={busy || activity.isFull}
            className="touch-target w-full rounded-xl bg-violet py-2.5 text-[11px] font-bold text-plum shadow-violet-glow disabled:opacity-40"
          >
            {activity.isFull ? 'Full' : activity.requestStatus === 'declined' ? 'Ask again' : 'Request to join'}
          </button>
        ) : (
          <button
            onClick={() => run(() => joinActivity(activity.id))}
            disabled={busy || activity.isFull}
            className="touch-target w-full rounded-xl bg-violet py-2.5 text-[11px] font-bold text-plum shadow-violet-glow disabled:opacity-40"
          >
            {activity.isFull ? 'Full' : 'Join activity'}
          </button>
        )}
      </div>
    </article>
  );
}
