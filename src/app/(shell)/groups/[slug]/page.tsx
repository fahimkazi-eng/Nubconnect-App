'use client';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, MessageCircle, Users } from 'lucide-react';
import { DEMO_GROUPS } from '@/lib/demo/dataset';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { loadGroupDetail, type CircleMember } from '@/lib/circles';
import { useApp } from '@/lib/store';
import { Avatar, DemoTag, EmptyState } from '@/components/ui/kit';
import { pluralize } from '@/lib/format';
import type { Group } from '@/lib/types';

function Quiet({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-display font-bold">{title}</p>
      <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">{body}</p>
    </div>
  );
}

export default function GroupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const configured = isBackendConfigured();
  const { user, joinedGroups, toggleJoinGroup, startConversation } = useApp();
  const [real, setReal] = useState<{ group: Group; members: CircleMember[]; rules: string[] } | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const demoGroup = DEMO_GROUPS.find((g) => g.slug === slug);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    void loadGroupDetail(getSupabaseBrowserClient(), slug, user.id).then(({ data, error: err }) => {
      if (!active) return;
      if (err) setError(err);
      else if (!data) setError('This group could not be found.');
      else setReal({ group: data.group, members: data.members, rules: data.rules });
      setLoading(false);
    });
    return () => { active = false; };
  }, [configured, slug, user.id]);

  if (!configured && !demoGroup) notFound();

  const group = configured ? real?.group ?? null : demoGroup ?? null;
  const members: CircleMember[] = configured ? real?.members ?? [] : [];
  const rules = configured ? real?.rules ?? [] : [];
  // Both modes read the same real join list: localStorage in demo mode,
  // `group_members` for a signed-in student in configured mode.
  const joined = Boolean(group) && joinedGroups.includes(group!.slug);

  if (configured && loading) {
    return <div className="card p-6 text-center text-sm font-semibold" role="status">Loading group…</div>;
  }
  if (configured && (error || !group)) {
    return (
      <div className="space-y-3">
        <Link href="/circle?tab=circles" className="inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline">
          <ArrowLeft size={14} /> All groups
        </Link>
        <EmptyState
          icon={<AlertCircle size={22} />}
          title="Group unavailable"
          body={error ?? 'This group could not be found.'}
        />
      </div>
    );
  }
  if (!group) notFound();

  return (
    <div>
      <Link href="/circle?tab=circles" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline">
        <ArrowLeft size={14} /> All groups
      </Link>

      <div className="card overflow-hidden p-0">
        <div className="relative h-24 bg-gradient-to-br from-violet via-aqua to-lime" aria-hidden="true">
          {!configured && <span className="absolute right-2 top-2"><DemoTag compact /></span>}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="font-display text-xl font-extrabold">{group.name}</h1>
              <p className="text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                {group.type} group • {pluralize(group.memberCount, 'member')}
              </p>
            </div>
          </div>
          {group.description && <p className="mt-2 text-sm leading-relaxed">{group.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => toggleJoinGroup(group.slug)}
              aria-pressed={joined}
              className={`touch-target flex-1 rounded-xl py-2.5 text-sm font-bold transition sm:flex-none sm:px-6 ${
                joined
                  ? 'bg-lime-soft text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime'
                  : 'bg-violet text-plum shadow-violet-glow'
              }`}
            >
              {joined ? '✓ Joined' : 'Join Group'}
            </button>
            {!configured ? (
              <button
                onClick={() =>
                  startConversation({
                    personId: group.slug,
                    title: group.name,
                    kind: 'group',
                    initialNote: 'Hello group! Joining the conversation.',
                  })
                }
                className="touch-target flex items-center gap-1.5 rounded-xl bg-campus-bg px-4 py-2.5 text-sm font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
              >
                <MessageCircle size={16} className="text-violet-ink" /> Message
              </button>
            ) : (
              <span className="self-center text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                Group chat requires backend support.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card mt-4 p-4">
        <h2 className="font-display text-sm font-bold">Group info</h2>
        <dl className="mt-2 space-y-1.5 text-xs text-campus-text-sec dark:text-campus-dark-sec">
          <div className="flex justify-between gap-2">
            <dt className="font-semibold">Type</dt>
            <dd>{group.type}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-semibold">Members</dt>
            <dd>{group.memberCount}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-semibold">Media policy</dt>
            <dd>Photos only — no video in this release</dd>
          </div>
        </dl>
      </div>

      <div className="card mt-4 p-4">
        <h2 className="font-display text-sm font-bold">Rules</h2>
        {rules.length > 0 ? (
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-campus-text-sec dark:text-campus-dark-sec">
            {rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-campus-text-sec dark:text-campus-dark-sec">
            No rules have been published for this group.
          </p>
        )}
      </div>

      <div className="card mt-4 p-4">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-bold">
          <Users size={15} className="text-violet-ink" /> Members
        </h2>
        {members.length > 0 ? (
          <div className="mt-2 divide-y divide-campus-border dark:divide-campus-dark-border">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 py-2.5">
                <Avatar seed={m.userId} name={m.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{m.name}</p>
                  <p className="truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">{m.role}</p>
                </div>
              </div>
            ))}
            <p className="pt-2 text-center text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
              Showing members visible to this account.
            </p>
          </div>
        ) : (
          <div className="mt-2">
            <Quiet
              title={configured ? 'No members visible yet' : 'Member roster unavailable'}
              body={configured
                ? 'No one has joined this group, or the roster is not visible to your account.'
                : 'The member roster is not available in the demo.'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
