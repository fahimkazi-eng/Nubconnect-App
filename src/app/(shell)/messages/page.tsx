'use client';

// Messages inbox: All / Unread / Requests / Groups with search, pins, mute.
// On mobile this list and the conversation are SEPARATE views (§8.2) — the
// conversation opens full-screen at /messages/[id].
//
// Phase 3: with a backend configured this reads the real `get_inbox()` RPC.
// Without one it stays the clearly-labelled demo inbox. Group/plan chats are
// session-local and carry an honest badge until group messaging ships.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BellOff,
  Check,
  ChevronRight,
  Loader2,
  PenSquare,
  Pin,
  Search as SearchIcon,
  X,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { Avatar, DemoTag, EmptyState, Tabs } from '@/components/ui/kit';
import { timeAgo } from '@/lib/format';
import { DEMO_PEOPLE } from '@/lib/demo/dataset';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { isUuid } from '@/lib/messaging';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Conversation } from '@/lib/types';

interface PersonResult {
  id: string;
  username: string;
  name: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  isDemo: boolean;
}

interface ProfileSearchRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified_student: boolean | null;
}

export default function MessagesInbox() {
  const router = useRouter();
  const {
    conversations,
    markConversationRead,
    unreadCount,
    blockedIds,
    inboxLoading,
    inboxError,
    refreshInbox,
    startConversation,
    user,
    isDemoUser,
    authLoading,
  } = useApp();
  const configured = isBackendConfigured();
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');

  const [composerOpen, setComposerOpen] = useState(false);
  const [selected, setSelected] = useState<PersonResult | null>(null);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [starting, setStarting] = useState(false);

  // Real-time inbox ping: a new message in any of your conversations refreshes
  // the inbox immediately instead of waiting for the 30s poll. Only a content-
  // free ping crosses the wire; the authorized loader enforces who reads what.
  useEffect(() => {
    if (!configured || !isUuid(user.id)) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let channel: RealtimeChannel | null = null;
    let timer: number | undefined;
    channel = supabase.channel(`user:${user.id}:inbox`);
    channel
      .on('broadcast', { event: 'refresh' }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void refreshInbox(), 150);
      })
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, user.id]);

  // Keep a real inbox fresh without a page reload. Demo mode is a no-op.
  useEffect(() => {
    void refreshInbox();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshInbox();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshInbox();
    }, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [refreshInbox]);

  // Student search for the "New message" panel.
  useEffect(() => {
    if (!composerOpen || selected) return;

    const q = peopleQuery.trim().toLowerCase();

    if (isDemoUser) {
      const results = DEMO_PEOPLE.filter(
        (p) =>
          p.id !== user.id &&
          p.discoverable !== false &&
          (!q || p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)),
      )
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          username: p.username,
          name: p.name,
          avatarUrl: null,
          isVerified: p.isVerified,
          isDemo: true,
        }));
      setPeople(results);
      setPeopleError(null);
      setPeopleLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    setPeopleLoading(true);
    const timer = setTimeout(async () => {
      // Strip PostgREST filter punctuation from the search term.
      const safe = q.replace(/[%,()]/g, ' ').trim();
      let request = supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_verified_student')
        .neq('id', user.id)
        .order('display_name')
        .limit(12);

      if (safe) {
        request = request.or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`);
      }

      const { data, error } = await request;
      if (!active) return;
      setPeopleLoading(false);

      if (error) {
        setPeopleError('Could not search students right now. Please try again.');
        setPeople([]);
        return;
      }

      setPeopleError(null);
      setPeople(
        ((data ?? []) as ProfileSearchRow[]).map((row) => ({
          id: row.id,
          username: row.username,
          name: row.display_name,
          avatarUrl: row.avatar_url,
          isVerified: Boolean(row.is_verified_student),
          isDemo: false,
        })),
      );
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [composerOpen, selected, peopleQuery, isDemoUser, user.id]);

  const closeComposer = () => {
    setComposerOpen(false);
    setSelected(null);
    setPeopleQuery('');
    setPeople([]);
    setPeopleError(null);
    setNote('');
    setStarting(false);
  };

  const choosePerson = (person: PersonResult) => {
    setSelected(person);
    setNote(`Hi ${person.name.split(' ')[0]}! Connecting from NUBCONNECT.`);
  };

  const sendRequest = async () => {
    if (!selected) return;
    setStarting(true);
    const id = await startConversation({
      personId: selected.id,
      title: selected.name,
      initialNote: note.trim() || `Hi ${selected.name.split(' ')[0]}! Connecting from NUBCONNECT.`,
    });
    setStarting(false);
    if (id) {
      closeComposer();
      router.push(`/messages/${id}`);
    }
  };

  const list = useMemo(() => {
    // Blocked people's direct conversations and declined requests stay out of
    // the inbox. Declined chats remain reachable by direct link so the sender
    // sees an honest outcome instead of a silently vanished conversation.
    let out: Conversation[] = conversations.filter(
      (c) =>
        // A connected campus never shows a session-only (demo or local) chat.
        !(configured && (c.isDemo || c.isLocal)) &&
        c.request !== 'declined' &&
        !(c.kind === 'direct' && blockedIds.includes(c.participants[0] ?? '')),
    );
    // Archived conversations live only in their own tab.
    if (tab === 'archived') out = out.filter((c) => c.archived);
    else out = out.filter((c) => !c.archived);
    if (tab === 'unread') out = out.filter((c) => c.unread > 0);
    if (tab === 'requests') out = out.filter((c) => c.request === 'incoming');
    if (tab === 'groups') out = out.filter((c) => c.kind === 'group' || c.kind === 'plan');
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.lastMessage?.text.toLowerCase().includes(q) ||
          c.messages.some((m) => m.text.toLowerCase().includes(q)),
      );
    }
    return [...out].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const la = a.lastMessage?.createdAt ?? a.messages[a.messages.length - 1]?.createdAt ?? '';
      const lb = b.lastMessage?.createdAt ?? b.messages[b.messages.length - 1]?.createdAt ?? '';
      return new Date(lb).getTime() - new Date(la).getTime();
    });
  }, [conversations, tab, query, blockedIds, configured]);

  const requestCount = conversations.filter(
    (c) =>
      !(configured && (c.isDemo || c.isLocal)) &&
      !c.archived &&
      c.request === 'incoming' &&
      !(c.kind === 'direct' && blockedIds.includes(c.participants[0] ?? '')),
  ).length;
  const demoMode = isDemoUser;

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3 px-1">
        <div>
          <p className="editorial-kicker mb-1 text-violet-ink dark:text-violet">Your inbox</p>
          <h1 className="font-display text-xl font-extrabold sm:text-2xl">Messages</h1>
          <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
            Private conversations — consent-based, photo attachments, no video.
          </p>
        </div>
        <button
          onClick={() => (composerOpen ? closeComposer() : setComposerOpen(true))}
          className="touch-target flex shrink-0 items-center gap-1.5 rounded-xl bg-violet px-3 py-2 text-xs font-bold text-plum shadow-violet-glow"
          aria-expanded={composerOpen}
        >
          <PenSquare size={14} /> New
        </button>
      </header>

      {composerOpen && (
        <section className="card space-y-3 p-3" aria-label="Start a new conversation">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold">
              {selected ? 'Write your first message' : 'New message'}
            </h2>
            <button
              onClick={closeComposer}
              aria-label="Close new message"
              className="hit-pad rounded-full p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X size={15} />
            </button>
          </div>

          {!selected ? (
            <>
              <div className="relative">
                <SearchIcon
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-campus-text-sec dark:text-campus-dark-sec"
                />
                <input
                  autoFocus
                  value={peopleQuery}
                  onChange={(e) => setPeopleQuery(e.target.value)}
                  placeholder={demoMode ? 'Search demo students' : 'Search students by name or username'}
                  aria-label="Search students"
                  className="touch-target w-full rounded-2xl border border-campus-border bg-campus-bg py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text"
                />
              </div>

              {peopleLoading && (
                <p className="flex items-center gap-2 text-xs text-campus-text-sec dark:text-campus-dark-sec">
                  <Loader2 size={13} className="animate-spin" /> Searching students…
                </p>
              )}
              {peopleError && <p className="text-xs font-semibold text-coral-ink dark:text-coral">{peopleError}</p>}

              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {people.map((person) => (
                  <li key={person.id}>
                    <button
                      onClick={() => choosePerson(person)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-violet-soft dark:hover:bg-violet-dark-soft"
                    >
                      <Avatar
                        seed={person.id}
                        name={person.name}
                        size={34}
                        src={person.avatarUrl ?? undefined}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold">{person.name}</span>
                          {person.isDemo && <DemoTag compact />}
                        </span>
                        <span className="block truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                          @{person.username}
                          {person.isVerified ? ' · Verified NUB student' : ''}
                        </span>
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-campus-text-sec dark:text-campus-dark-sec" />
                    </button>
                  </li>
                ))}
              </ul>

              {!peopleLoading && !peopleError && people.length === 0 && (
                <p className="py-3 text-center text-xs text-campus-text-sec dark:text-campus-dark-sec">
                  {peopleQuery.trim()
                    ? 'No students match that search.'
                    : demoMode
                      ? 'No demo students available.'
                      : 'No visible students yet. Students appear here once they create an account and allow discovery.'}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 rounded-xl bg-campus-bg p-2 dark:bg-campus-dark-card">
                <Avatar
                  seed={selected.id}
                  name={selected.name}
                  size={34}
                  src={selected.avatarUrl ?? undefined}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">{selected.name}</span>
                    {selected.isDemo && <DemoTag compact />}
                  </span>
                  <span className="block truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                    @{selected.username}
                  </span>
                </span>
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Say hello…"
                aria-label="First message"
                className="w-full resize-none rounded-2xl border border-campus-border bg-campus-bg px-3.5 py-2.5 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(null)}
                  className="touch-target flex-1 rounded-xl bg-campus-bg py-2 text-xs font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                >
                  Back
                </button>
                <button
                  onClick={() => void sendRequest()}
                  disabled={starting || !note.trim()}
                  className="touch-target flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet py-2 text-xs font-bold text-plum shadow-violet-glow disabled:opacity-40"
                >
                  {starting ? <Loader2 size={13} className="animate-spin" /> : null}
                  {starting ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Search */}
      <div className="relative">
        <SearchIcon size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-campus-text-sec dark:text-campus-dark-sec" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          className="touch-target w-full rounded-2xl border border-campus-border bg-campus-card py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="hit-pad absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-campus-text-sec hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <Tabs
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'unread', label: 'Unread', count: unreadCount },
          { key: 'requests', label: 'Requests', count: requestCount },
          { key: 'groups', label: 'Groups' },
          { key: 'archived', label: 'Archived' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {inboxError && (
        <div className="card flex items-center gap-3 p-3 text-xs">
          <p className="min-w-0 flex-1 text-campus-text-sec dark:text-campus-dark-sec">
            {inboxError}
          </p>
          <button
            onClick={() => void refreshInbox()}
            className="touch-target shrink-0 rounded-xl bg-violet px-3 py-1.5 font-bold text-plum"
          >
            Retry
          </button>
        </div>
      )}

      <div className="space-y-2">
        {(inboxLoading || authLoading) && conversations.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-8 text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
            <Loader2 size={14} className="animate-spin" /> Loading conversations…
          </p>
        )}

        {list.map((c) => {
          const last = c.lastMessage ?? c.messages[c.messages.length - 1];
          const lastFrom = last?.senderId === 'me' ? 'You: ' : '';
          return (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              onClick={() => void markConversationRead(c.id)}
              className={`card flex items-center gap-3 p-3 transition hover:shadow-lift ${c.unread > 0 ? 'ring-1 ring-violet/40' : ''}`}
            >
              {c.avatarSeeds.length > 1 ? (
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-soft dark:bg-violet-dark-soft">
                  <span className="absolute -left-0.5 -top-0.5">
                    <Avatar seed={c.avatarSeeds[0]!} name="A" size={26} className="ring-2 ring-white dark:ring-campus-dark-card" />
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <Avatar seed={c.avatarSeeds[1]!} name="B" size={26} className="ring-2 ring-white dark:ring-campus-dark-card" />
                  </span>
                </span>
              ) : (
                <Avatar
                  seed={c.avatarSeeds[0] ?? c.id}
                  name={c.title}
                  size={48}
                  src={c.other?.avatarUrl ?? undefined}
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className={`truncate text-sm ${c.unread > 0 ? 'font-extrabold' : 'font-bold'}`}>{c.title}</p>
                  {c.isDemo && !demoMode && <DemoTag compact />}
                  {c.pinned && <Pin size={11} className="shrink-0 rotate-45 text-violet-ink" />}
                  {c.muted && <BellOff size={11} className="shrink-0 text-campus-text-sec dark:text-campus-dark-sec" />}
                  {c.request === 'incoming' && (
                    <span className="shrink-0 rounded-full bg-coral-ink px-1.5 py-px text-[9px] font-bold text-white">Request</span>
                  )}
                  {c.isLocal && (
                    <span className="shrink-0 rounded-full bg-campus-bg px-1.5 py-px text-[9px] font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border">
                      This session
                    </span>
                  )}
                </div>
                <p className={`truncate text-xs ${c.unread > 0 ? 'font-semibold text-campus-text dark:text-campus-dark-text' : 'text-campus-text-sec dark:text-campus-dark-sec'}`}>
                  {lastFrom}
                  {last?.text ?? 'Say hello 👋'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                  {last ? timeAgo(last.createdAt) : ''}
                </span>
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet px-1.5 text-[10px] font-bold text-plum">
                    {c.unread}
                  </span>
                )}
                {c.unread === 0 && <Check size={13} className="text-lime-ink dark:text-lime" />}
              </div>
            </Link>
          );
        })}

        {!inboxLoading && !authLoading && list.length === 0 && (
          <EmptyState
            icon={<SearchIcon size={22} />}
            title={
              tab === 'requests'
                ? 'No message requests'
                : tab === 'groups'
                  ? 'No group chats in this session'
                  : tab === 'archived'
                    ? 'No archived conversations'
                    : 'No conversations'
            }
            body={
              tab === 'requests'
                ? 'When someone outside your allowed settings messages you, the request appears here first.'
                : tab === 'groups'
                  ? 'Group and plan chats stay in this browser session for now. Real group messaging arrives in a later phase.'
                  : tab === 'archived'
                    ? 'Archived chats stay out of your main inbox. Restore them any time from the conversation menu.'
                    : query
                    ? `Nothing matches “${query}”.`
                    : 'Start a conversation with the New button, or from a profile, circle, club, room or marketplace item.'
            }
          />
        )}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
        {demoMode ? (
          <>
            <DemoTag compact /> conversations are demonstrations in demo mode.
          </>
        ) : isBackendConfigured() ? (
          'Real conversations are private to you and the other student.'
        ) : (
          'Demo mode — no server is configured.'
        )}
      </p>
    </div>
  );
}
