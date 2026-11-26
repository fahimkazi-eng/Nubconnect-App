'use client';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Calendar, FileText, MessageCircle, ScrollText, Users } from 'lucide-react';
import { DEMO_CIRCLES, DEMO_EVENTS, DEMO_PEOPLE, DEMO_POSTS } from '@/lib/demo/dataset';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import {
  loadCircleDetail,
  type CircleMember,
} from '@/lib/circles';
import { setGroupMedia } from '@/lib/media';
import OrgMediaManager from '@/components/media/OrgMediaManager';
import { useApp } from '@/lib/store';
import { coverScene } from '@/lib/photos';
import { Avatar, DemoTag, EmptyState, Tabs } from '@/components/ui/kit';
import PostCard from '@/components/feed/PostCard';
import { pluralize } from '@/lib/format';
import type { Circle, CampusEvent, Post } from '@/lib/types';

function Quiet({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-display font-bold">{title}</p>
      <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">{body}</p>
    </div>
  );
}

export default function CircleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const configured = isBackendConfigured();
  const { user, joinedCircles, toggleJoinCircle, startConversation } = useApp();
  const [tab, setTab] = useState('feed');
  const [real, setReal] = useState<{ circle: Circle; members: CircleMember[] } | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const demoCircle = DEMO_CIRCLES.find((c) => c.slug === slug);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    void loadCircleDetail(getSupabaseBrowserClient(), slug, user.id).then(({ data, error: err }) => {
      if (!active) return;
      if (err) setError(err);
      else if (!data) setError('This circle could not be found.');
      else setReal({ circle: data.circle, members: data.members });
      setLoading(false);
    });
    return () => { active = false; };
  }, [configured, slug, user.id]);

  if (!configured && !demoCircle) notFound();

  const circle = configured ? real?.circle ?? null : demoCircle ?? null;
  const joined = joinedCircles.includes(slug);

  // Real circles have no post/event/discussion/resource link in this schema.
  // Show honest empty states instead of borrowing demo activity.
  const posts: Post[] = configured ? [] : DEMO_POSTS.filter((p) => p.circleSlug === slug);
  const events: CampusEvent[] = configured ? [] : DEMO_EVENTS.slice(0, 2);
  const members: CircleMember[] = configured
    ? real?.members ?? []
    : ['p-arif', 'p-maliha', 'p-farhana', 'p-rakib', 'p-jannat'].map((id) => ({
        userId: id,
        name: DEMO_PEOPLE.find((p) => p.id === id)?.name ?? 'Student',
        username: DEMO_PEOPLE.find((p) => p.id === id)?.username ?? '',
        role: 'member',
      }));

  const toggleMembership = () => {
    // The store owns membership (DB write in real mode, localStorage in demo
    // mode) so the directory and this detail page never disagree.
    toggleJoinCircle(slug);
    // Keep the visible roster/count responsive; the authoritative state is the
    // store's join list and the next load will reconcile any difference.
    setReal((current) =>
      current
        ? {
            ...current,
            circle: {
              ...current.circle,
              memberCount: Math.max(0, current.circle.memberCount + (joined ? -1 : 1)),
            },
            members: joined
              ? current.members.filter((m) => m.userId !== user.id)
              : [...current.members, { userId: user.id, name: user.name, username: '', role: 'member' }],
          }
        : current,
    );
  };

  if (configured && loading) {
    return <div className="card p-6 text-center text-sm font-semibold" role="status">Loading circle…</div>;
  }
  if (configured && (error || !circle)) {
    return (
      <div className="space-y-3">
        <Link href="/circle?tab=circles" className="inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline">
          <ArrowLeft size={14} /> All circles
        </Link>
        <EmptyState
          icon={<AlertCircle size={22} />}
          title="Circle unavailable"
          body={error ?? 'This circle could not be found.'}
        />
      </div>
    );
  }
  if (!circle) notFound();

  return (
    <div>
      <Link href="/circle?tab=circles" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline">
        <ArrowLeft size={14} /> All circles
      </Link>

      <div className="card overflow-hidden p-0">
        <div className="relative h-32 sm:h-40">
          {circle.coverUrl ? (
            <img src={circle.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-violet via-aqua to-lime" aria-hidden="true" />
          )}
          {!configured && <img src={coverScene(circle.slug, 1200, 400)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          {!configured && <span className="absolute right-2 top-2"><DemoTag compact /></span>}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-3">
              {circle.logoUrl && (
                <img
                  src={circle.logoUrl}
                  alt={`${circle.name} avatar`}
                  className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-campus-border dark:ring-campus-dark-border"
                />
              )}
              <div className="min-w-0">
                <h1 className="font-display text-xl font-extrabold">{circle.name}</h1>
                <p className="text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                  {circle.category} circle • {pluralize(circle.memberCount, 'member')}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed">{circle.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={toggleMembership}
              aria-pressed={joined}
              className={`touch-target flex-1 rounded-xl py-2.5 text-sm font-bold transition sm:flex-none sm:px-6 ${
                joined
                  ? 'bg-lime-soft text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime'
                  : 'bg-violet text-plum shadow-violet-glow'
              }`}
            >
              {joined ? '✓ Joined' : 'Join Circle'}
            </button>
            {!configured && (
              <button
                onClick={() =>
                  startConversation({
                    personId: 'p-arif',
                    title: `${circle.name} — circle chat`,
                    kind: 'group',
                    initialNote: 'Hello circle! Anyone up for this week’s activity?',
                  })
                }
                className="touch-target flex items-center gap-1.5 rounded-xl bg-campus-bg px-4 py-2.5 text-sm font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
              >
                <MessageCircle size={16} className="text-violet-ink" /> Message
              </button>
            )}
            {configured && (
              <span className="self-center text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                Group chat requires backend support.
              </span>
            )}
          </div>
        </div>
      </div>

      {configured && circle.createdBy === user.id && (
        <div className="mt-4">
          <OrgMediaManager
            title="Circle branding"
            subtitle="Visible only to the circle owner. Saved through the authorized covers bucket and the circle media RPC (migration 020)."
            canEdit
            fields={[
              {
                key: 'cover',
                title: 'Cover image',
                hint: 'Wide image shown at the top of the circle page.',
                aspectLabel: '8:3',
                canvasWidth: 1280,
                canvasHeight: 480,
                currentUrl: circle.coverUrl ?? null,
              },
              {
                key: 'avatar',
                title: 'Circle avatar',
                hint: 'Square image shown in the Circle directory and on this page.',
                aspectLabel: '1:1',
                canvasWidth: 512,
                canvasHeight: 512,
                currentUrl: circle.logoUrl ?? null,
              },
            ]}
            onSave={async (key, _file, uploadedUrl) => {
              const supabase = getSupabaseBrowserClient();
              if (!supabase) return 'Circle data is not available.';
              const result = await setGroupMedia(supabase, {
                groupId: circle.slug,
                avatarUrl: key === 'avatar' ? uploadedUrl : undefined,
                coverUrl: key === 'cover' ? uploadedUrl : undefined,
              });
              if (!result.ok) return result.error ?? 'Could not save the circle media.';
              setReal((prev) =>
                prev
                  ? {
                      ...prev,
                      circle: {
                        ...prev.circle,
                        logoUrl: key === 'avatar' ? (uploadedUrl ?? undefined) : prev.circle.logoUrl,
                        coverUrl: key === 'cover' ? (uploadedUrl ?? undefined) : prev.circle.coverUrl,
                      },
                    }
                  : prev,
              );
              return null;
            }}
          />
        </div>
      )}

      <div className="mt-4">
        <Tabs
          tabs={[
            { key: 'feed', label: 'Feed', count: posts.length },
            { key: 'discussions', label: 'Discussions' },
            { key: 'rules', label: 'Rules' },
            { key: 'events', label: 'Events', count: events.length },
            { key: 'resources', label: 'Resources' },
            { key: 'members', label: 'Members', count: members.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="mt-3 space-y-3">
        {tab === 'feed' &&
          (posts.length > 0 ? (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          ) : (
            <Quiet
              title="The circle feed is quiet"
              body={configured
                ? 'Posts are not linked to circles in this release, so no circle activity is shown.'
                : 'Share something with this circle from your Home composer.'}
            />
          ))}

        {tab === 'discussions' &&
          (configured ? (
            <Quiet title="No discussions yet" body="Circle discussions need a group-linked thread in the database." />
          ) : (
            <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
              {[
                { t: 'Best study spots on the permanent campus?', r: 14 },
                { t: 'Sharing: intro guides for new members', r: 8 },
                { t: 'This week’s meet-up thread', r: 21 },
              ].map((d) => (
                <div key={d.t} className="flex items-center gap-3 p-3.5">
                  <ScrollText size={17} className="shrink-0 text-violet-ink" />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{d.t}</p>
                  <span className="shrink-0 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">{d.r} replies</span>
                </div>
              ))}
            </div>
          ))}

        {tab === 'rules' && (
          <div className="card p-4">
            <h2 className="mb-2 font-display text-sm font-bold">Circle rules</h2>
            {circle.rules.length === 0 ? (
              <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
                No rules have been published for this circle.
              </p>
            ) : (
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                {circle.rules.map((r) => <li key={r}>{r}</li>)}
              </ol>
            )}
          </div>
        )}

        {tab === 'events' &&
          (events.length > 0 ? (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="card flex items-center gap-3 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-soft font-mono text-[10px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
                    {e.date.slice(8)}/{e.date.slice(5, 7)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{e.title}</p>
                    <p className="truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                      {[e.startTime, e.venue].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <Calendar size={16} className="shrink-0 text-campus-text-sec dark:text-campus-dark-sec" />
                </div>
              ))}
            </div>
          ) : (
            <Quiet
              title="No circle events"
              body={configured
                ? 'Events are not linked to circles in this release. Check Campus Events.'
                : 'No events are scheduled for this circle.'}
            />
          ))}

        {tab === 'resources' && (
          configured ? (
            <Quiet title="No shared resources" body="Resources need a group-linked document table in the database." />
          ) : (
            <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
              {['Circle starter pack (PDF)', 'Member directory (demo)', 'Past photowalk galleries'].map((r) => (
                <div key={r} className="flex items-center gap-3 p-3.5">
                  <FileText size={17} className="shrink-0 text-aqua" />
                  <p className="flex-1 text-sm font-semibold">{r}</p>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'members' &&
          (members.length > 0 ? (
            <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 p-3">
                  <Avatar seed={m.userId} name={m.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{m.name}</p>
                    <p className="truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">{m.role}</p>
                  </div>
                </div>
              ))}
              <p className="p-3 text-center text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                Showing members visible to this account.
              </p>
            </div>
          ) : (
            <Quiet title="No members yet" body="Be the first to join this circle." />
          ))}
      </div>
    </div>
  );
}
