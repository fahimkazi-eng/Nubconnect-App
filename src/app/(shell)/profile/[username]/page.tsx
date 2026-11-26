'use client';

// Student profile — cover, identity, follow/message actions (kept distinct),
// posts, and circles. My own profile links to settings.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { MessageCircle, VolumeX, Settings, UserCheck, UserPlus, Flag } from 'lucide-react';
import { DEMO_CIRCLES, DEMO_PEOPLE } from '@/lib/demo/dataset';
import { useApp } from '@/lib/store';
import { campusScene, portraitScene } from '@/lib/photos';
import { Avatar, DemoTag, Tabs, VerifiedBadge } from '@/components/ui/kit';
import PostCard from '@/components/feed/PostCard';
import { canMessage } from '@/lib/privacy';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { mapProfileToAppUser, resolveProfileTarget, type ProfileRow } from '@/lib/auth';
import type { AppUser, Person } from '@/lib/types';

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const configured = isBackendConfigured();
  const { isFollowing, toggleFollow, startConversation, user, posts: allPosts, mutedAccountIds, reportContent, isDemoUser, authLoading } = useApp();
  const [tab, setTab] = useState('posts');

  // A real account's own profile lives in public.profiles, not in the demo
  // dataset — resolve it by username once the session is known.
  const [realPerson, setRealPerson] = useState<AppUser | null>(null);
  const [lookupDone, setLookupDone] = useState(false);

  const isSelf = username.toLowerCase() === user.username.toLowerCase();

  useEffect(() => {
    if (authLoading) return;
    if (isSelf) {
      setLookupDone(true);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLookupDone(true);
      return;
    }

    let active = true;
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'id, username, display_name, avatar_url, cover_url, primary_university_id, department_id, semester_label, bio, interests, is_verified_student, is_suspended, departments:department_id(code,name)',
        )
        .eq('username', username.toLowerCase())
        .maybeSingle();

      if (!active) return;
      if (data) setRealPerson(mapProfileToAppUser(data as unknown as ProfileRow));
      setLookupDone(true);
    })();

    return () => {
      active = false;
    };
  }, [authLoading, isSelf, username]);

  const person = resolveProfileTarget<AppUser | Person>(username, {
    self: user,
    realPerson,
    // Demo identities must never be reachable on a connected campus.
    demoPeople: configured ? [] : DEMO_PEOPLE,
  });

  // Never 404 while the session is still resolving — the signed-in student
  // would otherwise see "page not found" for their own profile.
  if (!person) {
    if (authLoading || (!lookupDone && !isDemoUser)) {
      return (
        <div className="space-y-4" aria-busy="true">
          <div className="card overflow-hidden p-0">
            <div className="h-28 animate-pulse bg-campus-bg sm:h-36 dark:bg-campus-dark-card" />
            <div className="space-y-3 p-4">
              <div className="h-20 w-20 -mt-9 animate-pulse rounded-full bg-campus-bg ring-4 ring-white dark:bg-campus-dark-card dark:ring-campus-dark-card" />
              <div className="h-5 w-40 animate-pulse rounded bg-campus-bg dark:bg-campus-dark-card" />
              <div className="h-3 w-56 animate-pulse rounded bg-campus-bg dark:bg-campus-dark-card" />
            </div>
          </div>
        </div>
      );
    }
    notFound();
  }

  const isMe = person.id === user.id;
  const isDemoProfile = !configured &&
    (DEMO_PEOPLE.some((p) => p.id === person.id) || (isDemoUser && isMe));
  const following = isFollowing(person.id);
  const muted = mutedAccountIds.includes(person.id);
  const posts = allPosts.filter((p) => p.authorId === person.id);
  // Circle membership for other students has no real query in this schema;
  // never borrow demo circles on a connected campus.
  const personCircles = configured
    ? []
    : DEMO_CIRCLES.filter((c) =>
        (person as { mutualCircles?: string[] }).mutualCircles?.some((m) => m.toLowerCase().includes(c.name.split(' ')[0]!.toLowerCase())),
      );

  const message = () => {
    startConversation({
      personId: person.id,
      title: person.name,
      initialNote: `Hi ${person.name.split(' ')[0]}! Connecting from NUBCONNECT.`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Cover + identity */}
      <div className="card overflow-hidden p-0">
        <div className="relative h-28 sm:h-36">
          {(person as { coverUrl?: string | null }).coverUrl ? (
            <img
              src={(person as { coverUrl?: string | null }).coverUrl ?? ''}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : configured ? (
            <div className="h-full w-full bg-gradient-to-br from-violet via-aqua to-lime" aria-hidden="true" />
          ) : (
            <img src={campusScene(person.id, 1200, 360)} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        </div>
        <div className="px-4 pb-4">
          <div className="-mt-9 flex items-end justify-between gap-2">
            <span className="rounded-full ring-4 ring-white dark:ring-campus-dark-card">
              <Avatar seed={person.id} name={person.name} size={76} src={(person as { avatarUrl?: string | null }).avatarUrl} />
            </span>
            {isMe ? (
              <Link
                href="/settings/profile"
                className="touch-target flex items-center gap-1.5 rounded-xl bg-campus-bg px-4 py-2 text-xs font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
              >
                <Settings size={14} className="text-violet-ink" /> Edit profile
              </Link>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => toggleFollow(person.id)}
                  aria-pressed={following}
                  className={`touch-target flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    following
                      ? 'bg-lime-soft text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime'
                      : 'bg-violet text-plum shadow-violet-glow'
                  }`}
                >
                  {following ? <UserCheck size={14} /> : <UserPlus size={14} />}
                  {following ? 'Following' : 'Follow'}
                </button>
                <button
                  onClick={message}
                  aria-label={`Message ${person.name}`}
                  className="touch-target flex items-center justify-center rounded-xl bg-campus-bg px-3 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                >
                  <MessageCircle size={15} className="text-violet-ink" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="font-display text-lg font-extrabold sm:text-xl">{person.name}</h1>
              {person.isVerified && <VerifiedBadge label="NUB Verified" />}
              {isDemoProfile && <DemoTag compact />}
              {!isMe && person.isNewAround && <DemoTag compact />}
            </div>
            <p className="font-mono text-xs text-campus-text-sec dark:text-campus-dark-sec">@{person.username}</p>
            <p className="mt-1 text-sm">
              {person.departmentName} • {person.semester}
            </p>
            {person.intro && <p className="mt-1.5 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{person.intro}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {person.interests.map((i) => (
                <span key={i} className="rounded-full bg-violet-soft px-2.5 py-1 text-[11px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
                  {i}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs font-bold text-campus-text-sec dark:text-campus-dark-sec">
              <span>
                <span className="font-display text-sm text-campus-text dark:text-campus-dark-text">{posts.length}</span> posts
              </span>
              <span>
                <span className="font-display text-sm text-campus-text dark:text-campus-dark-text">{personCircles.length}</span> circles
              </span>
            </div>
          </div>

          {!isMe && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-campus-border pt-2.5 text-[11px] font-semibold text-campus-text-sec dark:border-campus-dark-border dark:text-campus-dark-sec">
              {canMessage({ allowMessages: person.isVerified ? 'University Students Only' : 'Consent Requests Only' }, true) === 'request' ? (
                <span>Messages to this student go through a consent request first.</span>
              ) : (
                <span>You can message this student directly.</span>
              )}
              <button onClick={() => reportContent(`${person.name}'s profile`, { targetType: 'user', targetId: person.id, reason: 'harassment' })} className="flex items-center gap-1 hover:text-coral">
                <Flag size={11} /> Report profile
              </button>
              {muted && (
                <span className="flex items-center gap-1">
                  <VolumeX size={11} /> Muted
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'posts', label: 'Posts', count: posts.length },
          { key: 'circles', label: 'Circles', count: personCircles.length },
          { key: 'about', label: 'About' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="space-y-3">
        {tab === 'posts' &&
          (posts.length > 0 ? (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          ) : (
            <div className="card p-8 text-center">
              <p className="font-display font-bold">No posts yet</p>
              <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                {isMe ? 'Share your first post from the Home composer.' : 'Posts appear here once shared with you.'}
              </p>
            </div>
          ))}

        {tab === 'circles' &&
          (personCircles.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {personCircles.map((c) => (
                <Link key={c.slug} href={`/circles/${c.slug}`} className="card flex items-center gap-3 p-3 transition hover:shadow-lift">
                  <img src={portraitScene(c.slug, 80, 80)} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.name}</p>
                    <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">{c.category} • {c.memberCount} members</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center text-sm text-campus-text-sec dark:text-campus-dark-sec">
              Circle membership is private for this student.
            </div>
          ))}

        {tab === 'about' && (
          <div className="card space-y-2 p-4 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-campus-text-sec dark:text-campus-dark-sec">Department</dt>
                <dd className="text-right">{person.departmentName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-campus-text-sec dark:text-campus-dark-sec">Semester</dt>
                <dd className="text-right">{person.semester}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-campus-text-sec dark:text-campus-dark-sec">Student status</dt>
                <dd className="text-right">{person.isVerified ? 'NUB Verified student' : 'Registered account (not NUB Verified)'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-campus-text-sec dark:text-campus-dark-sec">Media</dt>
                <dd className="text-right">Photos only (no video)</dd>
              </div>
            </dl>
            <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
              NUBCONNECT never fabricates personal details. Profiles show only what students choose to share.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
