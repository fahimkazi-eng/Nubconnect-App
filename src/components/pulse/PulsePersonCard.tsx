'use client';

// ============================================================================
// CAMPUS PULSE — a person who is around right now.
//
// Everything shown here is what the student published about themselves: their
// chosen status, a short line, a general area, and when it expires. The card
// never implies a precise location, and it disappears when the status does.
// ============================================================================
import Link from 'next/link';
import { Clock, Handshake, MapPin, MessageCircle, Send, UserCheck, UserPlus } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Avatar } from '@/components/ui/kit';
import { remainingMinutes, type PulseAvailability } from '@/lib/pulse';

export default function PulsePersonCard({ entry }: { entry: PulseAvailability }) {
  const { isFollowing, toggleFollow, startConversation } = useApp();
  const following = isFollowing(entry.userId);
  const minutes = remainingMinutes(entry.expiresAt);

  const sayHello = () => {
    void startConversation({
      personId: entry.userId,
      title: entry.name,
      initialNote: `Hi ${entry.name.split(' ')[0]}! I saw you on Campus Pulse — ${entry.status.label.toLowerCase()}.`,
    });
  };

  const invite = () => {
    void startConversation({
      personId: entry.userId,
      title: entry.name,
      initialNote: `Hi ${entry.name.split(' ')[0]}! I'm putting a small plan together on Campus Pulse — want to join?`,
    });
  };

  return (
    <article className="card p-3.5">
      <div className="flex items-start gap-3">
        <Link href={`/profile/${entry.username}`} className="shrink-0">
          <Avatar seed={entry.userId} name={entry.name} size={44} src={entry.avatarUrl} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/profile/${entry.username}`}
              className="truncate font-display text-sm font-bold hover:underline"
            >
              {entry.isMine ? `${entry.name} (you)` : entry.name}
            </Link>
            <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[10px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
              {entry.status.emoji} {entry.status.label}
            </span>
          </div>
          <p className="truncate text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
            {entry.departmentCode} • {entry.semester}
            {entry.onCampus && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-lime-soft px-1.5 py-px text-[9px] font-bold text-lime-ink dark:bg-lime/15 dark:text-lime">
                <MapPin size={8} /> On campus
              </span>
            )}
            {entry.openToConnect && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-aqua-soft px-1.5 py-px text-[9px] font-bold text-aqua-ink dark:bg-aqua/10 dark:text-aqua">
                <Handshake size={8} /> Open to Connect
              </span>
            )}
          </p>

          {entry.message && (
            <p className="mt-1.5 text-[12px] leading-snug">{entry.message}</p>
          )}

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
            {entry.spot && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin size={9} /> {entry.spot}
              </span>
            )}
            <span className="inline-flex items-center gap-0.5">
              <Clock size={9} /> {minutes} min left
            </span>
          </p>
        </div>
      </div>

      {!entry.isMine && (
        <div className="mt-3 flex gap-1.5">
          <button
            onClick={sayHello}
            className="touch-target flex flex-1 items-center justify-center gap-1 rounded-xl bg-violet py-2 text-[11px] font-bold text-plum shadow-violet-glow transition active:scale-[0.98]"
          >
            <MessageCircle size={12} /> Say hello
          </button>
          <button
            onClick={() => toggleFollow(entry.userId)}
            aria-pressed={following}
            className={`touch-target flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold transition ${
              following
                ? 'bg-lime-soft text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime'
                : 'bg-campus-bg text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border'
            }`}
          >
            {following ? <UserCheck size={12} /> : <UserPlus size={12} />}
            {following ? 'Following' : 'Follow'}
          </button>
          <button
            onClick={invite}
            aria-label={`Invite ${entry.name} to an activity`}
            className="touch-target flex items-center justify-center rounded-xl bg-campus-bg px-3 ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border"
          >
            <Send size={13} className="text-violet-ink dark:text-violet" />
          </button>
        </div>
      )}
    </article>
  );
}
