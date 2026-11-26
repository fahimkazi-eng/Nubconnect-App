'use client';

// People You May Know — visual cards with Follow / Message.
// The people come from the real directory (public.profiles, filtered by the
// privacy-aware profile policies). When the campus has no other members yet
// the section is simply absent rather than filled with sample students.
import Link from 'next/link';
import { MessageCircle, UserPlus, UserCheck } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Avatar } from '@/components/ui/kit';
import { canMessage } from '@/lib/privacy';

export default function PeopleYouMayKnow() {
  const { isFollowing, toggleFollow, user, startConversation, people } = useApp();

  const suggestions = people.filter((p) => p.discoverable && p.id !== user.id).slice(0, 8);

  if (suggestions.length === 0) return null;

  const message = (personId: string, name: string, isVerified: boolean) => {
    const consent = canMessage(
      { allowMessages: isVerified ? 'University Students Only' : 'Consent Requests Only' },
      true,
    );
    startConversation({
      personId,
      title: name,
      initialNote: `Hi ${name.split(' ')[0]}! Want to connect on NUBCONNECT?`,
    });
    // Note: consent model — verified students open directly, others send a request.
    void consent;
  };

  return (
    <section aria-label="People you may know">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="font-display text-[15px] font-bold sm:text-base">People You May Know</h2>
        <Link href="/circle?tab=people" className="text-xs font-semibold text-violet-ink hover:underline">
          See all
        </Link>
      </div>
      <div className="no-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
        {suggestions.map((p) => {
          const following = isFollowing(p.id);
          return (
            <div
              key={p.id}
              className="card w-[150px] shrink-0 overflow-hidden p-0 sm:w-[168px]"
            >
              <Link href={`/profile/${p.username}`} className="block">
                <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-violet-soft to-aqua-soft dark:from-[#2C2560] dark:to-[#1c2c50]">
                  <Avatar seed={p.id} name={p.name} size={64} />
                </div>
                <div className="p-2.5">
                  <p className="truncate font-display text-[13px] font-bold">{p.name}</p>
                  <p className="truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                    {p.departmentCode} • {p.semester}
                  </p>
                  {p.interests.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded-full bg-campus-bg px-1.5 py-px text-[9px] font-semibold text-campus-text-sec dark:bg-campus-dark-card dark:text-campus-dark-sec">
                        {p.interests[0]}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex gap-1.5 p-2.5 pt-0">
                <button
                  onClick={() => toggleFollow(p.id)}
                  aria-pressed={following}
                  className={`touch-target flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition ${
                    following
                      ? 'bg-lime-soft text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime'
                      : 'bg-violet text-plum shadow-violet-glow'
                  }`}
                >
                  {following ? <UserCheck size={13} /> : <UserPlus size={13} />}
                  {following ? 'Following' : 'Follow'}
                </button>
                <button
                  onClick={() => message(p.id, p.name, p.isVerified)}
                  aria-label={`Message ${p.name}`}
                  className="touch-target flex items-center justify-center rounded-xl bg-campus-bg ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                >
                  <MessageCircle size={15} className="text-violet-ink" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
